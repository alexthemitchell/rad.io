import pfbChannelize from "../pfbChannelizer";
import { fftWorkerPool } from "../fft-worker-pool";
import type { IQSample } from "../../../models/SDRDevice";

describe("PFB Channelizer worker integration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("uses FFT worker when available for sufficiently large M", async () => {
    const sampleRate = 2_000_000; // 2 MHz wideband
    const channelBandwidth = 100_000; // 100 kHz channel -> M = 20
    const M = Math.round(sampleRate / channelBandwidth);

    // Pretend we have at least one worker and fake computeFFT to ensure called
    jest.spyOn(fftWorkerPool, "getWorkerLoads").mockReturnValue([0]);
    // Fake computeFFT to ensure called
    const computeSpy = jest
      .spyOn(fftWorkerPool, "computeFFT")
      .mockResolvedValue({
        magnitude: new Float32Array(M),
        phase: new Float32Array(M),
        processingTime: 1,
      });

    // Prepare a short sample array of complex IQs
    const samples: IQSample[] = new Array(512)
      .fill(0)
      .map((_v, i) => ({ I: Math.cos(i * 0.1), Q: Math.sin(i * 0.1) }));
    const channelFreqs = [100e6];
    const out = await pfbChannelize(
      samples,
      sampleRate,
      100e6,
      channelBandwidth,
      channelFreqs,
      { tapsPerPhase: 4 },
    );

    expect(computeSpy).toHaveBeenCalled();
    expect(out.has(channelFreqs[0]!)).toBe(true);
  });
});
