import { useSettings } from '../lib/useSettings';

/**
 * Privacy policy. Required by Google Play and the App Store, and linked
 * from the footer. It describes what this site and the staff app actually
 * do — keep it in step with the code if data handling changes.
 */
export default function Privacy() {
  const settings = useSettings();
  const store = settings.storeName || 'Alwaidh';
  const email = settings.contactEmail || 'hello@alwaidh.com';
  const phone = settings.supportPhone;

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">
          Applies to the {store} website and the “{store} Staff” mobile app.
        </p>

        <div className="mt-8 space-y-8 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">Who we are</h2>
            <p className="mt-2">
              {store} sells and installs computers, solar energy systems, and security cameras. You
              can reach us at{' '}
              <a href={`mailto:${email}`} className="font-semibold text-brand-700 hover:underline">
                {email}
              </a>
              {phone ? ` or ${phone}` : ''}.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">What we collect</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <span className="font-semibold">Account details.</span> If you create an account or
                sign in with Google, we receive your email address and display name so we can
                identify you and protect your account.
              </li>
              <li>
                <span className="font-semibold">Order and enquiry details.</span> If you place an
                order or send us a message, we keep what you submitted — such as your name, phone
                number, and delivery address — so we can fulfil it.
              </li>
              <li>
                <span className="font-semibold">Work records (staff only).</span> Employees using
                the staff app record customer job details, product information, prices, and photos
                needed to run installations and the catalogue.
              </li>
              <li>
                <span className="font-semibold">Usage data.</span> We use Google Analytics for
                Firebase to understand which pages and products are viewed, so we can improve the
                site. This is aggregate usage information, not used to build advertising profiles.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">Photos and files</h2>
            <p className="mt-2">
              The staff app can upload photos and documents (for example product images, datasheets,
              and installation invoices) that employees choose to add. Images may be processed on
              the device — background removal runs entirely in the browser and the photo is not sent
              to any third party for that step. Uploaded files are stored in our Firebase Storage
              account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">How we use it</h2>
            <p className="mt-2">
              We use this information only to operate the shop and our installation service: to show
              you products, process and deliver orders, answer enquiries, schedule and track work,
              and keep the service secure. We do not sell your personal information, and we do not
              use it for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">Who processes it</h2>
            <p className="mt-2">
              Our website, database, file storage, and sign-in are provided by{' '}
              <span className="font-semibold">Google Firebase</span> (Google LLC), which stores this
              data on our behalf. Signing in with Google is handled by Google. We do not share your
              information with anyone else except where we must by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">How long we keep it</h2>
            <p className="mt-2">
              We keep account, order, and job records for as long as needed to run the business and
              meet our legal and accounting obligations. You may ask us to delete your account and
              associated personal information at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">Your choices</h2>
            <p className="mt-2">
              You can ask us to show, correct, or delete the personal information we hold about you,
              or to close your account, by emailing{' '}
              <a href={`mailto:${email}`} className="font-semibold text-brand-700 hover:underline">
                {email}
              </a>
              . The staff app is for our employees only and is not intended for children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">Changes</h2>
            <p className="mt-2">
              If we change how we handle information, we will update this page. Please check back
              from time to time.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
