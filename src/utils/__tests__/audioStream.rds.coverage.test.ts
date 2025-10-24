/**
 * Coverage shim for AudioStreamProcessor RDS branches
 */

// Minimal AudioContext mock for Node/Jest
const setupAudioContextMock = () => {
  const mock = jest.fn().mockImplementation(() => {
    return {
      createBuffer: (channels: number, length: number, sampleRate: number) => {
        const store = Array.from(
          { length: channels },
          () => new Float32Array(length),
        );
        return {
          getChannelData: (ch: number) => store[ch] || new Float32Array(length),
          length,
          sampleRate,
          numberOfChannels: channels,
        } as any;
      },
      close: jest.fn().mockResolvedValue(undefined),
      createBufferSource: jest.fn(() => ({
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      })),
      destination: {},
    } as any;
  });
  // @ts-ignore
  (global as any).AudioContext = mock;
  return mock;
};

const teardownAudioContextMock = () => {
  // @ts-ignore
  delete (global as any).AudioContext;
};

import { AudioStreamProcessor, DemodulationType } from "../audioStream";
import type { IQSample } from "../../models/SDRDevice";

// Simple IQ generator
function generateFMSignal(
  sampleRate: number,
  durationSec: number,
  freq = 1000,
  amplitude = 1.0,
): IQSample[] {
  const count = Math.floor(sampleRate * durationSec);
  const out: IQSample[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * freq * t;
    out.push({
      I: amplitude * Math.cos(phase),
      Q: amplitude * Math.sin(phase),
    });
  }
  return out;
}

beforeAll(() => {
  setupAudioContextMock();
});
afterAll(() => {
  teardownAudioContextMock();
});
describe("AudioStreamProcessor RDS enable/disable branches", () => {
  const SDR_RATE = 2048000;

  it("toggles RDS on and off to hit both branches", async () => {
    const proc = new AudioStreamProcessor(SDR_RATE);
    const samples = generateFMSignal(SDR_RATE, 0.02);

    // Enable RDS
    await proc.extractAudio(samples, DemodulationType.FM, {
      sampleRate: 48000,
      enableRDS: true,
    });

    // Disable RDS afterwards
    const res = await proc.extractAudio(samples, DemodulationType.FM, {
      sampleRate: 48000,
      enableRDS: false,
    });

    expect(res.audioData).toBeInstanceOf(Float32Array);
  });
});
