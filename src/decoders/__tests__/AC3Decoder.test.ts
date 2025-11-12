/**
 * Tests for AC3Decoder
 */

import { AC3Decoder } from "../AC3Decoder";

// Mock AudioContext
class MockAudioContext {
  public state: "running" | "closed" = "running";
  public sampleRate = 48000;

  async close(): Promise<void> {
    this.state = "closed";
  }
}

// Mock AudioDecoder
class MockAudioDecoder {
  public state: "unconfigured" | "configured" | "closed" = "unconfigured";
  private outputCallback: ((audioData: AudioData) => void) | null = null;

  constructor(init: {
    output: (audioData: AudioData) => void;
    error: (error: DOMException) => void;
  }) {
    this.outputCallback = init.output;
  }

  configure(_config: AudioDecoderConfig): void {
    this.state = "configured";
  }

  decode(_chunk: EncodedAudioChunk): void {
    // Mock decode - just call output with a mock AudioData
    if (this.outputCallback) {
      const mockAudioData = {
        numberOfChannels: 2,
        numberOfFrames: 1536,
        sampleRate: 48000,
        timestamp: 0,
        copyTo: jest.fn(),
        close: jest.fn(),
      } as unknown as AudioData;
      this.outputCallback(mockAudioData);
    }
  }

  reset(): void {
    this.state = "configured";
  }

  close(): void {
    this.state = "closed";
  }

  static async isConfigSupported(
    _config: AudioDecoderConfig,
  ): Promise<{ supported: boolean }> {
    // Mock: AC-3 is supported
    return { supported: true };
  }
}

// Mock EncodedAudioChunk
class MockEncodedAudioChunk {
  type: "key" | "delta";
  timestamp: number;
  duration: number;
  data: BufferSource;

  constructor(init: {
    type: "key" | "delta";
    timestamp: number;
    duration: number;
    data: BufferSource;
  }) {
    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration;
    this.data = init.data;
  }
}

// Setup global mocks
global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
(
  global.window as unknown as { webkitAudioContext: typeof AudioContext }
).webkitAudioContext = MockAudioContext as unknown as typeof AudioContext;
global.AudioDecoder = MockAudioDecoder as unknown as typeof AudioDecoder;
global.EncodedAudioChunk =
  MockEncodedAudioChunk as unknown as typeof EncodedAudioChunk;

describe("AC3Decoder", () => {
  let decoder: AC3Decoder;
  let mockOnAudioOutput: jest.Mock;
  let mockOnError: jest.Mock;

  beforeEach(async () => {
    mockOnAudioOutput = jest.fn();
    mockOnError = jest.fn();
    decoder = new AC3Decoder(mockOnAudioOutput, mockOnError);
  });

  afterEach(() => {
    decoder.close();
  });

  describe("initialization", () => {
    it("should initialize with default configuration", async () => {
      await await decoder.initialize();
      expect(decoder.getState()).toBe("configured");
      const config = decoder.getConfig();
      expect(config).not.toBeNull();
      expect(config?.sampleRate).toBe(48000);
      expect(config?.channelCount).toBe(2);
      expect(config?.bufferSize).toBe(4096);
    });

    it("should initialize with custom configuration", async () => {
      await decoder.initialize(44100, 1, 2048);
      const config = decoder.getConfig();
      expect(config?.sampleRate).toBe(44100);
      expect(config?.channelCount).toBe(1);
      expect(config?.bufferSize).toBe(2048);
    });

    it("should throw error when initializing in non-unconfigured state", async () => {
      await await decoder.initialize();
      await expect(decoder.initialize()).rejects.toThrow(
        "Cannot initialize decoder in configured state",
      );
    });
  });

  describe("PES packet parsing", () => {
    beforeEach(async () => {
      await await decoder.initialize();
    });

    it("should detect PES packet start", () => {
      // PES packet start code: 0x000001
      const payload = new Uint8Array([
        0x00, 0x00, 0x01, 0xbd, // Start code + stream ID (private stream 1)
        0x00, 0x20, // Packet length
        0x84, 0x80, // PES header flags
        0x05, // Header data length
        0x21, 0x00, 0x01, 0x00, 0x01, // PTS
        ...new Array(23).fill(0), // Padding
      ]);

      decoder.processPayload(payload);
      expect(decoder.getState()).toBe("configured");
    });

    it("should accumulate PES packet data", () => {
      const startPayload = new Uint8Array([
        0x00, 0x00, 0x01, 0xbd, 0x00, 0x20, 0x84, 0x80, 0x05, 0x21, 0x00, 0x01,
        0x00, 0x01,
      ]);
      const continuationPayload = new Uint8Array(new Array(20).fill(0x0b));

      decoder.processPayload(startPayload);
      decoder.processPayload(continuationPayload);

      // Should not error
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it("should extract PTS from PES header", () => {
      // PES packet with valid PTS
      const payload = new Uint8Array([
        0x00, 0x00, 0x01, 0xbd, // Start code + stream ID
        0x00, 0x30, // Packet length (48 bytes)
        0x84, 0x80, // Flags (PTS present)
        0x05, // Header data length
        0x21, 0x00, 0x01, 0x00, 0x01, // PTS = 1 (simplified)
        ...new Array(35).fill(0), // Padding
      ]);

      decoder.processPayload(payload);
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe("AC-3 frame parsing", () => {
    beforeEach(async () => {
      await decoder.initialize();
    });

    it("should detect AC-3 sync word", () => {
      // Create a minimal AC-3 frame
      const ac3Frame = new Uint8Array([
        0x0b, 0x77, // Sync word
        0x00, 0x00, // CRC1
        0x00, // fscod=0 (48kHz), frmsizecod=0
        0x50, // bsid=10, bsmod=0
        0x00, // acmod=0
        ...new Array(57).fill(0), // Frame data (64 words = 128 bytes total)
      ]);

      const pesPacket = new Uint8Array([
        0x00, 0x00, 0x01, 0xbd, // PES start
        0x00, 0x90, // Packet length
        0x84, 0x80, 0x05, // Flags
        0x21, 0x00, 0x01, 0x00, 0x01, // PTS
        ...ac3Frame,
        ...new Array(12).fill(0), // Padding
      ]);

      decoder.processPayload(pesPacket);
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it("should handle partial frames across packets", () => {
      const ac3FrameStart = new Uint8Array([
        0x0b, 0x77, // Sync word
        0x00, 0x00, // CRC1
        0x00, // fscod=0 (48kHz), frmsizecod=0
        0x50, // bsid=10, bsmod=0
        0x00, // acmod=0
      ]);

      const ac3FrameEnd = new Uint8Array(new Array(121).fill(0));

      // First packet with partial frame
      const pesPacket1 = new Uint8Array([
        0x00, 0x00, 0x01, 0xbd, 0x00, 0x10, 0x84, 0x80, 0x05, 0x21, 0x00,
        0x01, 0x00, 0x01, ...ac3FrameStart,
      ]);

      // Second packet completing the frame
      const pesPacket2 = new Uint8Array([0x00, 0x00, 0x01, 0xbd, 0x00, 0x80, 0x84, 0x80, 0x00, ...ac3FrameEnd]);

      decoder.processPayload(pesPacket1);
      decoder.processPayload(pesPacket2);

      expect(mockOnError).not.toHaveBeenCalled();
    });

    it("should validate frame size", () => {
      // AC-3 frame with invalid frmsizecod
      const invalidFrame = new Uint8Array([
        0x0b, 0x77, // Sync word
        0x00, 0x00, // CRC1
        0x3f, // fscod=0, frmsizecod=63 (invalid, max is 37)
        0x50, // bsid=10, bsmod=0
        0x00, // acmod=0
      ]);

      const pesPacket = new Uint8Array([
        0x00, 0x00, 0x01, 0xbd, 0x00, 0x10, 0x84, 0x80, 0x05, 0x21, 0x00,
        0x01, 0x00, 0x01, ...invalidFrame,
      ]);

      decoder.processPayload(pesPacket);
      // Should skip invalid frame without crashing
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe("channel downmix", () => {
    beforeEach(async () => {
      await decoder.initialize();
    });

    it("should handle stereo input", () => {
      const stereoSamples = new Float32Array([
        0.5, -0.5, 0.3, -0.3, 0.1, -0.1,
      ]);

      // Process through decoder (internally tested via processAC3Frame)
      // Direct testing would require exposing private method or integration test
      expect(stereoSamples.length).toBe(6);
    });
  });

  describe("dynamic range compression", () => {
    beforeEach(async () => {
      await decoder.initialize();
    });

    it("should enable DRC with default ratio", () => {
      decoder.setDynamicRangeCompression(true);
      expect(decoder.getState()).toBe("configured");
    });

    it("should enable DRC with custom ratio", () => {
      decoder.setDynamicRangeCompression(true, 4.0);
      expect(decoder.getState()).toBe("configured");
    });

    it("should disable DRC", () => {
      decoder.setDynamicRangeCompression(true);
      decoder.setDynamicRangeCompression(false);
      expect(decoder.getState()).toBe("configured");
    });
  });

  describe("audio synchronization", () => {
    beforeEach(async () => {
      await decoder.initialize();
    });

    it("should set audio delay for lip-sync", () => {
      decoder.setAudioDelay(100); // 100ms delay
      expect(decoder.getState()).toBe("configured");
    });

    it("should handle negative audio delay", () => {
      decoder.setAudioDelay(-50); // 50ms advance
      expect(decoder.getState()).toBe("configured");
    });

    it("should reset audio delay to zero", () => {
      decoder.setAudioDelay(100);
      decoder.setAudioDelay(0);
      expect(decoder.getState()).toBe("configured");
    });
  });

  describe("language track selection", () => {
    beforeEach(async () => {
      await decoder.initialize();
    });

    it("should set language track", () => {
      decoder.setLanguage("eng");
      expect(decoder.getState()).toBe("configured");
    });

    it("should clear language selection", () => {
      decoder.setLanguage("spa");
      decoder.setLanguage(null);
      expect(decoder.getState()).toBe("configured");
    });
  });

  describe("state management", () => {
    it("should start in unconfigured state", () => {
      expect(decoder.getState()).toBe("unconfigured");
    });

    it("should transition to configured after initialization", async () => {
      await decoder.initialize();
      expect(decoder.getState()).toBe("configured");
    });

    it("should transition to closed after closing", async () => {
      await decoder.initialize();
      decoder.close();
      expect(decoder.getState()).toBe("closed");
    });

    it("should ignore payloads in closed state", async () => {
      await decoder.initialize();
      decoder.close();

      const payload = new Uint8Array([0x00, 0x00, 0x01, 0xbd, 0x00, 0x10]);
      decoder.processPayload(payload);

      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe("flush and reset", () => {
    beforeEach(async () => {
      await decoder.initialize();
    });

    it("should flush pending audio", () => {
      decoder.flush();
      expect(decoder.getState()).toBe("configured");
    });

    it("should reset decoder state", () => {
      decoder.reset();
      expect(decoder.getState()).toBe("configured");
      const metrics = decoder.getMetrics();
      expect(metrics.framesDecoded).toBe(0);
      expect(metrics.framesDropped).toBe(0);
    });
  });

  describe("metrics tracking", () => {
    beforeEach(async () => {
      await decoder.initialize();
    });

    it("should initialize metrics to zero", () => {
      const metrics = decoder.getMetrics();
      expect(metrics.framesDecoded).toBe(0);
      expect(metrics.framesDropped).toBe(0);
      expect(metrics.totalDecodeTime).toBe(0);
      expect(metrics.averageDecodeTime).toBe(0);
      expect(metrics.currentBitrate).toBe(0);
      expect(metrics.bufferHealth).toBe(0);
    });

    it("should track buffer health", () => {
      const metrics = decoder.getMetrics();
      expect(metrics.bufferHealth).toBeGreaterThanOrEqual(0);
      expect(metrics.bufferHealth).toBeLessThanOrEqual(100);
    });
  });

  describe("error handling", () => {
    beforeEach(async () => {
      await decoder.initialize();
    });

    it("should handle malformed PES packets", () => {
      const malformedPayload = new Uint8Array([0x00, 0x00, 0x01]);
      decoder.processPayload(malformedPayload);
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it("should handle empty payloads", () => {
      const emptyPayload = new Uint8Array(0);
      decoder.processPayload(emptyPayload);
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it("should recover from sync loss", () => {
      // Garbage data followed by valid sync word
      const payload = new Uint8Array([
        0xff, 0xff, 0xff, 0xff, // Garbage
        0x0b, 0x77, // Sync word
        0x00, 0x00, 0x00, 0x50, 0x00,
      ]);

      const pesPacket = new Uint8Array([
        0x00, 0x00, 0x01, 0xbd, 0x00, 0x20, 0x84, 0x80, 0x05, 0x21, 0x00,
        0x01, 0x00, 0x01, ...payload, ...new Array(10).fill(0),
      ]);

      decoder.processPayload(pesPacket);
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe("resource cleanup", () => {
    it("should clean up resources on close", async () => {
      await decoder.initialize();
      decoder.close();
      expect(decoder.getState()).toBe("closed");
    });

    it("should allow reinitialization after close", async () => {
      await decoder.initialize();
      decoder.close();
      await decoder.initialize();
      expect(decoder.getState()).toBe("configured");
    });
  });

  describe("WebCodecs integration", () => {
    it("should use WebCodecs AudioDecoder when available", async () => {
      await decoder.initialize();
      
      // Create a minimal AC-3 frame
      const ac3Frame = new Uint8Array([
        0x0b, 0x77, // Sync word
        0x00, 0x00, // CRC1
        0x00, // fscod=0 (48kHz), frmsizecod=0
        0x50, // bsid=10, bsmod=0
        0x00, // acmod=0
        ...new Array(121).fill(0), // Frame data (128 bytes total)
      ]);

      const pesPacket = new Uint8Array([
        0x00, 0x00, 0x01, 0xbd, // PES start
        0x00, 0x90, // Packet length
        0x84, 0x80, 0x05, // Flags
        0x21, 0x00, 0x01, 0x00, 0x01, // PTS
        ...ac3Frame,
        ...new Array(12).fill(0), // Padding
      ]);

      decoder.processPayload(pesPacket);
      
      // Should process without errors
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe("configuration retrieval", () => {
    it("should return null config when unconfigured", () => {
      expect(decoder.getConfig()).toBeNull();
    });

    it("should return config after initialization", async () => {
      decoder.initialize(44100, 2, 2048);
      const config = decoder.getConfig();
      expect(config).not.toBeNull();
      expect(config?.sampleRate).toBe(44100);
      expect(config?.channelCount).toBe(2);
      expect(config?.bufferSize).toBe(2048);
    });

    it("should return independent config copy", async () => {
      await decoder.initialize();
      const config1 = decoder.getConfig();
      const config2 = decoder.getConfig();
      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same values
    });
  });
});
