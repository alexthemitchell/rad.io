import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Inject favicon links into document head so:
 *  - /assets/favicon.svg is used as the primary favicon (SVG, modern browsers)
 *  - /assets/favicon-negative.svg is used for dark-mode via prefers-color-scheme
 *
 * Files are expected at: public/assets/favicon.svg and public/assets/favicon-negative.svg
 */
function injectFavicons() {
  if (typeof document === 'undefined') return;

  const linkAttrs: Array<Record<string, string>> = [
    { rel: 'icon', type: 'image/svg+xml', href: '/assets/favicon.svg' },
    { rel: 'icon', media: '(prefers-color-scheme: dark)', href: '/assets/favicon-negative.svg' }
  ];

  // Remove any existing icon links we previously added to avoid duplicates on HMR
  const existing = document.querySelectorAll('link[data-radio-favicon]');
  existing.forEach(n => n.remove());

  linkAttrs.forEach(attrs => {
    const link = document.createElement('link');
    Object.entries(attrs).forEach(([k, v]) => link.setAttribute(k, v));
    // Mark these so they can be removed/replaced during HMR or subsequent runs
    link.setAttribute('data-radio-favicon', 'true');
    document.head.appendChild(link);
  });

  // Fallback: if the browser ignores or can't use SVG as a favicon, having
  // a /favicon.ico at the site root is still useful. Consider generating an .ico
  // from the SVGs and placing it at public/favicon.ico as a follow-up.
}

injectFavicons();

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
