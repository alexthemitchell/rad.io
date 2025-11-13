import { MultiStationFMProcessor } from "../multiStationFM";
import { generateFMStereoWithRDSIQ } from "../signalGenerator";
import type { IQSample } from "../../models/SDRDevice";

function interleavedToIQ(samples: Float32Array): IQSample[] {
  const out: IQSample[] = new Array(samples.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = { I: samples[i * 2] ?? 0, Q: samples[i * 2 + 1] ?? 0 };
  }
  return out;
}

function mixIQs(iqArrays: IQSample[][]): IQSample[] {
  const length = iqArrays.reduce((m, a) => Math.max(m, a.length), 0);
  const out: IQSample[] = new Array(length);
  for (let i = 0; i < length; i++) {
    let I = 0;
    let Q = 0;
    for (const a of iqArrays) {
      const s = a[i];
      if (s) {
        I += s.I;
        Q += s.Q;
      }
    }
    out[i] = { I, Q };
  }
  return out;
}

test("e2e simulated FM stereo with RDS (integration) runs without errors", async () => {
  const sampleRate = 912_000; // wideband sample rate
  const centerFrequency = 100_000_000; // 100 MHz wideband center
  const channelBandwidth = 200_000;

  const left = generateFMStereoWithRDSIQ({
    sampleRate,
    carrierFreq: centerFrequency - 200_000,
    audioFreqLeft: 1000,
    audioFreqRight: 400,
    deviation: 75000,
    amplitude: 0.9,
    duration: 0.05,
  });

  const right = generateFMStereoWithRDSIQ({
    sampleRate,
    carrierFreq: centerFrequency + 200_000,
    audioFreqLeft: 1500,
    audioFreqRight: 600,
    deviation: 75000,
    amplitude: 0.8,
    duration: 0.05,
  });

  const leftIQ = interleavedToIQ(left.samples);
  const rightIQ = interleavedToIQ(right.samples);

  // Mix into wideband
  const wideband = mixIQs([leftIQ, rightIQ]);

  const mp = new MultiStationFMProcessor({
    sampleRate,
    centerFrequency,
    bandwidth: sampleRate * 0.9,
    scanFFTSize: 8192,
    channelBandwidth,
    enableRDS: true,
    scanAutoThreshold: false,
    scanThresholdDb: -120,
  });

  // Add channels explicitly
  mp.addChannel(centerFrequency - 200_000, 1);
  mp.addChannel(centerFrequency + 200_000, 1);

  // Sanity check: both channels added
  const beforeCh = mp.getChannels();
  expect(beforeCh.length).toBe(2);

  const results = await mp.processWidebandSamples(wideband);
  expect(results).toBeInstanceOf(Map);

  const channels = mp.getChannels();
  // After processing we should at least still have the channels we added.
  expect(channels.length).toBeGreaterThanOrEqual(1);

  // At least one channel should have RDS stats (decoder initialized)
  const anyHasStats = channels.some((c) => c.rdsStats !== undefined);
  expect(anyHasStats).toBe(true);
  for (const ch of channels) {
    expect(ch.rdsStats).toBeDefined();
    expect(ch.rdsStats).toHaveProperty("totalGroups");
    expect(ch.rdsStats).toHaveProperty("validGroups");
  }
});
