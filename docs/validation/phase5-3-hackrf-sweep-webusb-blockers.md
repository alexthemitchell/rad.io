# Phase 5.3 HackRF Sweep WebUSB Blockers

Date: 2026-02-25

## Decision

`hackrf_sweep` hardware mode is not currently feasible through this in-browser WebUSB path. The app keeps an explicit software tune/settle/stitch fallback and now surfaces blocker evidence in-product.

## Evidence

- `src/devices/HackRFDevice.ts` exposes sweep capability as fallback-only (`hardwareSupported: false`) and points at host-native `hackrf_sweep`.
- `src/devices/HackRFDevice.ts` only implements vendor control transfers and bulk IQ stream transfers used for normal RX; there is no WebUSB sweep command/format path.
- `src/App.tsx` executes sweep using in-app tune/settle/stitch (`runSweepStitch`) rather than device-native accelerated sweep mode.

## Why This Blocks Hardware Sweep In Browser

- Browser WebUSB cannot spawn host-native binaries (`hackrf_sweep`) directly.
- The current TypeScript driver contract does not include a hardware sweep transfer/state machine path.
- Existing UI and diagnostics are designed around software-segment stitching output.

## Implemented Fallback UX

- `src/devices/hackrfSweepFallbackPlan.ts` centralizes capability-driven sweep execution plans and blocker messages.
- `src/App.tsx` Sweep card now shows plan status, fallback mode, and explicit blockers.
- `src/devices/hackrfSweepFallbackPlan.test.ts` validates unavailable/hardware/fallback plan behavior.

## Exit Criteria To Mark Hardware Sweep Complete

- Add and verify a browser-executable hardware sweep path in the HackRF WebUSB driver.
- Update capability to `hardwareSupported: true` for validated devices/firmware.
- Add regression coverage proving true hardware sweep execution (not software retune loop).
