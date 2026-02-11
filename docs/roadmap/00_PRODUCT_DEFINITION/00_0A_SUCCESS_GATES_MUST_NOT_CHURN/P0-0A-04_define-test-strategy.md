# Test Strategy

## 1. Unit Tests (Jest)
- **Scope:** Pure functions, DSP math, parsers, state reducers.
- **Coverage Target:** 90% strict coverage.
- **Environment:** Node.js (fast).

## 2. Integration Tests (Simulated E2E)
- **Scope:** `MockDevice` → Worker → DSP → `MockSink`.
- **Validation:** 
  - Check IQ continuity.
  - Check correct frequency shift (DDC).
  - Check demodulator output SNR.
- **Environment:** Headless Browser / JSDOM.

## 3. Visual/Canvas Tests
- **Scope:** Canvas rendering correctness.
- **Method:** Image snapshot regression (pixel match).
- **Frequency:** On PR (critical paths only).

## 4. Hardware "Smoke" Tests (Manual/Local)
- **Scope:** Real HackRF/RTL-SDR connect.
- **Method:** "Vertical Slice" demo script run by developer.
