import { calculateFFT, type Sample } from "../dsp";

describe("calculateFFT (OfflineAudioContext stub)", () => {
  class FakeBuffer {
    private data: Float32Array[];
    constructor(numChannels: number, length: number) {
      this.data = Array.from(
        { length: numChannels },
        () => new Float32Array(length),
      );
    }
    getChannelData(channel: number): Float32Array {
      return this.data[channel]!;
    }
  }

  class FakeAnalyserNode {
    public fftSize = 32;
    public smoothingTimeConstant = 0;
    get frequencyBinCount(): number {
      return Math.floor(this.fftSize / 2);
    }
    connect(_: unknown): void {
      // no-op
    }
    getFloatFrequencyData(array: Float32Array): void {
      for (let i = 0; i < array.length; i++) {
        array[i] = i + 1; // deterministic data
      }
    }
  }

  class FakeSourceNode {
    public buffer: any;
    connect(_: unknown): void {
      // no-op
    }
    start(_: number): void {
      // no-op
    }
  }

  class FakeOfflineAudioContext {
    constructor(
      public channels: number,
      public length: number,
      public sampleRate: number,
    ) {}

    createBuffer(numChannels: number, length: number): FakeBuffer {
      return new FakeBuffer(numChannels, length);
    }

    createAnalyser(): FakeAnalyserNode {
      return new FakeAnalyserNode();
    }

    createBufferSource(): FakeSourceNode {
      return new FakeSourceNode();
    }

    get destination(): unknown {
      return {};
    }

    startRendering(): Promise<void> {
      return Promise.resolve();
    }
  }

  const originalOAC = (global as any).OfflineAudioContext;

  beforeAll(() => {
    (global as any).OfflineAudioContext = FakeOfflineAudioContext as any;
  });

  afterAll(() => {
    (global as any).OfflineAudioContext = originalOAC;
  });

  it("returns shifted frequency data from analyser", async () => {
    const fftSize = 32;
    const samples: Sample[] = Array.from({ length: fftSize }, () => ({
      I: 0,
      Q: 0,
    }));

    // calculateFFT is typed to return Float32Array, but actually returns a Promise
    const result = await (calculateFFT(
      samples,
      fftSize,
    ) as unknown as Promise<Float32Array>);

    // frequencyBinCount is fftSize/2 (16), shifting halves -> [9..16, 1..8] for our deterministic data
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(fftSize / 2);
    // Verify the cyclic shift occurred (first element should be 9)
    expect(result[0]).toBeCloseTo(9);
    expect(result[1]).toBeCloseTo(10);
    expect(result[result.length - 1]).toBeCloseTo(8);
  });
});
