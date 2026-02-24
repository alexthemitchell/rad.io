import { describe, expect, it } from 'vitest';
import { FrequencyTracker } from './FrequencyTracker';

const tone = (lenComplex: number, freqHz: number, sampleRateHz: number): Float32Array => {
  const out = new Float32Array(lenComplex * 2);
  for (let i = 0; i < lenComplex; i += 1) {
    const ph = (2 * Math.PI * freqHz * i) / sampleRateHz;
    out[i * 2] = Math.cos(ph);
    out[i * 2 + 1] = Math.sin(ph);
  }
  return out;
};

describe('FrequencyTracker', () => {
  it('estimates and applies afc correction when enabled', () => {
    const tracker = new FrequencyTracker();
    tracker.setAfcEnabled(true);

    const iq = tone(4096, 1200, 2_000_000);
    const state = tracker.update(iq, 2_000_000, 0.02, 0);

    expect(Math.abs(state.afcCorrectionHz)).toBeGreaterThan(1);
    expect(state.totalCorrectionHz).toBeCloseTo(state.afcCorrectionHz, 3);
  });

  it('reports drift confidence in range', () => {
    const tracker = new FrequencyTracker();
    const iq = tone(4096, 0, 2_000_000);
    const state = tracker.update(iq, 2_000_000, 0.02, 0);

    expect(state.driftConfidence).toBeGreaterThanOrEqual(0);
    expect(state.driftConfidence).toBeLessThanOrEqual(1);
  });

  it('clears correction when AFC is turned off after tracking', () => {
    const tracker = new FrequencyTracker();
    tracker.setAfcEnabled(true);
    tracker.update(tone(4096, 1800, 2_000_000), 2_000_000, 0.02, 0);

    tracker.setAfcEnabled(false);
    const state = tracker.getState(0);

    expect(state.afcCorrectionHz).toBe(0);
  });

  it('resets drift and phase state', () => {
    const tracker = new FrequencyTracker();
    tracker.setAfcEnabled(true);
    tracker.update(tone(4096, 1000, 2_000_000), 2_000_000, 0.02, 25);

    tracker.reset();
    const state = tracker.getState(25);
    expect(state.afcCorrectionHz).toBe(0);
    expect(state.driftEstimateHzPerSec).toBe(0);
    expect(state.driftConfidence).toBe(0);
    expect(state.phaseErrorRms).toBe(0);
    expect(state.totalCorrectionHz).toBe(25);
  });
});
