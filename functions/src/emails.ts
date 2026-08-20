/**
 * The account emails, written here rather than in the Firebase console.
 *
 * Firebase locked template editing on this project, and its own templates
 * arrive from noreply@alwaidh-baeb5.firebaseapp.com — a domain with no
 * relationship to the shop, which is most of why they land in spam. These
 * carry the same links (see sendAccountEmail), from our own address.
 *
 * Email clients are twenty years behind browsers: layout is tables, every
 * style is inline, and the "button" is a padded link in a coloured cell.
 * Each message says its piece in English and Arabic, because we don't know
 * which the reader speaks.
 */

export type EmailKind = 'verify' | 'reset' | 'change';

const BRAND = '#2563eb';
const LOGO = 'https://alwaidh.com/pwa-192.png';

interface Copy {
  subject: string;
  headingEn: string;
  bodyEn: string;
  buttonEn: string;
  headingAr: string;
  bodyAr: string;
  buttonAr: string;
  footerEn: string;
  footerAr: string;
}

function copyFor(kind: EmailKind, email: string): Copy {
  if (kind === 'reset') {
    return {
      subject: 'Reset your Alwaidh password — إعادة تعيين كلمة المرور',
      headingEn: 'Choose a new password',
      bodyEn: `Someone asked to reset the password for <strong style="color:#0f172a;">${email}</strong>. Tap below to choose a new one. The link works once, and stops working after an hour.`,
      buttonEn: 'Set a new password',
      headingAr: 'اختر كلمة مرور جديدة',
      bodyAr: `وردنا طلب لإعادة تعيين كلمة المرور لحساب <strong style="color:#0f172a;">${email}</strong>. اضغط الزر أدناه لاختيار كلمة مرور جديدة. الرابط يعمل مرة واحدة وينتهي خلال ساعة.`,
      buttonAr: 'تعيين كلمة المرور',
      footerEn: "Didn't ask for this? Ignore this email — your password stays as it is.",
      footerAr: 'لم تطلب هذا؟ تجاهل الرسالة وستبقى كلمة المرور كما هي.',
    };
  }
  if (kind === 'change') {
    return {
      subject: 'Confirm your new email address — أكّد بريدك الجديد',
      headingEn: 'Confirm your new email address',
      bodyEn: `The email address on your Alwaidh account is being changed to <strong style="color:#0f172a;">${email}</strong>. Tap below to confirm it.`,
      buttonEn: 'Confirm the change',
      headingAr: 'أكّد بريدك الجديد',
      bodyAr: `يجري تغيير البريد الإلكتروني لحسابك في الوائض إلى <strong style="color:#0f172a;">${email}</strong>. اضغط الزر أدناه للتأكيد.`,
      buttonAr: 'تأكيد التغيير',
      footerEn: "Didn't ask for this? Ignore this email and contact us — your address stays as it is.",
      footerAr: 'لم تطلب هذا؟ تجاهل الرسالة وتواصل معنا، وسيبقى بريدك كما هو.',
    };
  }
  return {
    subject: 'Confirm your email for Alwaidh — أكّد بريدك الإلكتروني',
    headingEn: 'Confirm your email address',
    bodyEn: `Tap the button below to confirm <strong style="color:#0f172a;">${email}</strong> and finish setting up your Alwaidh account.`,
    buttonEn: 'Confirm my email',
    headingAr: 'أكّد بريدك الإلكتروني',
    bodyAr: `اضغط الزر أدناه لتأكيد <strong style="color:#0f172a;">${email}</strong> وإكمال إنشاء حسابك في الوائض.`,
    buttonAr: 'تأكيد البريد',
    footerEn: 'Didn\'t ask for this? You can safely ignore this email — nothing will change.',
    footerAr: 'لم تطلب هذا؟ تجاهل الرسالة ولن يتغيّر أي شيء.',
  };
}

/** Keep whatever a person typed out of the markup. */
function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildEmail(
  kind: EmailKind,
  email: string,
  link: string,
): { subject: string; html: string; text: string } {
  const c = copyFor(kind, escape(email));
  const href = escape(link);
  const button = (label: string) => `
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:${BRAND};border-radius:9px;">
                  <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a>
                </td>
              </tr>
            </table>`;

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escape(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="background:${BRAND};padding:22px 28px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:12px;">
                  <img src="${LOGO}" width="34" height="34" alt="" style="display:block;border-radius:8px;background:#ffffff;" />
                </td>
                <td style="color:#ffffff;font-size:19px;font-weight:700;">Alwaidh</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px 8px 28px;">
            <h1 style="margin:0 0 12px 0;font-size:21px;line-height:1.35;color:#0f172a;font-weight:800;">${c.headingEn}</h1>
            <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:#475569;">${c.bodyEn}</p>
${button(c.buttonEn)}
            <p style="margin:22px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
              If the button doesn't work, copy this address into your browser:<br />
              <a href="${href}" style="color:${BRAND};word-break:break-all;">${href}</a>
            </p>
          </td>
        </tr>
        <tr><td style="padding:26px 28px 0 28px;"><div style="height:1px;background:#e2e8f0;line-height:1px;">&nbsp;</div></td></tr>
        <tr>
          <td dir="rtl" style="padding:22px 28px 30px 28px;text-align:right;">
            <h2 style="margin:0 0 10px 0;font-size:19px;line-height:1.4;color:#0f172a;font-weight:800;">${c.headingAr}</h2>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#475569;">${c.bodyAr}</p>
${button(c.buttonAr)}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px;">
            <p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:#94a3b8;">
              ${c.footerEn}<br /><span dir="rtl">${c.footerAr}</span>
            </p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
              Al-Waidh Technology Trading Co. · Sinaa Street, Baghdad, Iraq<br />
              <a href="https://alwaidh.com" style="color:${BRAND};text-decoration:none;">alwaidh.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  // A plain-text part isn't decoration: a message without one is far more
  // likely to be treated as spam.
  const text = `${c.headingEn}\n\n${c.bodyEn.replace(/<[^>]+>/g, '')}\n\n${link}\n\n${c.footerEn}\n\nAl-Waidh Technology Trading Co. — alwaidh.com`;

  return { subject: c.subject, html, text };
}
