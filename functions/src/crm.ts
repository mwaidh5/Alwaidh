import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { OWNER_EMAILS, pushUsers } from './notify';

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

  const site = (await db.doc('settings/site').get()).data() ?? {};
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : []);
  const admins = [...OWNER_EMAILS, ...list(site.extraAdminEmails)];
  const holders: Record<'solar' | 'computers', string[]> = {
    solar: [...new Set([...admins, ...list(site.crmSolarEmails)])],
    computers: [...new Set([...admins, ...list(site.crmComputerEmails)])],
  };

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
