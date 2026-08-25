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

export interface OrderEmailInput {
  id: string;
  customerName: string;
  lines: { name: string; quantity: number; price: number }[];
  subtotal: number;
  currency: string;
  shippingAddress?: string;
}

/**
 * "We got your order" — the receipt in both languages, with the item
 * table once in the middle (numbers read the same either way) and a
 * tracking button above and below it.
 */
export function buildOrderEmail(
  o: OrderEmailInput,
  trackUrl: string,
): { subject: string; html: string; text: string } {
  const ref = escape(o.id.slice(0, 8).toUpperCase());
  const name = escape(o.customerName.split(' ')[0] || o.customerName || '');
  const href = escape(trackUrl);
  const money = (n: number) => `${Math.round(n).toLocaleString('en-GB')} ${escape(o.currency)}`;

  const rows = o.lines
    .map(
      (l) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">${escape(l.name)}</td>
                <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;white-space:nowrap;" align="center">× ${l.quantity}</td>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#0f172a;white-space:nowrap;" align="right">${money(l.price * l.quantity)}</td>
              </tr>`,
    )
    .join('');

  const button = (label: string) => `
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:${BRAND};border-radius:9px;">
                  <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a>
                </td>
              </tr>
            </table>`;

  const subject = `Your Alwaidh order ${ref} — تم استلام طلبك`;
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escape(subject)}</title></head>
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
            <h1 style="margin:0 0 12px 0;font-size:21px;line-height:1.35;color:#0f172a;font-weight:800;">Thanks for your order, ${name}!</h1>
            <p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:#475569;">We've received it and will be in touch to confirm payment and delivery. Your order reference is <strong style="color:#0f172a;font-family:monospace;">${ref}</strong>.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 28px 6px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:.06em;color:#94a3b8;text-transform:uppercase;">Your items · طلبك</td>
                <td></td><td></td>
              </tr>${rows}
              <tr>
                <td style="padding:12px 0 0 0;font-size:14px;font-weight:700;color:#0f172a;">Total · المجموع</td>
                <td></td>
                <td style="padding:12px 0 0 0;font-size:16px;font-weight:800;color:${BRAND};white-space:nowrap;" align="right">${money(o.subtotal)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 28px 8px 28px;">
${button('Track your order')}
            <p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
              If the button doesn't work, copy this address into your browser:<br />
              <a href="${href}" style="color:${BRAND};word-break:break-all;">${href}</a>
            </p>
          </td>
        </tr>
        <tr><td style="padding:24px 28px 0 28px;"><div style="height:1px;background:#e2e8f0;line-height:1px;">&nbsp;</div></td></tr>
        <tr>
          <td dir="rtl" style="padding:22px 28px 30px 28px;text-align:right;">
            <h2 style="margin:0 0 10px 0;font-size:19px;line-height:1.4;color:#0f172a;font-weight:800;">شكراً لطلبك يا ${name}!</h2>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#475569;">استلمنا طلبك وسنتواصل معك لتأكيد الدفع والتوصيل. رقم الطلب: <strong style="color:#0f172a;font-family:monospace;" dir="ltr">${ref}</strong>. يمكنك متابعة حالة الطلب من الزر أدناه في أي وقت.</p>
${button('تتبع طلبك')}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px;">
            <p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:#94a3b8;">
              Questions? Just reply to this email or use the chat on our site.<br /><span dir="rtl">عندك سؤال؟ رد على هذه الرسالة أو استخدم المحادثة في موقعنا.</span>
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

  const itemsText = o.lines.map((l) => `- ${l.name} × ${l.quantity} — ${money(l.price * l.quantity)}`).join('\n');
  const text = `Thanks for your order, ${o.customerName}!\n\nOrder reference: ${o.id.slice(0, 8).toUpperCase()}\n\n${itemsText}\nTotal: ${money(o.subtotal)}\n\nTrack your order: ${trackUrl}\n\nAl-Waidh Technology Trading Co. — alwaidh.com`;

  return { subject, html, text };
}
