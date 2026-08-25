import { Link } from 'react-router-dom';
import { useSettings } from '../lib/useSettings';
import { useLang } from '../lib/i18n';

export default function Footer() {
  // Same logo as the navbar — changing it in Settings updates both.
  const settings = useSettings();
  const { t } = useLang();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-extrabold text-brand-700">
            {settings.logoImage ? (
              <img
                src={settings.logoImage}
                alt={settings.storeName || 'Alwaidh'}
                className="h-12 w-auto"
              />
            ) : (
              <>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
                  A
                </span>
                <span>{settings.storeName || 'Alwaidh'}</span>
              </>
            )}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {t('Computers, solar energy solutions, and Tiandy security cameras — all in one shop.')}
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900">{t('Browse')}</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/shop">{t('Shop')}</Link></li>
            <li><Link className="hover:text-brand-700" to="/solar-prices">{t('Solar Prices')}</Link></li>
            <li><Link className="hover:text-brand-700" to="/cart">{t('Cart')}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900">{t('Support')}</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/about">{t('Contact us')}</Link></li>
            <li>{t('Shipping & Returns')}</li>
            <li>{t('Warranty')}</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900">{t('Company')}</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/about">{t('About')}</Link></li>
            <li><Link className="hover:text-brand-700" to="/blog">{t('Articles')}</Link></li>
            <li><Link className="hover:text-brand-700" to="/privacy">{t('Privacy')}</Link></li>
            <li>{t('Terms')}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} {settings.storeName || 'Alwaidh'}. {t('All rights reserved.')}
      </div>
    </footer>
  );
}
