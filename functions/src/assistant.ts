import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/** The account the bot's replies are filed under — never a real inbox. */
const ASSISTANT_BY = 'assistant@alwaidh.com';

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

    // What the shop knows, fetched fresh so a price is never stale.
    const [prodSnap, sheetSnap, instSnap] = await Promise.all([
      db.collection('products').get(),
      db.collection('solarPrices').orderBy('order').get(),
      db.collection('solarInstallments').orderBy('order').get(),
    ]);

    const products = prodSnap.docs
      .map((d) => d.data())
      .filter((p) => !p.draft)
      .map((p) => {
        const names = [p.name, p.nameAr].filter(Boolean).join(' / ');
        const stock = p.inStock ? 'in stock' : p.comingSoon ? 'coming soon' : 'out of stock';
        return `${names} — ${Number(p.price ?? 0).toLocaleString('en-US')} IQD — ${stock}`;
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

    const system = [
      'You are the customer assistant for Alwaidh (الواعظ للقدرة) — a Baghdad shop for solar energy systems, computers, and Tiandy security cameras. Website: alwaidh.com. Phone/WhatsApp: +964 774 420 5582. Email: support@alwaidh.com.',
      '',
      'Rules:',
      "- Reply in the customer's language (Iraqi Arabic when they write Arabic).",
      '- Be brief, warm and concrete: one to four sentences unless listing prices.',
      '- Use ONLY the facts below. NEVER invent prices, stock, discounts or promises.',
      '- If the answer is not in the facts, or the customer wants to negotiate, complain, place an order through chat, or clearly needs a person — say a colleague from the team will reply here soon, and stop.',
      '- Prices are in Iraqi dinar (IQD).',
      '- Solar installments (Central Bank initiative, 1–7 year plans): the listed price7 is the 7-year total. Cash price = price7 ÷ 1.21. An N-year plan totals cash × (1 + 0.03 × N); monthly = total ÷ (12 × N).',
      '',
      "OWNER'S NOTES (highest authority — follow these over anything else):",
      String(cfg.knowledge ?? '(none yet)'),
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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: String(cfg.model ?? '') || 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        messages: turns,
      }),
    });
    if (!res.ok) {
      console.warn('assistant: API refused', res.status, (await res.text()).slice(0, 300));
      return;
    }
    const out = (await res.json()) as { content?: { type: string; text?: string }[] };
    const reply = (out.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    if (!reply) return;

    // Filed as staff so the widget styles it like a team reply; the staff
    // unread count is left alone so a person still reviews the thread.
    await db.collection(`chats/${chatId}/messages`).add({
      from: 'staff',
      by: ASSISTANT_BY,
      byName: '🤖 المساعد',
      text: reply,
      at: FieldValue.serverTimestamp(),
    });
    await db.doc(`chats/${chatId}`).set(
      {
        lastText: reply,
        lastFrom: 'staff',
        lastAt: FieldValue.serverTimestamp(),
        unreadForGuest: FieldValue.increment(1),
      },
      { merge: true },
    );
  },
);
