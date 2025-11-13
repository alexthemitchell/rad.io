import { MultiStationFMProcessor } from "../multiStationFM";
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

test("processWidebandSamples channelization returns without errors", async () => {
  const sampleRate = 2_000_000;
  const centerFrequency = 100_000_000;
  const fftSize = 8192;
  const length = fftSize;
  const offsets = [-200_000, 0, 200_000];
  const tones = offsets.map((off) => generateToneIQ(off, sampleRate, length));
  const wideband = mixIQ(tones);

  const mp = new MultiStationFMProcessor({
    sampleRate,
    centerFrequency,
    bandwidth: sampleRate * 0.9,
    scanFFTSize: fftSize,
    enableRDS: false,
  });

  // Add channels explicitly
  for (const off of offsets) {
    mp.addChannel(centerFrequency + off, 1);
  }

  const res = await mp.processWidebandSamples(wideband);
  expect(res).toBeInstanceOf(Map);
});
