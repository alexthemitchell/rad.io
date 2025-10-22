Update: Playwright MCP specifics for rad.io dev server.

Quick smoke steps

1. Start dev server (HTTPS): npm start (or VS Code task). WDS serves https://localhost:8080 with a self‑signed cert.
2. Navigate: mcp_microsoft_pla_browser_navigate → https://localhost:8080
3. Verify page: wait_for("Software-Defined Radio Visualizer") or use accessibility snapshot
4. Screenshot: take_screenshot({ filename: ".playwright-mcp/radio-home.png" })

Common issues & remedies

- ERR_CONNECTION_REFUSED: server not started or stopped; (re)run npm start and navigate again.
- "Browser is already in use" error: Run the MCP browser install first in a fresh session, or close existing tab/session (mcp_microsoft_pla_browser_close) and retry.
- HTTPS cert warnings: WDS provides cert; MCP browser handles it—no extra flags needed.
- Native WebUSB dialogs: cannot be automated; ask user to select device manually beforehand.

Element verification

- Prefer accessibility snapshot over raw screenshot to assert labels/roles/disabled state. Example checks seen:
  - header h1: "rad.io"
  - nav links: "Live Monitor", "Scanner", "Analysis"
  - regions: "Signal visualizations", per‑visualizer headings

Workflow pattern

- Start server → navigate → wait_for key text → snapshot → optional screenshot → interact (click) → console_messages (errors first) → iterate.

References

- Dev server config: `webpack.config.js` (server: "https")
- Entry HTML: `dist/index.html`
- Main shell: `src/App.tsx`, nav in `src/components/Navigation.tsx`
- Saved screenshots path: `.playwright-mcp/`
