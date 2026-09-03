import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { pushUsers, staffLists, viewersOf } from './notify';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/** The account the bot's replies are filed under — never a real inbox. */
const ASSISTANT_BY = 'assistant@alwaidh.com';

/** The built-in owner; extra admins are read from settings at call time. */
const OWNER_EMAILS = ['mwaidh5@gmail.com'];

/**
 * The catalogue and the price sheets, kept in memory for a minute.
 *
 * Every customer message used to re-read three collections before the
 * assistant could think — a hundred-odd products among them. A minute is
 * short enough that a price edit shows up almost at once, and long enough
 * that a busy conversation isn't paying for the same read over and over.
 */
let factsCache: { at: number; text: string } | null = null;
const FACTS_TTL = 60_000;

/** Everything the shop knows, gathered fresh so a price is never stale. */
async function loadShopFacts(db: Firestore, knowledge: string): Promise<string> {
  const [prodSnap, sheetSnap, instSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('solarPrices').orderBy('order').get(),
    db.collection('solarInstallments').orderBy('order').get(),
  ]);

  const products = prodSnap.docs
    .filter((d) => !d.data().draft)
    .map((d) => {
      const p = d.data();
      const names = [p.name, p.nameAr].filter(Boolean).join(' / ');
      const stock = p.inStock ? 'in stock' : p.comingSoon ? 'coming soon' : 'out of stock';
      return `id=${d.id} | ${names} — ${Number(p.price ?? 0).toLocaleString('en-US')} IQD — ${stock}`;
    })
    .join('\n');

  const cashSheet = sheetSnap.docs
    .map((d) => {
      const v = (d.data().values ?? {}) as Record<string, string>;
      return Object.entries(v)
        .filter(([, val]) => val && val !== '-')
        .map(([k, val]) => `${k}: ${val}`)
        .join(', ');
    })
    .filter(Boolean)
    .join('\n');

  const instSheet = instSnap.docs
    .map((d) => {
      const r = d.data();
      return `${r.sizeKw}kW (${r.sizeAmp}A): inverter ${r.inverterKw}kW, ${r.panelsCount} panels (${r.panelsKwp}kWp), battery ${r.batteryKwh}kWh (${r.batteryLabel}), backup ${r.backupHours}h, price7=${Number(r.price7 ?? 0).toLocaleString('en-US')} IQD`;
    })
    .join('\n');

  return [
    '- Solar installments (Central Bank initiative, 1–7 year plans): the listed price7 is the 7-year total. Cash price = price7 ÷ 1.225. An N-year plan totals cash × (1 + 0.03 × N + 0.015); monthly = total ÷ (12 × N). Round every figure to the nearest thousand dinars.',
    '',
    "OWNER'S NOTES (highest authority — follow these over anything else):",
    knowledge || '(none yet)',
    '',
    'SOLAR SYSTEMS — CASH PRICE SHEET:',
    cashSheet || '(empty)',
    '',
    'SOLAR SYSTEMS — INSTALLMENT SHEET:',
    instSheet || '(empty)',
    '',
    'PRODUCTS (name — price — stock):',
    products || '(empty)',
  ].join('\n');
}

/**
 * A handful of real exchanges: what a customer asked, and what a
 * colleague answered. Nothing teaches tone and local pricing habits like
 * the shop's own words — and the assistant's own replies are excluded,
 * so it never learns from itself.
 */
let examplesCache: { at: number; text: string } | null = null;
const EXAMPLES_TTL = 5 * 60_000;

async function recentStaffExamples(db: Firestore): Promise<string> {
  if (examplesCache && Date.now() - examplesCache.at < EXAMPLES_TTL) return examplesCache.text;
  try {
    const chats = await db.collection('chats').orderBy('lastAt', 'desc').limit(12).get();
    const pairs: string[] = [];
    for (const chat of chats.docs) {
      if (pairs.length >= 8) break;
      const msgs = await chat.ref.collection('messages').orderBy('at', 'asc').limit(30).get();
      let lastGuest = '';
      for (const m of msgs.docs) {
        const d = m.data();
        const text = String(d.text ?? '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        if (d.from === 'guest') {
          lastGuest = text.slice(0, 200);
        } else if (d.by !== ASSISTANT_BY && lastGuest) {
          pairs.push(`Customer: ${lastGuest}\nColleague: ${text.slice(0, 300)}`);
          lastGuest = '';
          if (pairs.length >= 8) break;
        }
      }
    }
    const text = pairs.length
      ? ['', 'HOW THE TEAM ANSWERS (real exchanges — copy this tone, not these prices):', ...pairs].join('\n')
      : '';
    examplesCache = { at: Date.now(), text };
    return text;
  } catch {
    return '';
  }
}

/**
 * Is a colleague in this conversation right now? Typing within the last
 * minute and a half, or a message of theirs since `sinceMs`. Asked before
 * the assistant starts, and again before it speaks — an answer that took
 * ten seconds to write may have been overtaken by a person.
 */
async function humanActive(db: Firestore, chatId: string, sinceMs: number): Promise<boolean> {
  const chatDoc = await db.doc(`chats/${chatId}`).get();
  const typingAt = chatDoc.get('staffTypingAt');
  if (typingAt instanceof Timestamp && Date.now() - typingAt.toMillis() < 90_000) return true;
  const recent = await db
    .collection(`chats/${chatId}/messages`)
    .orderBy('at', 'desc')
    .limit(6)
    .get();
  return recent.docs.some((d) => {
    const m = d.data();
    return (
      m.from === 'staff' && m.by !== ASSISTANT_BY && m.at instanceof Timestamp && m.at.toMillis() > sinceMs
    );
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * After a wait, is this still the message to answer? Not if the customer
 * has written again since (that message's own run will answer), and not
 * if the assistant already has.
 */
async function stillLatest(db: Firestore, chatId: string, messageId: string, sinceMs: number): Promise<boolean> {
  const recent = await db
    .collection(`chats/${chatId}/messages`)
    .orderBy('at', 'desc')
    .limit(4)
    .get();
  for (const d of recent.docs) {
    const m = d.data();
    if (m.from === 'guest') return d.id === messageId;
    if (m.by === ASSISTANT_BY && m.at instanceof Timestamp && m.at.toMillis() > sinceMs) return false;
  }
  return true;
}

/** The one sentence that hands a customer to the team, in their language. */
function handoffLine(sample: string): string {
  return /[\u0600-\u06FF]/.test(sample)
    ? 'هذا السؤال لازم زميلي بالفريق يجاوبك عليه، رح يرد عليك هنا بأقرب وقت.'
    : 'A colleague from the team will answer this one — they will reply here shortly.';
}

const IDENTITY =
  'You are the customer assistant for Alwaidh (الواعظ للقدرة) — a Baghdad shop for solar energy systems, computers, and Tiandy security cameras. Website: alwaidh.com. Phone/WhatsApp: +964 774 420 5582. Email: support@alwaidh.com.';

async function askClaude(
  key: string,
  model: string,
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens: number,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    // No temperature: the Claude 5 models refuse the parameter outright.
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    throw new Error(`API refused: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const out = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (out.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}

/**
 * The shop's AI assistant: answers a visitor's chat message from the
 * owner's notes plus the live catalogue and solar price sheets, in the
 * visitor's own language. It stays silent when disabled, when no real
 * API key is connected, and for ten minutes after a human colleague
 * speaks — the human owns the thread.
 */
export const assistantReply = onDocumentCreated(
  {
    document: 'chats/{chatId}/messages/{messageId}',
    secrets: [ANTHROPIC_API_KEY],
    // Room for the three-minute wait below plus a slow model turn.
    timeoutSeconds: 300,
    // A cold start puts several seconds between a customer's question and
    // the first word of the answer. Keeping one instance awake
    // (minInstances: 1) removes that, at the cost of a small standing
    // charge every month — the owner's call, not ours. More memory is
    // free of standing cost and starts faster.
    memory: '512MiB',
  },
  async (event) => {
    const msg = event.data?.data();
    if (!msg || msg.from !== 'guest') return;
    if (!String(msg.text ?? '').trim()) return;

    const key = (ANTHROPIC_API_KEY.value() || '').trim();
    if (!key.startsWith('sk-ant-')) return; // placeholder until a key is connected

    const db = getFirestore();
    const cfg = (await db.doc('settings/assistant').get()).data() ?? {};
    if (!cfg.enabled) return;

    const chatId = event.params.chatId;

    // The conversation so far, oldest first. The triggering message is
    // included — its server timestamp is resolved by read time.
    const msgsSnap = await db
      .collection(`chats/${chatId}/messages`)
      .orderBy('at', 'desc')
      .limit(14)
      .get();
    const history = msgsSnap.docs.map((d) => d.data()).reverse();

    // Typing silences the assistant at once.
    const chatDoc = await db.doc(`chats/${chatId}`).get();
    const typingAt = chatDoc.get('staffTypingAt');
    if (typingAt instanceof Timestamp && Date.now() - typingAt.toMillis() < 90_000) return;

    const askedAt = msg.at instanceof Timestamp ? msg.at.toMillis() : Date.now();
    const tenMinAgo = Date.now() - 10 * 60_000;
    const colleagueHere = history.some(
      (m) =>
        m.from === 'staff' &&
        m.by !== ASSISTANT_BY &&
        m.at instanceof Timestamp &&
        m.at.toMillis() > tenMinAgo,
    );

    if (colleagueHere) {
      // A colleague is in this conversation, so the next answer is theirs
      // — for three minutes. If nobody has typed or replied by then, the
      // customer should not be left waiting: the assistant steps in. A
      // customer who wrote again meanwhile is answered by that message's
      // own run, not this one.
      await sleep(3 * 60_000);
      if (await humanActive(db, chatId, askedAt)) return;
      if (!(await stillLatest(db, chatId, event.params.messageId, askedAt))) return;
    } else {
      // Nobody has joined yet, but a colleague has this chat open on a
      // screen: give them a head start. If they start typing or answer in
      // the meantime, stand down.
      const watching = await viewersOf([`chat:${chatId}`]);
      if (watching.size) {
        await sleep(25_000);
        if (await humanActive(db, chatId, askedAt)) return;
        if (!(await stillLatest(db, chatId, event.params.messageId, askedAt))) return;
      }
    }

    const knowledge = String(cfg.knowledge ?? '');
    const fresh = factsCache && Date.now() - factsCache.at < FACTS_TTL && factsCache.text.includes(knowledge);
    const facts = fresh ? factsCache!.text : await loadShopFacts(db, knowledge);
    if (!fresh) factsCache = { at: Date.now(), text: facts };
    const examples = await recentStaffExamples(db);
    const system = [
      IDENTITY,
      '',
      'Rules:',
      "- Reply in the customer's language. When they write Arabic, speak IRAQI dialect (اللهجة العراقية البغدادية) — NEVER Levantine, Gulf or Egyptian.",
      '- Iraqi words to use: هنا، شكد، اكو، ماكو، شنو، شلون، هواية، زين، احنه، نكَول/نكول، يمعوّد، تدلل، على عيني.',
      '- Words you must NEVER use (wrong dialect): هون، هيك، كتير، هلق، هلأ، بدك، شو (Levantine) — وش، يبغى، تبغى، تبي، وايد (Gulf) — ازيك، عايز (Egyptian).',
      '- Before sending, re-read your reply: if any of those words slipped in, rewrite the sentence in Iraqi.',
      '- Formal Modern Standard Arabic is fine for technical sentences; the friendly words around them must be Iraqi.',
      '- Be brief, warm and concrete: one to four sentences unless listing prices.',
      '- Use ONLY the facts below. NEVER invent prices, stock, discounts or promises.',
      '- If the answer is not in the facts, or the customer wants to negotiate, complain, place an order through chat, or clearly needs a person — say a colleague from the team will reply here soon, and stop. Whenever you say that, ALSO add a line at the very start of your reply, exactly:',
      'NOTIFY_STAFF',
      '- Prices are in Iraqi dinar (IQD), always rounded to the nearest thousand.',
      '- Answer the question that was asked. Do not repeat the shop address, the phone number or a list of options unless they help.',
      examples,
      '- When you recommend ONE specific product from the PRODUCTS list, attach its card: put a line at the very START of your reply, before any other text, exactly:',
      'PRODUCT: <id>',
      '- At most one PRODUCT line, only an id that appears in the list, and only when the customer is looking for something to buy. The card shows the photo, name and price, so keep the text short.',
      '- Keep every reply under 100 words. Recommend ONE best option, not a list.',
      facts,
    ].join('\n');

    // Alternating turns for the API: merge same-role runs, start on the
    // visitor, end on the visitor (the message that woke us).
    const turns: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of history) {
      const role = m.from === 'guest' ? ('user' as const) : ('assistant' as const);
      const body = String(m.text ?? '').slice(0, 1200);
      if (!body.trim()) continue;
      const last = turns[turns.length - 1];
      if (last && last.role === role) last.content += '\n' + body;
      else turns.push({ role, content: body });
    }
    while (turns.length && turns[0].role !== 'user') turns.shift();
    if (!turns.length || turns[turns.length - 1].role !== 'user') return;

    let reply: string;
    try {
      reply = await askClaude(key, String(cfg.model ?? '') || 'claude-sonnet-5', system, turns, 900);
    } catch (e) {
      console.warn('assistant:', e instanceof Error ? e.message : e);
      return;
    }
    // A PRODUCT: <id> line at the tail becomes a real product card — the
    // same attachment staff send by hand.
    let card: Record<string, unknown> | null = null;
    let needsStaff = !reply;
    const kept: string[] = [];
    for (const line of reply.split('\n')) {
      if (/^\s*NOTIFY_STAFF\s*$/.test(line)) {
        needsStaff = true;
        continue;
      }
      const m = /^\s*PRODUCT:\s*([\w-]+)\s*$/.exec(line);
      if (m && !card) {
        const snap = await db.doc(`products/${m[1]}`).get();
        const prod = snap.data();
        if (prod && !prod.draft) {
          card = {
            id: snap.id,
            name: String(prod.name ?? ''),
            price: Number(prod.price ?? 0),
            currency: String(prod.currency ?? 'IQD'),
            image: String(prod.image ?? ''),
          };
          continue;
        }
      }
      kept.push(line);
    }
    // The hand-off is always the same single sentence: the model wrote
    // its own version twice in one reply, and once wrote only the marker
    // — which used to mean the customer got nothing at all.
    let body = kept.join('\n').trim();
    if (needsStaff || !body) {
      needsStaff = true;
      body = handoffLine(String(msg.text ?? ''));
    }

    // One last look before speaking: a person may have taken over while
    // the answer was being written, or the customer may have moved on.
    if (await humanActive(db, chatId, askedAt)) return;
    if (!(await stillLatest(db, chatId, event.params.messageId, askedAt))) return;

    // Filed as staff so the widget styles it like a team reply; the staff
    // unread count is left alone so a person still reviews the thread.
    await db.collection(`chats/${chatId}/messages`).add({
      from: 'staff',
      by: ASSISTANT_BY,
      byName: '🤖 المساعد',
      text: body,
      ...(card ? { product: card } : {}),
      at: FieldValue.serverTimestamp(),
    });
    await db.doc(`chats/${chatId}`).set(
      {
        lastText: body || `📦 ${String(card?.name ?? '')}`,
        lastFrom: 'staff',
        lastAt: FieldValue.serverTimestamp(),
        unreadForGuest: FieldValue.increment(1),
      },
      { merge: true },
    );

    // The bot promised a human — make sure the humans hear about it, on
    // top of the ordinary new-message ping they already got.
    if (needsStaff) {
      const question = String(msg.text ?? '').replace(/\s+/g, ' ').slice(0, 90);
      await pushUsers(
        (await staffLists()).messages,
        '',
        'messages',
        '📣 Customer needs staff',
        question || 'The assistant handed a chat to the team',
        `/admin/chat?c=${chatId}`,
        ['messages', `chat:${chatId}`],
      );
    }
  },
);

/**
 * Training mode: the owner talks to the assistant like a new employee —
 * asks what it knows, tests its answers, corrects it. Facts the owner
 * states come back marked SAVE: and are appended to the notes the
 * customer-facing bot answers from, so a correction here teaches the
 * real thing. Owner and admins only.
 */
export const teachAssistant = onCall(
  // Doha: the owner waits on every reply while teaching.
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60, region: 'me-central1' },
  async (request) => {
    const email = String(request.auth?.token?.email ?? '').toLowerCase();
    if (!email) throw new HttpsError('unauthenticated', 'Sign in first.');

    const db = getFirestore();
    const site = (await db.doc('settings/site').get()).data() ?? {};
    const admins = [
      ...OWNER_EMAILS,
      ...(Array.isArray(site.extraAdminEmails) ? site.extraAdminEmails.map(String) : []),
    ].map((e) => e.toLowerCase());
    if (!admins.includes(email)) {
      throw new HttpsError('permission-denied', 'Only the owner can teach the assistant.');
    }

    const key = (ANTHROPIC_API_KEY.value() || '').trim();
    if (!key.startsWith('sk-ant-')) {
      throw new HttpsError('failed-precondition', 'No AI key is connected yet.');
    }

    const raw = Array.isArray(request.data?.messages) ? request.data.messages : [];
    const turns = (raw as { role?: string; content?: string }[])
      .slice(-20)
      .map((m) => ({
        role: m?.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: String(m?.content ?? '').slice(0, 2000),
      }))
      .filter((m) => m.content.trim());
    if (!turns.length || turns[turns.length - 1].role !== 'user') {
      throw new HttpsError('invalid-argument', 'Say something first.');
    }

    const cfgRef = db.doc('settings/assistant');
    const cfg = (await cfgRef.get()).data() ?? {};
    const facts = await loadShopFacts(db, String(cfg.knowledge ?? ''));

    const system = [
      IDENTITY,
      '',
      'You are IN TRAINING with the shop owner right now — this is the owner speaking, not a customer.',
      'Rules:',
      "- Reply in the customer's language. When they write Arabic, speak IRAQI dialect (اللهجة العراقية البغدادية) — NEVER Levantine, Gulf or Egyptian.",
      '- Iraqi words to use: هنا، شكد، اكو، ماكو، شنو، شلون، هواية، زين، احنه، نكَول/نكول، يمعوّد، تدلل، على عيني.',
      '- Words you must NEVER use (wrong dialect): هون، هيك، كتير، هلق، بدك، شو (Levantine) — وش، يبغى، وايد (Gulf) — ازيك، عايز (Egyptian).',
      '- Formal Modern Standard Arabic is fine for technical sentences; the friendly words around them must be Iraqi.',
      '- Be brief and natural, like a keen new employee talking to his boss.',
      '- When the owner asks what you know about something, answer honestly and only from the facts below; if you have nothing on it, say so plainly and ask them to teach you.',
      '- When the owner asks a test question, answer it exactly as you would answer a real customer.',
      '- When the owner corrects you or states a new fact about the shop (hours, address, delivery, warranty, policies…), acknowledge briefly, then append each fact at the END of your reply, each on its own line, in exactly this format:',
      'SAVE: <the fact, one clear sentence, in the language the owner wrote it>',
      '- SAVE only shop facts the owner stated. Never SAVE questions, greetings, or your own guesses. When the owner contradicts an existing note, SAVE the corrected version.',
      facts,
    ].join('\n');

    const rawReply = await askClaude(
      key,
      String(cfg.model ?? '') || 'claude-sonnet-5',
      system,
      turns,
      800,
    ).catch((e) => {
      throw new HttpsError('internal', e instanceof Error ? e.message : 'The AI did not answer.');
    });

    const learned: string[] = [];
    const shown: string[] = [];
    for (const line of rawReply.split('\n')) {
      const m = /^\s*SAVE:\s*(.+)$/.exec(line);
      if (m && m[1].trim()) learned.push(m[1].trim());
      else if (!/^\s*PRODUCT:/.test(line)) shown.push(line);
    }
    const reply = shown.join('\n').trim();

    if (learned.length) {
      const knowledge = String(cfg.knowledge ?? '').trimEnd();
      const next = (knowledge ? knowledge + '\n' : '') + learned.join('\n');
      await cfgRef.set({ knowledge: next }, { merge: true });
    }

    return { reply: reply || (learned.length ? 'تم، حفظتها. 👍' : ''), learned };
  },
);

/**
 * Read the shop's own history and write down what it teaches.
 *
 * Months of chats hold the answers the team gives every week — delivery
 * fees, working hours, what fits a 30-amp house. This reads them, asks
 * Claude for the durable facts (never a price it can look up, never
 * one customer's private business), and adds anything new to the
 * assistant's notes. The owner sees exactly what was added and can
 * delete any line.
 */
export const learnFromChats = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, region: 'me-central1', memory: '512MiB' },
  async (request) => {
    const email = String(request.auth?.token?.email ?? '').toLowerCase();
    if (!email) throw new HttpsError('unauthenticated', 'Sign in first.');
    const db = getFirestore();
    const site = (await db.doc('settings/site').get()).data() ?? {};
    const admins = [
      ...OWNER_EMAILS,
      ...(Array.isArray(site.extraAdminEmails) ? site.extraAdminEmails.map(String) : []),
    ].map((e) => e.toLowerCase());
    if (!admins.includes(email)) {
      throw new HttpsError('permission-denied', 'Only the owner can do this.');
    }

    const key = (ANTHROPIC_API_KEY.value() || '').trim();
    if (!key.startsWith('sk-ant-')) {
      throw new HttpsError('failed-precondition', 'No AI key is connected yet.');
    }

    // The conversations, oldest message first within each, staff answers
    // included — those are the ones worth learning from.
    const chats = await db.collection('chats').orderBy('lastAt', 'desc').limit(120).get();
    const transcripts: string[] = [];
    for (const chat of chats.docs) {
      const msgs = await chat.ref.collection('messages').orderBy('at', 'asc').limit(40).get();
      const lines = msgs.docs
        .map((m) => {
          const d = m.data();
          const text = String(d.text ?? '').replace(/\s+/g, ' ').trim();
          if (!text) return '';
          if (d.from === 'guest') return `Customer: ${text.slice(0, 240)}`;
          if (d.by === ASSISTANT_BY) return '';           // never learn from itself
          return `Colleague: ${text.slice(0, 240)}`;
        })
        .filter(Boolean);
      if (lines.length >= 2) transcripts.push(lines.join('\n'));
    }
    if (!transcripts.length) {
      return { learned: [], reviewed: 0, note: 'No conversations to learn from yet.' };
    }

    const cfgRef = db.doc('settings/assistant');
    const cfg = (await cfgRef.get()).data() ?? {};
    const known = String(cfg.knowledge ?? '');

    const system = [
      'You are reading a shop\'s customer-chat history to write its staff handbook.',
      'Extract only DURABLE facts about how this business operates — the things a new employee would need told once:',
      'working hours, address and directions, delivery areas and fees, warranty terms, what installation includes, payment and instalment conditions, brands carried, common technical guidance the team repeats.',
      'Rules:',
      '- Write each fact as one short sentence, in the language the team used (usually Iraqi Arabic).',
      '- NEVER include a specific product price — the assistant reads live prices already.',
      '- NEVER include a customer name, phone number, address or anything private to one person.',
      '- Skip anything already covered by the existing notes below.',
      '- Skip greetings, one-off promises, and anything you are unsure about.',
      '- Output ONLY the facts, one per line, no numbering, no preamble. If there is nothing new, output nothing.',
      '',
      'EXISTING NOTES:',
      known || '(none yet)',
    ].join('\n');

    const reply = await askClaude(
      key,
      String(cfg.model ?? '') || 'claude-sonnet-5',
      system,
      [{ role: 'user', content: transcripts.join('\n---\n').slice(0, 120_000) }],
      1500,
    ).catch((e) => {
      throw new HttpsError('internal', e instanceof Error ? e.message : 'The AI did not answer.');
    });

    const learned = reply
      .split('\n')
      .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
      .filter((l) => l.length > 8 && !/^\(/.test(l))
      .slice(0, 40);

    if (learned.length) {
      const next = (known.trimEnd() ? known.trimEnd() + '\n' : '') + learned.join('\n');
      await cfgRef.set({ knowledge: next }, { merge: true });
    }
    return { learned, reviewed: transcripts.length };
  },
);
