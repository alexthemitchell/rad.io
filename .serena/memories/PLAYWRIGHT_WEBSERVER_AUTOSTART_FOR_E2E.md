Purpose: Ensure E2E reliability by letting Playwright manage the dev server lifecycle.

Pattern

- Configure `webServer` in `playwright.config.ts` to start the HTTPS dev server automatically and reuse it when possible.
- Set `baseURL` to `https://localhost:8080` and `ignoreHTTPSErrors: true` if using self-signed certs.
- Keep traces/screenshots on failure for diagnostics.

Where

- Config path: `playwright.config.ts`
  - `webServer: { command: 'npm start', reuseExistingServer: true }`
  - `use: { baseURL: 'https://localhost:8080', ignoreHTTPSErrors: true }`

Why

- Avoids CI flakes from missing server startup; standardizes local and CI behavior.
- Works seamlessly with Jest/Playwright parallelization and artifact capture.

Related

- Dev server: `webpack.config.js` (https devServer with historyApiFallback)
- E2E workflow: `.github/workflows/e2e.yml` installs deps, browsers, runs tests, uploads artifacts.
