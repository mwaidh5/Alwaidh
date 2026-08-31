import type { CrmContact } from './crmStore';

/**
 * The CRM book as a standard contacts file (vCard 3.0): one tap hands it
 * to the phone, the phone's own Contacts app imports it, and from then
 * on a customer's call shows their CRM name on screen — the Zoho trick,
 * without asking the phone for any contacts permission.
 */

function esc(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[;,]/g, (c) => '\\' + c);
}

/** "07701234567" → "+9647701234567" — the shape caller ID presents, so
 *  the phone can actually match the incoming call to the card. */
function e164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^07\d{9}$/.test(digits)) return '+964' + digits.slice(1);
  if (/^009647\d{9}$/.test(digits)) return '+' + digits.slice(2);
  if (/^9647\d{9}$/.test(digits)) return '+' + digits;
  return digits || raw;
}

export function crmVcf(contacts: CrmContact[]): Blob {
  const cards = contacts
    .filter((c) => c.phone.trim() && (c.name.trim() || c.phone.trim()))
    .map((c) => {
      const name = c.name.trim() || c.phone.trim();
      const org = c.section === 'solar' ? 'الواعظ · طاقة شمسية' : 'الواعظ · حاسبات';
      const note = [c.interest, c.city, c.tag].map((v) => v.trim()).filter(Boolean).join(' — ');
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:;${esc(name)};;;`,
        `FN:${esc(name)}`,
        `TEL;TYPE=CELL:${e164(c.phone)}`,
        `ORG:${esc(org)}`,
        note ? `NOTE:${esc(note)}` : '',
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\r\n');
    });
  return new Blob([cards.join('\r\n') + '\r\n'], { type: 'text/vcard' });
}
