# Phase 5.3 HackRF Sweep WebUSB Blockers

Date: 2026-02-25

## Decision

`hackrf_sweep` hardware mode is implemented only as a host-assisted path when an explicit bridge capability is present, and remains unavailable in pure browser-only WebUSB. The app executes hardware sweep through a gated bridge contract and otherwise falls back to software tune/settle/stitch.

## Evidence

- `src/devices/HackRFDevice.ts` exposes sweep capability as fallback-only (`hardwareSupported: false`) and points at host-native `hackrf_sweep`.
- `src/devices/HackRFDevice.ts` only implements vendor control transfers and bulk IQ stream transfers used for normal RX; there is no WebUSB sweep command/format path.
- `src/devices/hackrfSweepHostBridge.ts` defines the host-assisted bridge contract (`window.__RADIO_HOST_BRIDGE__`) and validates capability/response shape before any sweep execution.
- `src/App.tsx` executes host-assisted `hackrf_sweep` only when the bridge advertises `hackrf-sweep`; otherwise it executes software tune/settle/stitch and records deterministic run evidence.

## Why This Blocks Hardware Sweep In Browser

- Browser WebUSB cannot spawn host-native binaries (`hackrf_sweep`) directly.
- The current TypeScript driver contract does not include a hardware sweep transfer/state machine path.
- Browser-only sessions without host bridge capability cannot invoke `hackrf_sweep`.

## Implemented Gating + Fallback UX

- `src/devices/hackrfSweepFallbackPlan.ts` centralizes capability-driven sweep execution plans and blocker messages.
- `src/devices/hackrfSweepHostBridge.ts` provides typed bridge probe + invocation helpers with request/response normalization.
- `src/App.tsx` Sweep card now shows plan status, host bridge availability, fallback mode, explicit blockers, and last run evidence.
- `src/devices/hackrfSweepFallbackPlan.test.ts` validates unavailable/hardware/fallback plan behavior.
- `src/devices/hackrfSweepHostBridge.test.ts` validates bridge capability gating and deterministic invocation behavior.

## Exit Criteria To Mark Hardware Sweep Complete

- Host bridge packaging/distribution is still required outside the app so users can reliably provide `window.__RADIO_HOST_BRIDGE__` with `hackrf-sweep` capability.
- Real-device validation evidence is still required for measured sweep-rate claims (for example `>8 GHz/s`) under the host-assisted path.
