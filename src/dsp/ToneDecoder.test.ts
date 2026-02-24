import { describe, expect, it } from 'vitest';
import { ToneDecoder } from './ToneDecoder';

describe('ToneDecoder', () => {
  it('detects dominant ctcss tone from synthetic NFM-style audio', () => {
    const sampleRateHz = 50_000;
    const samples = new Float32Array(4096);
    const toneHz = 127.3;

    for (let i = 0; i < samples.length; i += 1) {
      const t = i / sampleRateHz;
      samples[i] = Math.sin(2 * Math.PI * toneHz * t) * 0.3;
    }

    const decoder = new ToneDecoder();
    const state = decoder.decodeCtcss(samples, sampleRateHz);

    expect(state.active).toBe(true);
    expect(state.mode).toBe('ctcss');
    expect(state.ctcssHz).toBeCloseTo(127.3, 1);
    expect(state.dcsDetected).toBe(false);
    expect(state.confidence).toBeGreaterThan(0.1);
  });

  it('stays inactive for broadband noise-like input', () => {
    const sampleRateHz = 50_000;
    const samples = new Float32Array(4096);

    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = ((i * 17) % 23 - 11) / 23;
    }

    const decoder = new ToneDecoder();
    const state = decoder.decodeCtcss(samples, sampleRateHz);

    expect(state.active).toBe(false);
    expect(state.mode).toBe('off');
    expect(state.ctcssHz).toBeNull();
  });

  it('detects baseline dcs symbol energy from synthetic square-wave keyed signal', () => {
    const sampleRateHz = 50_000;
    const samples = new Float32Array(4096);
    const symbolRateHz = 134.4;

    for (let i = 0; i < samples.length; i += 1) {
      const t = i / sampleRateHz;
      samples[i] = Math.sign(Math.sin(2 * Math.PI * symbolRateHz * t)) * 0.25;
    }

    const decoder = new ToneDecoder();
    const state = decoder.decodeDcs(samples, sampleRateHz);

    expect(state.active).toBe(true);
    expect(state.mode).toBe('dcs');
    expect(state.dcsDetected).toBe(true);
    expect(state.ctcssHz).toBeNull();
    expect(state.confidence).toBeGreaterThan(0.1);
  });

  it('auto mode prefers dcs when dcs confidence exceeds ctcss', () => {
    const sampleRateHz = 50_000;
    const samples = new Float32Array(4096);

    for (let i = 0; i < samples.length; i += 1) {
      const t = i / sampleRateHz;
      samples[i] = Math.sign(Math.sin(2 * Math.PI * 134.4 * t)) * 0.2;
    }

    const decoder = new ToneDecoder();
    const state = decoder.decode(samples, sampleRateHz, 'AUTO');

    expect(state.mode).toBe('dcs');
    expect(state.dcsDetected).toBe(true);
  });
});
