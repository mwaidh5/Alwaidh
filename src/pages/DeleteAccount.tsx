import { Link } from 'react-router-dom';
import { useSettings } from '../lib/useSettings';

/**
 * How to delete your account — the public page Google Play requires
 * beside the in-app button, and the address that goes in its Data safety
 * form. It has to be reachable without the app and without signing in,
 * so it explains both ways: the button in the app, and an email for
 * anyone who no longer has access.
 */
export default function DeleteAccount() {
  const settings = useSettings();
  const store = settings.storeName || 'Alwaidh';
  const email = settings.contactEmail || 'support@alwaidh.com';

  return (
    <div className="container-page py-12">
      <div dir="ltr" className="mx-auto max-w-3xl text-left">
        <h1 className="text-3xl font-extrabold text-slate-900">Delete your account</h1>
        <p className="mt-2 text-sm text-slate-500">
          Applies to accounts on the {store} website and the {store} mobile apps.
        </p>

        <div className="mt-8 space-y-8 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">From the app or the website</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              <li>
                Sign in and open{' '}
                <Link to="/account" className="font-semibold text-brand-700 hover:underline">
                  My account
                </Link>
                .
              </li>
              <li>
                Scroll to <span className="font-semibold">Delete my account</span> (حذف حسابي).
              </li>
              <li>
                Type <span className="font-mono font-semibold">DELETE</span> and confirm. If you
                signed in with Apple or Google, their sign-in sheet appears once to prove it is you.
              </li>
            </ol>
            <p className="mt-2">The account is erased immediately. There is no undo.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">If you can no longer sign in</h2>
            <p className="mt-2">
              Email{' '}
              <a href={`mailto:${email}?subject=Delete%20my%20account`} className="font-semibold text-brand-700 hover:underline">
                {email}
              </a>{' '}
              from the address on the account, with the subject “Delete my account”. We delete it
              within 7 days and reply to confirm.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">What is deleted</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Your sign-in (email and password, Google, or Apple) and your profile — name, email, phone, saved address.</li>
              <li>Your saved items and any device registered for notifications.</li>
              <li>For Sign in with Apple, the token Apple issued to us is revoked with Apple.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">What is kept</h2>
            <p className="mt-2">
              Orders you already placed, and installation work already done, stay with the shop as
              business records — the law requires us to keep invoices — but they are no longer
              linked to a sign-in. Nothing else is retained.
            </p>
          </section>

          <section>
            <p>
              See also our{' '}
              <Link to="/privacy" className="font-semibold text-brand-700 hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
