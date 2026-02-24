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
    expect(state.dcsCode).toBeNull();
    expect(state.ctcssHz).toBeNull();
    expect(state.confidence).toBeGreaterThan(0.1);
  });

  it('decodes a common DCS codeword from synthetic repeated pattern', () => {
    const sampleRateHz = 50_000;
    const symbolRateHz = 134.4;
    const samplesPerSymbol = sampleRateHz / symbolRateHz;
    const codeDigits = [1, 3, 1];
    const bits: number[] = [];

    for (const digit of codeDigits) {
      bits.push((digit >> 2) & 1, (digit >> 1) & 1, digit & 1);
    }

    const repeatedBits: number[] = [];
    while (repeatedBits.length < 18) {
      repeatedBits.push(...bits);
    }

    const totalSamples = Math.floor(repeatedBits.length * samplesPerSymbol);
    const samples = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i += 1) {
      const symbolIndex = Math.min(repeatedBits.length - 1, Math.floor(i / samplesPerSymbol));
      samples[i] = repeatedBits[symbolIndex] === 1 ? 0.22 : -0.22;
    }

    const decoder = new ToneDecoder();
    const state = decoder.decodeDcs(samples, sampleRateHz);

    expect(state.active).toBe(true);
    expect(state.mode).toBe('dcs');
    expect(state.dcsDetected).toBe(true);
    expect(state.dcsCode).toBe(131);
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
