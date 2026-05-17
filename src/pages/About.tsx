import { useState } from 'react';
import { submitContact, storageMode } from '../lib/contactSubmissions';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function About() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg('Please fill in your name, email, and message.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      await submitContact({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject: subject.trim() || undefined,
        message: message.trim(),
      });
      setStatus('success');
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send your message. Please try again.');
    }
  }

  const mode = storageMode();

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <div className="container-page py-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">About us</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            Power, IT, and security — under one roof.
          </h1>
          <p className="mt-3 max-w-2xl text-white/90">
            Alwaidh supplies and installs reliable computer systems, solar energy solutions, and
            Tiandy security cameras. We help homes, offices, and businesses choose the right gear
            and keep it running.
          </p>
        </div>
      </section>

      <section className="container-page grid gap-10 py-12 lg:grid-cols-2">
        <div className="space-y-6">
          <Block
            icon="💡"
            title="Who we are"
            body="A small team of engineers and technicians passionate about practical, dependable technology. We have hands-on experience designing computer rollouts, sizing solar systems, and deploying CCTV networks."
          />
          <Block
            icon="🎯"
            title="What we do"
            body="From a single laptop to a full off-grid solar build, we source quality components, deliver them quickly, and back them with honest support."
          />
          <Block
            icon="🤝"
            title="Why customers stay with us"
            body="Straight answers, fair prices, and real support after the sale. We carry brands we'd install in our own homes."
          />
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-slate-900">Contact us</h2>
          <p className="mt-1 text-sm text-slate-600">
            Have a question or want a quote? Send us a message and we'll get back to you.
          </p>

          {status === 'success' ? (
            <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-semibold">Thanks — we received your message.</p>
              <p className="mt-1">We'll be in touch shortly.</p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="mt-3 text-sm font-semibold text-green-900 underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <Field label="Name" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" required>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    required
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Subject (optional)">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                  placeholder="e.g. Solar quote, camera install"
                />
              </Field>
              <Field label="Message" required>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input"
                  required
                />
              </Field>

              {status === 'error' && errorMsg && (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-primary w-full justify-center sm:w-auto"
              >
                {status === 'submitting' ? 'Sending…' : 'Send message'}
              </button>

              {mode === 'local' && (
                <p className="text-xs text-slate-500">
                  Note: Firebase isn't configured, so submissions are stored locally in this browser
                  only. Add your Firebase config to <code>.env</code> to enable cross-device storage.
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function Block({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
      </div>
      <p className="mt-2 text-slate-600">{body}</p>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
