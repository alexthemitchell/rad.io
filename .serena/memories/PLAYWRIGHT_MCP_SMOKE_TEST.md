Minimal Playwright MCP smoke test for rad.io.

Steps

1. Start dev server (HTTPS): `npm start` (or VS Code task).
2. Navigate: `browser_navigate({ url: "https://localhost:8080" })`.
3. Wait for shell text: `browser_wait_for({ text: "Software-Defined Radio Visualizer" })`.
4. Take screenshot: `browser_take_screenshot({ filename: ".playwright-mcp/radio-home.png", fullPage: true })`.
5. Optional: capture console errors: `browser_console_messages({ onlyErrors: true })` (should be none).

Assertions (accessibility snapshot)

- h1: "rad.io"
- nav links: "Live Monitor", "Scanner", "Analysis"
- regions/headings: IQ Constellation, Amplitude Waveform, Spectrogram (placeholders visible before streaming)

Notes

- WDS uses self‑signed HTTPS; MCP browser handles it automatically.
- If `ERR_CONNECTION_REFUSED`, server not running—start/restart and retry navigate.
- If "Browser is already in use" error, close session/tabs and retry. Screenshots saved under `.playwright-mcp/`.

References: `webpack.config.js` (devServer.server = "https"), `dist/index.html`, `src/App.tsx`, `src/components/Navigation.tsx`.
