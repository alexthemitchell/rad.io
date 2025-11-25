import {
  createAudioContext,
  getAudioContext,
  playAudioBuffer,
  createGainNode,
  createAudioBufferFromSamples,
  mixAudioBuffers,
  resetAudioContextForTesting,
} from "../webAudioUtils";

describe("webAudioUtils", () => {
  let mockAudioContext: any;
  let mockBuffer: any;
  let mockSource: any;
  let mockGain: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    resetAudioContextForTesting();

    // Mock AudioContext and related objects
    mockBuffer = {
      copyToChannel: jest.fn(),
    };

    mockSource = {
      buffer: null,
      connect: jest.fn(),
      start: jest.fn(),
    };

    mockGain = {
      gain: { value: 0 },
      connect: jest.fn(),
    };

    mockAudioContext = {
      state: "running",
      resume: jest.fn().mockResolvedValue(undefined),
      createBuffer: jest.fn().mockReturnValue(mockBuffer),
      createBufferSource: jest.fn().mockReturnValue(mockSource),
      createGain: jest.fn().mockReturnValue(mockGain),
      destination: {},
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Mock global AudioContext
    global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext) as any;
  });

  describe("createAudioContext", () => {
    it("should create a new AudioContext if one does not exist", () => {
      const context = createAudioContext();
      expect(global.AudioContext).toHaveBeenCalledWith({ sampleRate: 48000 });
      expect(context).toBe(mockAudioContext);
    });

    it("should return existing AudioContext if one exists", () => {
      const context1 = createAudioContext();
      const context2 = createAudioContext();
      expect(global.AudioContext).toHaveBeenCalledTimes(1);
      expect(context1).toBe(context2);
    });

    it("should return null if AudioContext is not defined", () => {
      const originalAudioContext = global.AudioContext;
      (global as any).AudioContext = undefined;
      
      const context = createAudioContext();
      expect(context).toBeNull();
      
      global.AudioContext = originalAudioContext;
    });
  });

  describe("getAudioContext", () => {
    it("should return null if context not created", () => {
      expect(getAudioContext()).toBeNull();
    });

    it("should return context if created", () => {
      createAudioContext();
      expect(getAudioContext()).toBe(mockAudioContext);
    });
  });

  describe("playAudioBuffer", () => {
    it("should play audio buffer", () => {
      const samples = new Float32Array([0.1, 0.2, 0.3]);
      playAudioBuffer(mockAudioContext, samples, 48000);

      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(1, 3, 48000);
      expect(mockBuffer.copyToChannel).toHaveBeenCalledWith(samples, 0);
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(mockSource.buffer).toBe(mockBuffer);
      expect(mockSource.connect).toHaveBeenCalledWith(mockAudioContext.destination);
      expect(mockSource.start).toHaveBeenCalled();
    });

    it("should resume context if suspended", () => {
      mockAudioContext.state = "suspended";
      const samples = new Float32Array([0.1]);
      playAudioBuffer(mockAudioContext, samples, 48000);
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it("should do nothing if context is null", () => {
      playAudioBuffer(null, new Float32Array(10), 48000);
      expect(mockAudioContext.createBuffer).not.toHaveBeenCalled();
    });
  });

  describe("createGainNode", () => {
    it("should create gain node with specified value", () => {
      const gainNode = createGainNode(mockAudioContext, 0.5);
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(gainNode.gain.value).toBe(0.5);
    });
  });

  describe("createAudioBufferFromSamples", () => {
    it("should create mono buffer", () => {
      const samples = new Float32Array([0.1, 0.2]);
      createAudioBufferFromSamples(mockAudioContext, samples, 48000, 1);
      
      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(1, 2, 48000);
      expect(mockBuffer.copyToChannel).toHaveBeenCalledWith(samples, 0);
    });

    it("should create stereo buffer", () => {
      const samples = new Float32Array([0.1, 0.2, 0.3, 0.4]); // L, R, L, R
      createAudioBufferFromSamples(mockAudioContext, samples, 48000, 2);
      
      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(2, 2, 48000);
      expect(mockBuffer.copyToChannel).toHaveBeenCalledTimes(2);
      // Verify splitting happens (mock implementation doesn't verify content, but we verify calls)
    });
  });

  describe("mixAudioBuffers", () => {
    it("should return empty array for empty input", () => {
      const result = mixAudioBuffers([]);
      expect(result).toEqual(new Float32Array(0));
    });

    it("should return single buffer as is", () => {
      const buffer = new Float32Array([0.1, 0.2]);
      const result = mixAudioBuffers([buffer]);
      expect(result).toBe(buffer);
    });

    it("should mix and normalize multiple buffers", () => {
      const b1 = new Float32Array([0.2, 0.4]);
      const b2 = new Float32Array([0.4, 0.6]);
      
      const result = mixAudioBuffers([b1, b2]);
      
      // Sum: [0.6, 1.0]
      // Scale: 1/2 = 0.5
      // Result: [0.3, 0.5]
      expect(result[0]).toBeCloseTo(0.3);
      expect(result[1]).toBeCloseTo(0.5);
    });

    it("should handle buffers of different lengths", () => {
      const b1 = new Float32Array([0.2, 0.4, 0.6]);
      const b2 = new Float32Array([0.4, 0.6]);
      
      const result = mixAudioBuffers([b1, b2]);
      
      // Max length is 3
      // b1: 0.2, 0.4, 0.6
      // b2: 0.4, 0.6, 0.0 (implicitly)
      // Sum: 0.6, 1.0, 0.6
      // Scale: 0.5
      // Result: 0.3, 0.5, 0.3
      
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(0.3);
      expect(result[1]).toBeCloseTo(0.5);
      expect(result[2]).toBeCloseTo(0.3);
    });
  });
});
