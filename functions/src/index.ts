/**
 * Push notifications for the Alwaidh Staff app.
 *
 * Each function watches one collection and pushes to an FCM topic; staff
 * devices subscribe to the topics their role covers (see src/lib/push.ts in
 * the web app). Topics avoid storing and expiring device tokens.
 */
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import { createTransport } from 'nodemailer';
import { buildEmail, type EmailKind } from './emails';

initializeApp();

// Match the Firestore database's location (nam5) so triggers fire without
// crossing regions, and cap instances — this is a small shop.
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

export const TOPICS = {
  jobs: 'staff-jobs',
  jobActivity: 'staff-job-activity',
  orders: 'staff-orders',
  messages: 'staff-messages',
} as const;

async function push(topic: string, title: string, body: string, link: string): Promise<void> {
  try {
    await getMessaging().send({
      topic,
      notification: { title, body },
      // The app reads this to open the right screen when tapped.
      data: { link },
      apns: {
        // iOS: a sound also makes the phone buzz when it's on silent.
        payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } },
        headers: { 'apns-priority': '10' },
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'alwaidh-staff',
          sound: 'default',
          // Ask for the phone's usual notification sound and buzz. The
          // channel governs this from Android 8 on, but these matter on
          // older phones and when the channel was created elsewhere.
          defaultSound: true,
          defaultVibrateTimings: true,
          priority: 'max',
        },
      },
    });
    logger.info(`sent to ${topic}: ${title}`);
  } catch (err) {
    // Never let a notification failure roll back or retry the write itself.
    logger.error(`push to ${topic} failed`, err);
  }
}

/**
 * A person's own topic, so a team message reaches exactly them. Must fold
 * emails the same way the web app does (see src/lib/push.ts).
 */
function userTopic(email: string): string {
  return `user_${String(email).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

/** Trim customer text so it fits a notification without leaking an essay. */
function preview(text: unknown, max = 80): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Point a browser at the same topics the phone app uses.
 *
 * The web SDK can't subscribe itself to a topic — only a server can — so
 * the dashboard hands its push token here and this does it. Without this,
 * a site installed from the browser only ever gets the notifications a
 * running tab draws itself, which is nothing once it's closed.
 */
export const subscribeWebPush = onCall(async (request) => {
  const token = String(request.data?.token ?? '');
  const subscribe: string[] = Array.isArray(request.data?.subscribe)
    ? request.data.subscribe.map(String)
    : [];
  const unsubscribe: string[] = Array.isArray(request.data?.unsubscribe)
    ? request.data.unsubscribe.map(String)
    : [];

  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!token) throw new HttpsError('invalid-argument', 'A push token is required.');

  const messaging = getMessaging();
  await Promise.all([
    ...subscribe.map((topic) => messaging.subscribeToTopic(token, topic)),
    ...unsubscribe.map((topic) => messaging.unsubscribeFromTopic(token, topic)),
  ]);
  logger.info(`web push: ${request.auth.token.email} +${subscribe.length} -${unsubscribe.length}`);
  return { ok: true };
});

export const notifyNewJob = onDocumentCreated('jobs/{jobId}', async (event) => {
  const job = event.data?.data();
  if (!job) return;
  const customer = preview(job.customer, 40) || 'New customer';
  const system = preview(job.system, 40);
  const kind = job.type === 'repair' ? 'Repair' : 'Install';
  await push(
    TOPICS.jobs,
    `🛠️ ${kind}: ${customer}`,
    [system, preview(job.address, 40)].filter(Boolean).join(' · ') || 'New solar job added',
    '/admin/jobs',
  );
});

/**
 * Anything that happens to a job: a comment, an edit, or a move between
 * columns. Every one of those already writes a line to the job's activity
 * log, so watching that one collection covers them all. "created" is
 * skipped — notifyNewJob has just announced it.
 */
export const notifyJobActivity = onDocumentCreated(
  'jobs/{jobId}/activity/{entryId}',
  async (event) => {
    const entry = event.data?.data();
    if (!entry || entry.kind === 'created') return;
    const snap = await getFirestore().doc(`jobs/${event.params.jobId}`).get();
    const customer = preview(snap.data()?.customer, 40) || 'a job';
    const who = preview(String(entry.by ?? '').split('@')[0], 24) || 'Someone';
    const icon = entry.kind === 'comment' ? '💬' : entry.kind === 'status' ? '🔄' : '✏️';
    await push(
      TOPICS.jobActivity,
      `${icon} ${customer}`,
      entry.kind === 'comment'
        ? `${who}: ${preview(entry.text)}`
        : `${who} — ${preview(entry.text) || 'updated this job'}`,
      '/admin/jobs',
    );
  },
);

/** An order moving through its stages (paid, shipped, cancelled…). */
export const notifyOrderUpdate = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;
  const name = preview(after.customerName, 40) || 'A customer';
  await push(
    TOPICS.orders,
    `🧾 Order ${preview(after.status, 20)}`,
    `${name}${after.customerPhone ? ` · ${preview(after.customerPhone, 20)}` : ''}`,
    '/admin/orders',
  );
});

export const notifyNewOrder = onDocumentCreated('orders/{orderId}', async (event) => {
  const order = event.data?.data();
  if (!order) return;
  const name = preview(order.customerName, 40) || 'A customer';
  const total = Number(order.subtotal ?? 0).toLocaleString();
  const currency = preview(order.currency, 8) || 'IQD';
  await push(
    TOPICS.orders,
    `🧾 New order from ${name}`,
    `${total} ${currency}${order.customerPhone ? ` · ${preview(order.customerPhone, 20)}` : ''}`,
    '/admin/orders',
  );
});

export const notifyNewChatMessage = onDocumentCreated(
  'chats/{chatId}/messages/{msgId}',
  async (event) => {
    const msg = event.data?.data();
    // Staff replies shouldn't ping the staff.
    if (!msg || msg.from !== 'guest') return;
    await push(
      TOPICS.messages,
      '💬 New chat message',
      preview(msg.text) || 'A visitor wrote in the website chat',
      '/admin/chat',
    );
  },
);

/**
 * Staff messaging. Everyone in the conversation is pinged on their own
 * topic (except the author); anyone tagged with @ gets a louder line so a
 * mention stands out in a busy group.
 */
export const notifyTeamMessage = onDocumentCreated(
  'teamChats/{chatId}/messages/{msgId}',
  async (event) => {
    const msg = event.data?.data();
    if (!msg) return;
    const chatId = event.params.chatId;
    const snap = await getFirestore().doc(`teamChats/${chatId}`).get();
    const chat = snap.data();
    if (!chat) return;

    const author = String(msg.by ?? '');
    const members: string[] = Array.isArray(chat.members) ? chat.members.map(String) : [];
    const mentions: string[] = Array.isArray(msg.mentions) ? msg.mentions.map(String) : [];
    const from = preview(author.split('@')[0], 24) || 'A colleague';
    const where = chat.name ? ` (${preview(chat.name, 24)})` : '';
    const body =
      preview(msg.text) ||
      (msg.product ? `📦 ${preview((msg.product as { name?: string }).name, 40)}` : '') ||
      (msg.job ? `🛠️ ${preview((msg.job as { customer?: string }).customer, 40)}` : '') ||
      'New message';

    await Promise.all(
      members
        .filter((m) => m && m !== author)
        .map((m) =>
          push(
            userTopic(m),
            mentions.includes(m) ? `📣 ${from} tagged you${where}` : `🗨️ ${from}${where}`,
            body,
            '/admin/team',
          ),
        ),
    );
  },
);

export const notifyNewMessage = onDocumentCreated('contactSubmissions/{id}', async (event) => {
  const msg = event.data?.data();
  if (!msg) return;
  const name = preview(msg.name, 40) || 'Someone';
  await push(
    TOPICS.messages,
    `✉️ Message from ${name}`,
    preview(msg.subject) || preview(msg.message) || 'New enquiry',
    '/admin/submissions',
  );
});


// ---------------------------------------------------------------------------
// Account emails
// ---------------------------------------------------------------------------

/**
 * Firebase sends its own verification and password-reset emails, from
 * noreply@alwaidh-baeb5.firebaseapp.com — an address with no connection to
 * the shop, which is most of why they land in spam. Its template editor is
 * also locked on this project, so they can't even be restyled in place.
 *
 * So we send them: the link is still Firebase's, minted here with admin
 * credentials, and still does exactly what Firebase's own link does. Only
 * the envelope is ours.
 */
// Plain settings, overridable from functions/.env. Only the password is a
// real secret; making the rest deploy-time params bought nothing and made
// every deploy stop to ask for them.
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || 'noreply@alwaidh.com';
// Replies go to a mailbox someone reads — noreply@ only authenticates.
const SMTP_REPLY_TO = process.env.SMTP_REPLY_TO || 'support@alwaidh.com';
const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');

const SITE = 'https://alwaidh.com';

/**
 * Rebuild the link on our own domain.
 *
 * The one-time code isn't tied to the page that opens it, so pointing it
 * at our own handler (src/pages/AuthAction.tsx) is safe — and necessary,
 * since the Action URL in the console can't be changed while templates are
 * locked. Falls back to Firebase's own link if the code can't be read.
 */
function ourLink(firebaseLink: string, kind: EmailKind): string {
  try {
    const code = new URL(firebaseLink).searchParams.get('oobCode');
    if (!code) return firebaseLink;
    const mode = kind === 'reset' ? 'resetPassword' : 'verifyEmail';
    return `${SITE}/auth/action?mode=${mode}&oobCode=${encodeURIComponent(code)}`;
  } catch {
    return firebaseLink;
  }
}

/**
 * One email a minute, ten a day, per address. This endpoint has to stay
 * open — someone locked out of their account can't authenticate to ask for
 * a reset — so without a limit it would be a way to flood any inbox.
 */
async function allowSend(email: string): Promise<boolean> {
  const ref = getFirestore().collection('mailThrottle').doc(email.replace(/[^a-z0-9]/gi, '_'));
  try {
    return await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const last = Number(snap.data()?.lastAt ?? 0);
      const count = Number(snap.data()?.count ?? 0);
      const withinDay = now - last < 24 * 60 * 60 * 1000;
      if (now - last < 60_000) return false;
      if (withinDay && count >= 10) return false;
      tx.set(ref, { lastAt: now, count: withinDay ? count + 1 : 1 }, { merge: true });
      return true;
    });
  } catch (e) {
    logger.warn('throttle check failed, allowing:', e);
    return true;
  }
}

export const sendAccountEmail = onCall({ secrets: [SMTP_PASSWORD] }, async (request) => {
  const email = String(request.data?.email ?? '').trim().toLowerCase();
  const kind: EmailKind = request.data?.kind === 'reset' ? 'reset' : 'verify';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }
  // Confirming an address is done from inside the account, so it must be
  // the signed-in one. A reset, by definition, cannot be.
  if (kind === 'verify') {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    if (String(request.auth.token.email ?? '').toLowerCase() !== email) {
      throw new HttpsError('permission-denied', 'That is not your address.');
    }
  }

  if (!(await allowSend(email))) {
    // Say nothing useful: a different answer here would tell a stranger
    // whether the address is in use.
    logger.info(`account email throttled for ${email}`);
    return { ok: true };
  }

  let link: string;
  try {
    link =
      kind === 'reset'
        ? await getAuth().generatePasswordResetLink(email, { url: `${SITE}/login` })
        : await getAuth().generateEmailVerificationLink(email, { url: `${SITE}/account` });
  } catch (e) {
    // No such account, most likely. Answer the same either way.
    logger.info(`no link for ${email}: ${e instanceof Error ? e.message : e}`);
    return { ok: true };
  }

  const { subject, html, text } = buildEmail(kind, email, ourLink(link, kind));
  const transport = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // 587 starts plain and upgrades
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD.value() },
  });

  try {
    await transport.sendMail({
      from: `"Alwaidh" <${SMTP_USER}>`,
      to: email,
      replyTo: SMTP_REPLY_TO || undefined,
      subject,
      html,
      text,
    });
  } catch (e) {
    logger.error('SMTP send failed:', e);
    // The caller falls back to Firebase's own email, so say so plainly.
    throw new HttpsError('internal', 'Could not send the email.');
  }
  logger.info(`sent ${kind} email to ${email}`);
  return { ok: true };
});
