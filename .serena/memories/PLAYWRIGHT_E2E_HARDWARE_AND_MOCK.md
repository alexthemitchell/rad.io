Purpose: How to run Playwright E2E tests in CI (mock SDR) and locally with a real HackRF.

Key paths
- src/models/MockSDRDevice.ts — ISDRDevice implementation generating IQ data for CI
- src/utils/e2e.ts — shouldUseMockSDR() flag detection
- src/contexts/DeviceContext.tsx — creates a mock device when mock flag is set (no USB required)
- e2e/monitor-mock.spec.ts — CI-friendly smoke (start/stop via mock)
- e2e/monitor-real.spec.ts — opt-in real HackRF test (@real + env gate)
- docs/e2e-tests.md — run instructions

Flags & selection
- Mock mode is true if any of:
  - URL query param: ?mockSdr=1
  - localStorage: radio:e2e:mockSdr === "1"
  - build-time env: E2E_MOCK_SDR === "1"
- In mock mode, DeviceProvider inserts a single mock device entry if no devices exist. If a real device later appears, both may coexist; primary device remains the mock (first inserted). This is intentional when mock is explicitly requested.
- Without the flag, DeviceProvider uses useUSBDevice() to auto-connect paired HackRF (WEBUSB_AUTO_CONNECT flow).

Running tests
- CI: npm run test:e2e → runs accessibility + monitor-mock; server auto-launched via Playwright config.
- Local hardware: set E2E_REAL_HACKRF=1 then run npm run test:e2e. The real test relies on previously paired device via navigator.usb.getDevices().

Notes
- Monitor page exposes window.dbgReceiving for assertions; Start/Stop buttons have robust ARIA labels used by tests.
- HTTPS self-signed cert is handled via ignoreHTTPSErrors in Playwright config.
- No Playwright USB permission hacks needed: real tests depend on prior pairing.

Rationale
- Keeps CI reliable via pure-js mock; real-device smoke remains available without impacting CI stability.
