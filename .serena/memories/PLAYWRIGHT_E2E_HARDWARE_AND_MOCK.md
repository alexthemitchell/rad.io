Purpose: How to run Playwright E2E tests in CI (mock SDR), locally with simulated data, and with physical hardware.

Key paths

- src/models/MockSDRDevice.ts — ISDRDevice implementation generating IQ data for CI
- src/utils/e2e.ts — shouldUseMockSDR() and shouldRunDeviceTests() flag detection
- src/contexts/DeviceContext.tsx — creates a mock device when mock flag is set (no USB required)
- e2e/monitor-mock.spec.ts — CI-friendly smoke (start/stop via mock)
- e2e/monitor-real.spec.ts — opt-in real HackRF test (@real + env gate)
- e2e/visualization-simulated.spec.ts — simulated data source tests (@simulated tag)
- e2e/visualization-device.spec.ts — hardware-in-the-loop tests (@device tag)
- e2e/README-DEVICE-TESTS.md — device test documentation

Test Projects & Flags

Three Playwright projects exist:

1. mock-chromium: runs accessibility + monitor-mock (default, no env var needed)
2. simulated: runs @simulated tests (included by default)
3. device: runs @device tests (only when RADIO_E2E_DEVICE=1)

Mock mode detection (shouldUseMockSDR):

- URL query param: ?mockSdr=1
- localStorage: radio:e2e:mockSdr === "1"
- build-time env: E2E_MOCK_SDR === "1"

Device mode gating:

- RADIO_E2E_DEVICE=1 must be set
- WebUSB support detected
- Previously paired HackRF device present (vendor ID 0x1d50)

Running tests

- CI default: npm run test:e2e → runs mock + simulated (26 tests)
- Simulated only: npm run test:e2e:sim → @simulated tests
- Real device (legacy): E2E_REAL_HackRF=1 npm run test:e2e → @real tests
- Device tests: npm run test:e2e:device → 8 hardware-in-the-loop tests
- Device headed: npm run test:e2e:device -- --headed

Device test coverage

Tests in visualization-device.spec.ts validate:

- Device connection (auto-connection to paired device)
- Start/stop reception with hardware
- Frequency tuning (e.g., to 100 MHz FM band)
- Gain control adjustments (LNA, VGA, amp)
- Rendering stability (continuous frame updates)
- Visualization mode switching (waterfall, spectrogram, FFT)
- IQ constellation display with real RF data
- Device reconnection (multiple start/stop cycles)

All device tests skip gracefully if RADIO_E2E_DEVICE!=1 or hardware not detected.

Notes

- Monitor page exposes window.dbgReceiving for streaming state assertions
- Start/Stop buttons have ARIA labels used by all test types
- HTTPS self-signed cert handled via ignoreHTTPSErrors
- Device tests require prior WebUSB pairing (one-time manual step)
- Device tests do NOT run in CI by default (opt-in only)

Project structure in playwright.config.ts

- DEVICE_TAG constant defines @device regex
- Device project only added when process.env.RADIO_E2E_DEVICE === "1"
- Mock project excludes @real, @simulated, and @device tests
- Avoids spawning unnecessary Chrome instances when device tests disabled

Rationale

- CI reliability via pure-js mock and simulated tests
- Optional real hardware validation without impacting CI
- Comprehensive device testing with physical SDR hardware
- Graceful degradation when hardware not available
