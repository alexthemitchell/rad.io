import { describe, expect, it } from 'vitest';
import { NoiseSquelch } from './NoiseSquelch';

describe('NoiseSquelch', () => {
  it('passes audio through when disabled', () => {
    const squelch = new NoiseSquelch({ enabled: false, thresholdDb: 8, hysteresisDb: 2, hangMs: 120, tailMs: 140 });
    const audio = new Float32Array([0.1, -0.2, 0.3]);

    const state = squelch.applyInPlace(audio, -20);

    expect(state.enabled).toBe(false);
    expect(state.open).toBe(true);
    expect(state.gain).toBe(1);
    expect(audio[0]).toBeCloseTo(0.1, 6);
    expect(audio[1]).toBeCloseTo(-0.2, 6);
    expect(audio[2]).toBeCloseTo(0.3, 6);
  });

  it('closes below threshold and opens above threshold with hysteresis', () => {
    const squelch = new NoiseSquelch({ enabled: true, thresholdDb: 10, hysteresisDb: 2, hangMs: 120, tailMs: 140 });
    const muted = new Float32Array([0.2, 0.2, 0.2]);

    let state = squelch.applyInPlace(muted, -5);
    expect(state.open).toBe(false);
    expect(state.gain).toBeLessThan(1);

    const stillClosed = new Float32Array([0.2, 0.2, 0.2]);
    state = squelch.applyInPlace(stillClosed, 9.5);
    expect(state.open).toBe(false);

    const reopened = new Float32Array([0.2, 0.2, 0.2]);
    state = squelch.applyInPlace(reopened, 11.5);
    expect(state.open).toBe(true);
  });

  it('honors hang and tails out smoothly when signal drops', () => {
    const squelch = new NoiseSquelch({ enabled: true, thresholdDb: 8, hysteresisDb: 1, hangMs: 100, tailMs: 200 });
    const frameMs = 20;

    squelch.applyInPlace(new Float32Array([0.3, 0.3]), 12, frameMs);

    for (let i = 0; i < 4; i += 1) {
      const state = squelch.applyInPlace(new Float32Array([0.3, 0.3]), 0, frameMs);
      expect(state.open).toBe(true);
    }

    const hangExpiryFrame = squelch.applyInPlace(new Float32Array([0.3, 0.3]), 0, frameMs);
    expect(hangExpiryFrame.open).toBe(true);

    const firstClosed = squelch.applyInPlace(new Float32Array([0.3, 0.3]), 0, frameMs);
    expect(firstClosed.open).toBe(false);
    expect(firstClosed.gain).toBeGreaterThan(0);

    let final = firstClosed;
    for (let i = 0; i < 30; i += 1) {
      final = squelch.applyInPlace(new Float32Array([0.3, 0.3]), 0, frameMs);
    }
    expect(final.gain).toBeLessThan(0.1);
  });
});
