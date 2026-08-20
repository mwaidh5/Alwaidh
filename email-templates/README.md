# Account emails

The only emails the site sends are the ones Firebase Authentication sends
itself — there is no mail code in this repo. Firebase writes them from
`noreply@alwaidh-baeb5.firebaseapp.com` with a plain body, which is why
they look unbranded and often land in spam: the sending domain has nothing
to do with alwaidh.com, so a spam filter has no reason to trust it.

Two separate things fix that. Do the domain first — a beautiful email from
a stranger's address still goes to spam.

## 1. Send from alwaidh.com

Firebase Console → **Authentication** → **Templates** → pencil icon →
**Customize domain**, enter `alwaidh.com`, then add the TXT and CNAME
records it gives you at whoever hosts the domain's DNS. Verification can
take up to 24 hours; when the console shows "Verification complete", press
**Apply custom domain**.

Note on SPF: a domain may only have **one** `v=spf1` TXT record. If one
already exists, merge Firebase's include into it rather than adding a
second — two records make every check fail, which is worse than none.

## 2. Use these templates

In the same editor, each template has a **Message (HTML)** body. Paste the
matching file in:

| Firebase template      | File                  |
| ---------------------- | --------------------- |
| Address verification   | `verify-email.html`   |
| Password reset         | `password-reset.html` |
| Email address change   | `email-change.html`   |

Firebase fills in the placeholders: `%LINK%` (the action link — required),
`%EMAIL%`, `%NEW_EMAIL%`, `%DISPLAY_NAME%`, `%APP_NAME%`.

Also set the sender name to **Alwaidh** in the same editor, so the inbox
shows a name rather than an address.

### Why they're built this way

Email clients are twenty years behind browsers. Layout is tables, every
style is inline (Gmail and Outlook drop stylesheets), and the button is a
padded link inside a coloured cell rather than a real button. Each message
carries English and Arabic together, because we don't know which the
reader speaks. The logo is pulled from `https://alwaidh.com/pwa-192.png`,
so it keeps working as long as the site does.

Open any of these files in a browser to see roughly how they land — that
preview is close, though real clients vary.
