# End-to-End Testing Guide (Playwright)

This app supports E2E testing with **mock SDR devices only**. Real hardware testing with HackRF must be done manually.

## Quick start

- Dev server: uses HTTPS on https://localhost:8080
- Run all E2E tests (CI path):

```bash
# Run from VS Code task "E2E tests" or:
npm run test:e2e
```

The mock SDR test navigates with `?mockSdr=1` so the app injects a `MockSDRDevice` that produces realistic IQ data for the visualizers.

## Why No Real HackRF E2E Tests?

**WebUSB API cannot be automated with Playwright.** This is a fundamental limitation:

1. **User gestures required** - WebUSB device pairing requires manual user selection from a browser dialog
2. **Sandboxed environment** - Playwright's automation context blocks native hardware APIs
3. **Security restrictions** - Browser automation tools cannot access USB devices for security reasons

### Real Hardware Testing

For testing with actual HackRF devices, see:

- **Manual testing checklist**: `e2e/monitor-real-manual.md`
- **Integration tests**: `src/hooks/__tests__/useUSBDevice.test.ts` (mocked WebUSB)
- **Playwright MCP tools**: Semi-automated browser control (requires user interaction for device pairing)

Resource management:

- The Playwright config now creates the real-device project only when `E2E_REAL_HACKRF=1` is set. This prevents an extra Chrome instance from launching in default runs (lower memory use).
- Local runs are limited to 2 workers and file-level parallelism is disabled to avoid Chromium renderer OOM on machines with limited RAM. CI already uses 1 worker.
- Traces are kept only on failure to keep artifact sizes small.

## How the mock works

- `src/models/MockSDRDevice.ts` implements the `ISDRDevice` contract and generates IQ sample chunks periodically.
- Mock mode is activated when any of the following is present:
  - URL query param `?mockSdr=1`
  - `localStorage["radio:e2e:mockSdr"] === "1"`
  - `process.env.E2E_MOCK_SDR === "1"` at build-time
- `DeviceProvider` detects the flag via `shouldUseMockSDR()` and creates one mock device entry.

## Test entries

- `e2e/monitor-mock.spec.ts` — CI-friendly smoke test that starts/stops reception with the mock device
- `e2e/monitor-real.spec.ts` — opt-in real device test (tagged `@real` and additionally gated by E2E_REAL_HACKRF)
- `e2e/accessibility.spec.ts` — existing a11y coverage (unchanged)

## Troubleshooting

- Self-signed HTTPS errors: the Playwright config sets `ignoreHTTPSErrors: true`.
- Dev server already running: Playwright will reuse it locally (`reuseExistingServer`).
- No device found in real test: pair the HackRF once via the app, then rerun with the env flag.
- Audio context restrictions: tests click the Start button to serve as a user gesture and unlock audio playback.
