// import { createBulkRDSProcessor } from "../bulkRDSProcessor";
import { MultiStationFMProcessor } from "../multiStationFM";
import { calculateFFTSync, type Sample } from "../dsp";
import type { IQSample } from "../../models/SDRDevice";

function generateToneIQ(
  offsetHz: number,
  sampleRate: number,
  length: number,
  amplitude = 1,
): IQSample[] {
  const samples: IQSample[] = new Array(length);
  for (let n = 0; n < length; n++) {
    const angle = (2 * Math.PI * offsetHz * n) / sampleRate;
    samples[n] = {
      I: amplitude * Math.cos(angle),
      Q: amplitude * Math.sin(angle),
    };
  }
  return samples;
}

function mixIQ(stations: IQSample[][]): IQSample[] {
  const length = stations.reduce((max, s) => Math.max(max, s.length), 0);
  const out: IQSample[] = new Array(length);
  for (let i = 0; i < length; i++) {
    let I = 0;
    let Q = 0;
    for (const s of stations) {
      const sample = s[i];
      if (sample) {
        I += sample.I;
        Q += sample.Q;
      }
    }
    out[i] = { I, Q };
  }
  return out;
}

test("Multi-station FM scan finds multiple tones", async () => {
  const sampleRate = 2_000_000; // 2 MHz sample rate
  const fftSize = 8192;
  const centerFrequency = 100_000_000; // 100 MHz

  // Create three carriers at -200k, 0, +200k (200 kHz apart)
  const offsets = [-200_000, 0, 200_000];
  const tones = offsets.map((off) => generateToneIQ(off, sampleRate, fftSize));
  const wideband = mixIQ(tones);

  // Create processor directly with a low detection threshold so the synthetic
  // tones are detected reliably in tests.
  const mp = new MultiStationFMProcessor({
    sampleRate,
    centerFrequency,
    bandwidth: sampleRate * 0.9,
    scanFFTSize: fftSize,
    scanThresholdDb: -200,
    scanMaxStations: 8,
  });
  // Use scanForStations so we can test the detection algorithm directly
  const detectedStations = await mp.scanForStations(wideband);

  // Should detect at least three stations
  // Debug: print detected frequencies
  // eslint-disable-next-line no-console
  console.log(
    "Detected channels:",
    detectedStations.map((c) => c.frequency),
  );
  // Also compute straight spectrum and print local peaks for debugging
  const dspSamples: Sample[] = wideband.map((s) => ({ I: s.I, Q: s.Q }));
  const spectrum = calculateFFTSync(dspSamples, fftSize);
  const half = Math.floor(fftSize / 2);
  const fs = sampleRate;
  const binWidth = fs / fftSize;
  // Find top 5 bins
  const peaks: Array<{ bin: number; db: number }> = [];
  for (let k = 1; k < spectrum.length - 1; k++) {
    const val = spectrum[k];
    if (typeof val !== "number") continue;
    const left = spectrum[k - 1];
    const right = spectrum[k + 1];
    if (typeof left !== "number" || typeof right !== "number") continue;
    if (val > left && val > right) peaks.push({ bin: k, db: val });
  }
  peaks.sort((a, b) => b.db - a.db);
  // eslint-disable-next-line no-console
  console.log(
    "Top spectral peaks:",
    peaks
      .slice(0, 12)
      .map((p) => ({
        freq: centerFrequency + (p.bin - half) * binWidth,
        db: p.db,
      })),
  );
  const detected: Array<{ frequency: number; db: number }> = [];
  for (const p of peaks) {
    const offsetBins = p.bin - half;
    const freqOffset = offsetBins * binWidth;
    const freqHz = centerFrequency + freqOffset;
    let nearby: { frequency: number; db: number } | undefined;
    for (const d2 of detected) {
      if (Math.abs(d2.frequency - freqHz) < 200000 / 2) {
        nearby = d2;
        break;
      }
    }
    if (nearby) {
      if (p.db > nearby.db) {
        nearby.frequency = freqHz;
        nearby.db = p.db;
      }
    } else {
      detected.push({ frequency: freqHz, db: p.db });
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    "Detected (by merging) :",
    detected.map((d) => ({ f: d.frequency, db: d.db })),
  );
  expect(detectedStations.length).toBeGreaterThanOrEqual(3);

  // Confirm detected frequencies are present near expected offsets
  const detectedFreqs = detectedStations.map((c) => c.frequency);
  for (const off of offsets) {
    const expected = centerFrequency + off;
    const match = detectedFreqs.find((f) => Math.abs(f - expected) < 5_000);
    expect(match).toBeDefined();
  }
});

test("close peaks with adequate valley are separated", async () => {
  const sampleRate = 2_000_000; // 2 MHz sample rate
  const fftSize = 8192;
  const centerFrequency = 100_000_000; // 100 MHz

  // Two carriers 120 kHz apart -> should be considered separate
  const offsets = [-60_000, 60_000];
  const tones = offsets.map((off) => generateToneIQ(off, sampleRate, fftSize));
  const wideband = mixIQ(tones);

  const mp = new MultiStationFMProcessor({
    sampleRate,
    centerFrequency,
    bandwidth: sampleRate * 0.9,
    scanFFTSize: fftSize,
    scanThresholdDb: -200,
    scanMaxStations: 8,
    minSeparationHz: 100e3,
    minValleyDepthDb: 3,
  });
  const detected = await mp.scanForStations(wideband);
  // Should detect two stations
  expect(detected.length).toBeGreaterThanOrEqual(2);
});

test("very close peaks merge", async () => {
  const sampleRate = 2_000_000; // 2 MHz sample rate
  const fftSize = 8192;
  const centerFrequency = 100_000_000; // 100 MHz

  // Two carriers 40 kHz apart -> closer than default minSeparation(100k) should merge
  const offsets = [-20_000, 20_000];
  const tones = offsets.map((off) => generateToneIQ(off, sampleRate, fftSize));
  const wideband = mixIQ(tones);

  const mp = new MultiStationFMProcessor({
    sampleRate,
    centerFrequency,
    bandwidth: sampleRate * 0.9,
    scanFFTSize: fftSize,
    scanThresholdDb: -200,
    scanMaxStations: 8,
    minSeparationHz: 100e3,
    minValleyDepthDb: 3,
  });
  const detected = await mp.scanForStations(wideband);
  // Should detect only 1 station because the two are too close
  expect(detected.length).toBeLessThanOrEqual(1);
});
