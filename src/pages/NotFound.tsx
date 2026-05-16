import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">404</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">The page you’re looking for doesn’t exist or has moved.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">Back to home</Link>
    </div>
  );
}
