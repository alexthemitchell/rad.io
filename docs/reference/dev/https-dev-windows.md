# Windows HTTPS Development Guide

This guide standardizes secure-context setup for local development on Windows.

## Scope

- Minimal secure-context path for WebUSB development
- Production-like HTTPS + COOP/COEP path for cross-origin isolation testing
- Verification and troubleshooting steps

## Prerequisites

- Windows 11 (or Windows 10 with current updates)
- Node.js LTS installed
- Chromium browser (Chrome or Edge) updated
- Local admin rights for certificate trust operations
- Repo root: `c:\Users\Owner\dev\rad.io`

## Quick Start: Minimal Secure Context

Use this path for day-to-day WebUSB and feature development.

1. Start dev server:

   ```bash
   npm start
   ```

2. Confirm served URL from task output (expected: `https://localhost:8080`).
3. Open the URL in Chrome/Edge.
4. In DevTools console, verify secure context:

   ```js
   window.isSecureContext
   ```

5. Verify WebUSB API surface is present:

   ```js
   'usb' in navigator
   ```

Expected results:

- `window.isSecureContext === true`
- `navigator.usb` exists (Chromium)

## Production-Like Path: Trusted Local Certificate

Use this path to verify behavior with browser trust and stable cert chain.

1. Install `mkcert`.
2. Initialize local CA (one-time):

   ```bash
   mkcert -install
   ```

3. Generate local cert for localhost:

   ```bash
   mkcert localhost 127.0.0.1 ::1
   ```

4. Configure local HTTPS endpoint to use generated cert and key.
5. Restart dev server and load `https://localhost:8080`.
6. Verify lock icon and certificate chain in browser certificate viewer.

Notes:

- If local tooling already provides HTTPS on localhost, cert generation may be optional.
- Keep generated cert files out of source control.

## COOP/COEP Verification (Cross-Origin Isolation)

After enabling headers (see `docs/reference/deploy/cross-origin-isolation.md`), verify in browser:

```js
window.crossOriginIsolated
```

Expected result:

- `window.crossOriginIsolated === true` in isolated mode

Optional SAB capability check:

```js
typeof SharedArrayBuffer === 'function' && window.crossOriginIsolated
```

## WebUSB + Isolation Notes

- WebUSB requires secure context.
- SAB requires both secure context and cross-origin isolation.
- Missing COOP/COEP does not block baseline app behavior if fallback mode is implemented.

## Validation Checklist

- Secure context:
  - `window.isSecureContext === true`
- WebUSB API:
  - `'usb' in navigator` is true in Chrome/Edge
- Isolation mode:
  - `window.crossOriginIsolated === true` only when headers are active
- Fallback mode:
  - With isolation disabled, app runs using transferable transport path

## Troubleshooting

### Certificate warning persists on localhost

- Re-run `mkcert -install` as an elevated shell.
- Remove old localhost cert exceptions from browser and retry.
- Confirm the server is actually serving the intended cert/key pair.

### `window.isSecureContext` is false

- Confirm URL is `https://localhost:8080` and not `http://`.
- Check for mixed-content loads in DevTools console/network.
- Verify no proxy rewrites HTTPS to HTTP.

### `window.crossOriginIsolated` is false

- Confirm response headers include:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
- Confirm all loaded subresources satisfy COEP policy.
- Check DevTools network headers for HTML and module responses.

### WebUSB prompt does not appear

- Use Chrome/Edge (not Firefox/Safari).
- Confirm secure context and supported USB device.
- Verify previous deny state and retry device request flow.
