# Account emails

Confirmation and password-reset emails are sent by **us**, not by Firebase:
`sendAccountEmail` in `functions/src/index.ts`, with the designs in
`functions/src/emails.ts`.

That isn't the obvious arrangement, so it's worth saying why. Firebase
sends these itself by default, from `noreply@alwaidh-baeb5.firebaseapp.com`
— a domain with no relationship to the shop, which is most of the reason
they land in spam. Its template editor would let us restyle them, but it
is **locked on this project**: the console shows "Email template updates
are currently unavailable for this project". So the only way to control
the design and the sender was to send them ourselves.

What we did *not* take over is the security. The Cloud Function asks
Firebase for the same link it would have emailed
(`generateEmailVerificationLink` / `generatePasswordResetLink`), so the
one-time code is Firebase's own and still verifies the real account. Only
the envelope is ours.

The link is rewritten to point at `alwaidh.com/auth/action`
(`src/pages/AuthAction.tsx`) rather than Google's handler. A code isn't
tied to the page that opens it, which is what makes that safe — and
necessary, since the Action URL setting is locked along with the rest.

## Setting it up

Once, in the Firebase CLI:

```
firebase functions:secrets:set SMTP_PASSWORD
firebase deploy --only functions
```

The rest are plain settings in `functions/src/index.ts`, overridable with
environment variables in `functions/.env`. They are deliberately *not*
deploy-time params: nothing here is secret, and making them params meant
every non-interactive deploy stopped to ask for values it already had.

| Name | Default | Notes |
| ---- | ------- | ----- |
| `SMTP_HOST` | `smtp.hostinger.com` | |
| `SMTP_PORT` | `465` | SSL. Use `587` if the host wants STARTTLS. |
| `SMTP_USER` | `noreply@alwaidh.com` | Must be a real mailbox — it authenticates. |
| `SMTP_REPLY_TO` | `support@alwaidh.com` | Where replies land; `noreply@` is only there to authenticate. |

Moving to a different mail provider is those four values, nothing more.

## Guard rails

- **One email a minute, ten a day, per address.** A password reset can't
  require sign-in — someone locked out has no way to authenticate — so
  without a limit the endpoint would be a way to flood any inbox.
- **The reply is the same whether or not the address has an account.**
  Otherwise it would answer "does this person shop here?" for anyone who
  asked.
- **If our sending fails, the app falls back to Firebase's plain email**
  (`src/lib/accountEmail.ts`). Someone locked out needs a link far more
  than they need a pretty one.

## The HTML files here

`verify-email.html`, `password-reset.html` and `email-change.html` are the
same designs written for Firebase's own template editor, with its `%LINK%`
and `%EMAIL%` placeholders. They are **not** what gets sent — they're a
preview you can open in a browser, and what to paste into the console if
Firebase ever unlocks it. Change `functions/src/emails.ts` to change a
real email.

### Why they're built this way

Email clients are twenty years behind browsers. Layout is tables, every
style is inline (Gmail and Outlook drop stylesheets), and the button is a
padded link inside a coloured cell rather than a real button. Every
message carries a plain-text part as well, because one without it is far
more likely to be treated as spam. Each says its piece in English and
Arabic, because we don't know which the reader speaks. The logo is pulled
from `https://alwaidh.com/pwa-192.png`, so it keeps working as long as the
site does.
