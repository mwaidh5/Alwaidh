import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './lib/i18n';
import './index.css';
import { keepFresh } from './lib/swUpdate';

// After a deploy, a page that was already open still references lazy-loaded
// chunks from the previous build, which no longer exist on the server. Vite
// fires this event when such a chunk fails — reload once to pick up the new
// build (guarded so a genuinely broken network can't cause a reload loop).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const last = Number(sessionStorage.getItem('chunk-reload-at') ?? 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem('chunk-reload-at', String(Date.now()));
    window.location.reload();
  }
});

keepFresh();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
