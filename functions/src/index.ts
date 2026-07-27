/**
 * Push notifications for the Alwaidh Staff app.
 *
 * Each function watches one collection and pushes to an FCM topic; staff
 * devices subscribe to the topics their role covers (see src/lib/push.ts in
 * the web app). Topics avoid storing and expiring device tokens.
 */
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();

// Match the Firestore database's location (nam5) so triggers fire without
// crossing regions, and cap instances — this is a small shop.
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

export const TOPICS = {
  jobs: 'staff-jobs',
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
        payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } },
      },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'alwaidh-staff' },
      },
    });
    logger.info(`sent to ${topic}: ${title}`);
  } catch (err) {
    // Never let a notification failure roll back or retry the write itself.
    logger.error(`push to ${topic} failed`, err);
  }
}

/** Trim customer text so it fits a notification without leaking an essay. */
function preview(text: unknown, max = 80): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

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
