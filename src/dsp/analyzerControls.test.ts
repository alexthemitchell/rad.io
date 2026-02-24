import { describe, expect, it } from 'vitest';
import {
  blendAveragedTrace,
  binIndexToFrequencyHz,
  findNearestQualifiedPeak,
  findStrongestPeakInRange,
  frequencyHzToBinIndex,
  getVisibleSpectrumBinRange,
  resolveMarkerReadout,
  updatePeakHoldTrace
} from './analyzerControls';

describe('analyzerControls', () => {
  it('applies exponential averaging deterministically', () => {
    const previous = new Float32Array([-80, -60, -40]);
    const incoming = new Float32Array([-70, -50, -30]);

    const result = blendAveragedTrace(previous, incoming, 'exp', 0.5);

    expect(Array.from(result)).toEqual([-75, -55, -35]);
  });

  it('applies linear averaging as running mean with selected frame count', () => {
    const previous = new Float32Array([-100, -80, -60]);
    const incoming = new Float32Array([-80, -70, -50]);

    const result = blendAveragedTrace(previous, incoming, 'linear', 4);

    expect(Array.from(result)).toEqual([-95, -77.5, -57.5]);
  });

  it('updates and decays peak-hold trace', () => {
    const first = new Float32Array([-90, -50, -70]);
    const second = new Float32Array([-92, -52, -65]);

    const hold1 = updatePeakHoldTrace(null, first, 0.016, true);
    const hold2 = updatePeakHoldTrace(hold1, second, 1, true, 2);

    expect(hold1).not.toBeNull();
    expect(hold2).not.toBeNull();
    expect(Array.from(hold2 ?? new Float32Array(0))).toEqual([-92, -52, -65]);
  });

  it('decays held peaks across sequential frames until replaced', () => {
    const seed = new Float32Array([-80, -72]);
    const lower = new Float32Array([-95, -90]);
    const higher = new Float32Array([-60, -88]);

    const hold1 = updatePeakHoldTrace(null, seed, 0.016, true, 2);
    const hold2 = updatePeakHoldTrace(hold1, lower, 0.5, true, 2);
    const hold3 = updatePeakHoldTrace(hold2, higher, 0.5, true, 2);

    expect(Array.from(hold2 ?? new Float32Array(0))).toEqual([-81, -73]);
    expect(Array.from(hold3 ?? new Float32Array(0))).toEqual([-60, -74]);
  });

  it('finds strongest peak in visible range while skipping DC center', () => {
    const trace = new Float32Array(128).fill(-100);
    trace[18] = -48;
    trace[64] = -10;

    const peak = findStrongestPeakInRange(trace, { startBinInclusive: 0, endBinExclusive: 128 }, 8);

    expect(peak?.binIndex).toBe(18);
    expect(peak?.powerDbfs).toBe(-48);
  });

  it('snaps to nearest qualified local peak', () => {
    const trace = new Float32Array(64).fill(-100);
    trace[20] = -82;
    trace[21] = -75;
    trace[22] = -84;
    trace[40] = -88;
    trace[41] = -70;
    trace[42] = -89;

    const peak = findNearestQualifiedPeak(
      trace,
      18,
      { startBinInclusive: 0, endBinExclusive: 64 },
      10
    );

    expect(peak?.binIndex).toBe(21);
    expect(peak?.powerDbfs).toBe(-75);
  });

  it('maps marker frequency to bin/power readout', () => {
    const trace = new Float32Array(2048).fill(-120);
    const markerBin = 1200;
    trace[markerBin] = -44;
    const centerFrequencyHz = 100_000_000;
    const sampleRateHz = 2_000_000;

    const markerFrequencyHz = binIndexToFrequencyHz(markerBin, trace.length, centerFrequencyHz, sampleRateHz);
    const visibleRange = getVisibleSpectrumBinRange(trace.length, 1);
    const readout = resolveMarkerReadout(markerFrequencyHz, trace, centerFrequencyHz, sampleRateHz, visibleRange);

    expect(frequencyHzToBinIndex(markerFrequencyHz, trace.length, centerFrequencyHz, sampleRateHz)).toBe(markerBin);
    expect(readout?.binIndex).toBe(markerBin);
    expect(readout?.powerDbfs).toBe(-44);
    expect(readout?.inView).toBe(true);
  });

  it('reports marker inView false when zoomed range excludes marker bin', () => {
    const trace = new Float32Array(1024).fill(-120);
    const markerBin = 760;
    trace[markerBin] = -38;

    const markerFrequencyHz = binIndexToFrequencyHz(markerBin, trace.length, 100_000_000, 2_000_000);
    const narrowRange = { startBinInclusive: 600, endBinExclusive: 700 };
    const readout = resolveMarkerReadout(markerFrequencyHz, trace, 100_000_000, 2_000_000, narrowRange);

    expect(readout?.binIndex).toBe(markerBin);
    expect(readout?.inView).toBe(false);
  });
});
