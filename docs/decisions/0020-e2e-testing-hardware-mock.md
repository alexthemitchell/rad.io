# ADR-0020: E2E Testing Strategy for Hardware and Mock SDR

Date: 2025-10-25

## Status

Accepted

## Context

The application interfaces with SDR devices via WebUSB. CI environments cannot provide real USB devices, while engineers need confidence the UI can start/stop streaming and render dynamic visualizations. We require a reliable CI path and an opt-in hardware path for local runs.

## Decision

- Introduce a lightweight `MockSDRDevice` that implements `ISDRDevice` and generates realistic IQ streams without WebUSB.
- Add a flag switch to enable the mock in E2E contexts:
  - URL: `?mockSdr=1`
  - localStorage: `radio:e2e:mockSdr = "1"`
  - build-time env: `E2E_MOCK_SDR=1`
- Device selection:
  - When mock flag is set, `DeviceProvider` creates a single mock device if none exist.
  - Without the flag, normal WebUSB auto-connect applies for previously paired devices.
- Playwright projects:
  - `mock-chromium`: runs all tests except those tagged `@real` (default in CI)
  - `real-chromium`: only runs `@real` tests (further gated by `E2E_REAL_HACKRF=1`)
- Add a visual smoke assertion that toggles visualization mode and verifies the canvas image changes.

## Consequences

- CI achieves stable coverage of start/stop streaming and visualization dynamics without hardware.
- Local engineers can run real-device tests when a HackRF is connected and paired; these are never required in CI.
- The selection mechanism is transparent and low-risk; it does not affect production behavior unless flags are set.

## References

- `src/models/MockSDRDevice.ts`
- `src/utils/e2e.ts` (`shouldUseMockSDR`)
- `src/contexts/DeviceContext.tsx` (mock insertion logic)
- `e2e/monitor-mock.spec.ts`, `e2e/monitor-real.spec.ts`
- `playwright.config.ts` (projects split)
