import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { OWNER_EMAILS, pushUsers } from './notify';

/** Who holds each CRM book, read fresh from settings. */
async function crmHolders(): Promise<Record<'solar' | 'computers', string[]>> {
  const site = (await getFirestore().doc('settings/site').get()).data() ?? {};
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : []);
  const admins = [...OWNER_EMAILS, ...list(site.extraAdminEmails)];
  return {
    solar: [...new Set([...admins, ...list(site.crmSolarEmails)])],
    computers: [...new Set([...admins, ...list(site.crmComputerEmails)])],
  };
}

/**
 * A Facebook ad lead becomes a CRM contact: tagged Facebook, the ad's
 * campaign name as the interest, filed in the book the campaign slug
 * names — and the book's holders get a ping while the lead is hot.
 */
export const leadToCrm = onDocumentCreated('leads/{leadId}', async (event) => {
  const lead = event.data?.data();
  if (!lead) return;
  const db = getFirestore();
  const section = lead.section === 'computers' ? 'computers' : 'solar';
  const name = String(lead.name ?? '').trim().slice(0, 80);
  const phone = String(lead.phone ?? '').trim().slice(0, 24);
  const campaign = String(lead.campaign ?? 'facebook').slice(0, 60);
  if (!name || !phone) return;

  await db.collection('crmContacts').add({
    section,
    name,
    phone,
    city: String(lead.city ?? '').slice(0, 80),
    tag: 'Facebook',
    interest: campaign,
    source: campaign,
    status: 'new',
    notes: [],
    order: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: 'facebook-ad',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'facebook-ad',
  });
  await event.data?.ref.set({ copiedToCrm: true }, { merge: true }).catch(() => undefined);

  const holders = await crmHolders();
  await pushUsers(
    holders[section],
    '',
    'messages',
    `📇 New Facebook lead: ${name}`,
    [phone, String(lead.city ?? '').trim(), campaign].filter(Boolean).join(' · ').slice(0, 90),
    '/admin/crm',
    'staff-messages',
  );
});

/**
 * The CRM's alarm clock: every hour, any contact whose follow-up time
 * has arrived (and hasn't been announced yet) is pushed to the staff who
 * hold that book. Re-setting a reminder clears the announced mark, so a
 * moved date rings again.
 */
export const crmReminderSweep = onSchedule('every 60 minutes', async () => {
  const db = getFirestore();
  const now = Date.now();
  const snap = await db.collection('crmContacts').where('remindAtMs', '<=', now).get();
  if (snap.empty) return;

  const holders = await crmHolders();

  for (const d of snap.docs) {
    const c = d.data();
    if (typeof c.remindedAtMs === 'number' && c.remindedAtMs >= Number(c.remindAtMs)) continue;
    const name = String(c.name ?? '').trim().slice(0, 40) || String(c.phone ?? '');
    const detail = [c.interest, c.phone]
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .join(' · ')
      .slice(0, 80);
    await pushUsers(
      holders[c.section === 'computers' ? 'computers' : 'solar'],
      '',
      'messages',
      `🔔 Follow up: ${name}`,
      detail || 'CRM reminder',
      '/admin/crm',
      'staff-messages',
    );
    await d.ref.set({ remindedAtMs: now }, { merge: true });
  }
});
