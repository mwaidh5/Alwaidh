import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/** The account the bot's replies are filed under — never a real inbox. */
const ASSISTANT_BY = 'assistant@alwaidh.com';

/** The built-in owner; extra admins are read from settings at call time. */
const OWNER_EMAILS = ['mwaidh5@gmail.com'];

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
    '- Solar installments (Central Bank initiative, 1–7 year plans): the listed price7 is the 7-year total. Cash price = price7 ÷ 1.21. An N-year plan totals cash × (1 + 0.03 × N); monthly = total ÷ (12 × N).',
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
    timeoutSeconds: 60,
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

    // A human colleague active in the last ten minutes owns the thread.
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    if (
      history.some(
        (m) =>
          m.from === 'staff' &&
          m.by !== ASSISTANT_BY &&
          m.at instanceof Timestamp &&
          m.at.toMillis() > tenMinAgo,
      )
    ) {
      return;
    }

    const facts = await loadShopFacts(db, String(cfg.knowledge ?? ''));
    const system = [
      IDENTITY,
      '',
      'Rules:',
      "- Reply in the customer's language. When they write Arabic, speak IRAQI dialect (اللهجة العراقية البغدادية) — NEVER Levantine, Gulf or Egyptian.",
      '- Iraqi words to use: هنا، شكد، اكو، ماكو، شنو، شلون، هواية، زين، احنه، نكَول/نكول، يمعوّد، تدلل، على عيني.',
      '- Words you must NEVER use (wrong dialect): هون، هيك، كتير، هلق، بدك، شو (Levantine) — وش، يبغى، وايد (Gulf) — ازيك، عايز (Egyptian).',
      '- Formal Modern Standard Arabic is fine for technical sentences; the friendly words around them must be Iraqi.',
      '- Be brief, warm and concrete: one to four sentences unless listing prices.',
      '- Use ONLY the facts below. NEVER invent prices, stock, discounts or promises.',
      '- If the answer is not in the facts, or the customer wants to negotiate, complain, place an order through chat, or clearly needs a person — say a colleague from the team will reply here soon, and stop.',
      '- Prices are in Iraqi dinar (IQD).',
      '- When you recommend ONE specific product from the PRODUCTS list, you may attach its card: add a line at the very END of your reply, exactly:',
      'PRODUCT: <id>',
      '- At most one PRODUCT line, only an id that appears in the list, and only when the customer is looking for something to buy. The card itself shows the photo, name and price.',
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
      reply = await askClaude(key, String(cfg.model ?? '') || 'claude-haiku-4-5-20251001', system, turns, 600);
    } catch (e) {
      console.warn('assistant:', e instanceof Error ? e.message : e);
      return;
    }
    if (!reply) return;

    // A PRODUCT: <id> line at the tail becomes a real product card — the
    // same attachment staff send by hand.
    let card: Record<string, unknown> | null = null;
    const kept: string[] = [];
    for (const line of reply.split('\n')) {
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
    const body = kept.join('\n').trim();
    if (!body && !card) return;

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
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
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
      String(cfg.model ?? '') || 'claude-haiku-4-5-20251001',
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
