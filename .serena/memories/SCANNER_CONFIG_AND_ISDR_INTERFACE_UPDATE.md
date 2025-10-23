Purpose: Record durable changes to scanner config schema and ISDRDevice interface to prevent recurring test failures and speed up future updates.

Key changes (2025-10):

- FFT-based scanning landed. Scanner config changed from step-based to spectrum-based.
  - Old fields: stepSize (Hz), threshold (0–1 normalized)
  - New fields: thresholdDb (dB above noise), fftSize (e.g., 2048), minPeakSpacing (Hz), dwellTime (ms remains), enableRDS (optional)
  - UI labels updated in `src/components/FrequencyScanner.tsx`:
    - “FFT Size (frequency resolution)” with input id `fft-size`
    - “Detection Threshold (<value> dB above noise)” with input id `threshold`
    - Removed Step Size control
- ISDRDevice interface updated with `getUsableBandwidth(): Promise<number>`; used by scanner to derive chunk coverage.

Impact on tests (fixed):

- `src/components/__tests__/FrequencyScanner.test.tsx` updated:
  - Default config now includes `{ thresholdDb, fftSize, minPeakSpacing }` and removes `stepSize`, `threshold`.
  - Accessibility checks now assert `FFT Size` (id `fft-size`) and threshold keeps id `threshold`.
  - Config change assertions use `thresholdDb`.
- `src/components/__tests__/DeviceControlBar.test.tsx` mock device now includes `getUsableBandwidth`.
- `src/models/__tests__/SDRDevice.test.ts` MockSDRDevice implements `getUsableBandwidth` (80% of sample rate).

Where to look:

- Interface: `src/models/SDRDevice.ts` (ISDRDevice, SDRCapabilities)
- Scanner hook: `src/hooks/useFrequencyScanner.ts` (FrequencyScanConfig keys)
- Component: `src/components/FrequencyScanner.tsx` (labels, ids)

Guidance:

- When adding new device mocks in tests, always include `getUsableBandwidth`.
- When using `getByLabelText` in scanner component tests, prefer resilient regex (e.g., `/Detection Threshold/i`).
- Use default FFT size 2048 and thresholdDb 10 dB in tests unless scenario-specific.
