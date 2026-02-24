import { describe, expect, it } from 'vitest';
import { AudioAgc } from './AudioAgc';

describe('AudioAgc', () => {
  it('raises low-level audio toward target when enabled', () => {
    const agc = new AudioAgc();
    agc.setMode('NFM');
    agc.setEnabled(true);

    const samples = new Float32Array(4096).fill(0.02);
    const state = agc.applyInPlace(samples, 80, true);

    expect(state.enabled).toBe(true);
    expect(state.mode).toBe('NFM');
    expect(state.state).toBe('tracking');
    expect(state.estimatedGainDb).toBeGreaterThan(0);
  });

  it('enters hold state when squelch is closed', () => {
    const agc = new AudioAgc();
    agc.setEnabled(true);

    const samples = new Float32Array(1024).fill(0.1);
    agc.applyInPlace(samples, 40, false);
    const state = agc.getState();

    expect(state.state).toBe('hold');
  });
});
