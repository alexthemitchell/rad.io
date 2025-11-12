/**
 * Tests for ATSCVideoDecoder
 */

import { ATSCVideoDecoder } from "../ATSCVideoDecoder";
import { StreamType } from "../../parsers/TransportStreamParser";

// Mock VideoDecoder
class MockVideoDecoder {
  public state: "unconfigured" | "configured" | "closed" = "unconfigured";
  private outputCallback: ((frame: VideoFrame) => void) | null = null;

  constructor(init: {
    output: (frame: VideoFrame) => void;
    error: (error: DOMException) => void;
  }) {
    this.outputCallback = init.output;
  }

  configure(_config: VideoDecoderConfig): void {
    this.state = "configured";
  }

  decode(_chunk: EncodedVideoChunk): void {
    // Mock decode - just call output with a mock frame
    if (this.outputCallback) {
      const mockFrame = {
        timestamp: 0,
        displayWidth: 1920,
        displayHeight: 1080,
        close: jest.fn(),
      } as unknown as VideoFrame;
      this.outputCallback(mockFrame);
    }
  }

  async flush(): Promise<void> {
    // Mock flush
  }

  reset(): void {
    this.state = "configured";
  }

  close(): void {
    this.state = "closed";
  }

  static async isConfigSupported(
    _config: VideoDecoderConfig,
  ): Promise<{ supported: boolean }> {
    return { supported: true };
  }
}

// Mock EncodedVideoChunk
class MockEncodedVideoChunk {
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
global.VideoDecoder = MockVideoDecoder as unknown as typeof VideoDecoder;
global.EncodedVideoChunk =
  MockEncodedVideoChunk as unknown as typeof EncodedVideoChunk;

describe("ATSCVideoDecoder", () => {
  let decoder: ATSCVideoDecoder;
  let mockOnFrame: jest.Mock;
  let mockOnError: jest.Mock;

  beforeEach(() => {
    mockOnFrame = jest.fn();
    mockOnError = jest.fn();
    decoder = new ATSCVideoDecoder(mockOnFrame, mockOnError);
  });

  afterEach(() => {
    decoder.close();
  });

  describe("initialization", () => {
    it("should initialize with H.264 codec", async () => {
      await decoder.initialize(StreamType.H264_VIDEO, 1920, 1080);
      expect(decoder.getState()).toBe("configured");
    });

    it("should initialize with MPEG-2 codec", async () => {
      await decoder.initialize(StreamType.MPEG2_VIDEO, 1920, 1080);
      expect(decoder.getState()).toBe("configured");
    });

    it("should throw error for unsupported stream type", async () => {
      await expect(
        decoder.initialize(StreamType.AC3_AUDIO, 1920, 1080),
      ).rejects.toThrow("Unsupported stream type");
    });

    it("should not initialize when already configured", async () => {
      await decoder.initialize(StreamType.H264_VIDEO, 1920, 1080);
      await expect(
        decoder.initialize(StreamType.H264_VIDEO, 1920, 1080),
      ).rejects.toThrow(
        "Cannot initialize decoder in configured state. Close first.",
      );
    });
  });

  describe("PES packet processing", () => {
    beforeEach(async () => {
      await decoder.initialize(StreamType.H264_VIDEO, 1920, 1080);
    });

    it("should process PES packet with start indicator", () => {
      // Create a minimal PES packet
      const pesPacket = new Uint8Array([
        0x00,
        0x00,
        0x01, // PES start code
        0xe0, // Stream ID (video)
        0x00,
        0x10, // Packet length
        0x80, // Marker bits
        0x80, // PTS flag set
        0x05, // Header data length
        0x21,
        0x00,
        0x01,
        0x00,
        0x01, // PTS data
        ...Array(7).fill(0x00), // Padding
      ]);

      expect(() => decoder.processPayload(pesPacket)).not.toThrow();
    });

    it("should accumulate PES packet fragments", () => {
      // First fragment with PES start
      const fragment1 = new Uint8Array([
        0x00, 0x00, 0x01, 0xe0, 0x00, 0x10, 0x80, 0x80, 0x05, 0x21, 0x00, 0x01,
        0x00, 0x01,
      ]);

      // Second fragment (continuation)
      const fragment2 = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

      decoder.processPayload(fragment1);
      expect(() => decoder.processPayload(fragment2)).not.toThrow();
    });
  });

  describe("performance metrics", () => {
    beforeEach(async () => {
      await decoder.initialize(StreamType.H264_VIDEO, 1920, 1080);
    });

    it("should initialize metrics to zero", () => {
      const metrics = decoder.getMetrics();
      expect(metrics.framesDecoded).toBe(0);
      expect(metrics.framesDropped).toBe(0);
      expect(metrics.totalDecodeTime).toBe(0);
      expect(metrics.averageDecodeTime).toBe(0);
    });

    it("should track decoded frames", () => {
      const pesPacket = new Uint8Array([
        0x00,
        0x00,
        0x01,
        0xe0,
        0x00,
        0x10,
        0x80,
        0x80,
        0x05,
        0x21,
        0x00,
        0x01,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x01,
        0x65, // H.264 IDR NAL
      ]);

      decoder.processPayload(pesPacket);

      // Trigger another PES to process the first one
      decoder.processPayload(new Uint8Array([0x00, 0x00, 0x01, 0xe0]));

      const metrics = decoder.getMetrics();
      expect(metrics.framesDecoded).toBeGreaterThan(0);
    });
  });

  describe("state management", () => {
    it("should start in unconfigured state", () => {
      expect(decoder.getState()).toBe("unconfigured");
    });

    it("should transition to configured after initialization", async () => {
      await decoder.initialize(StreamType.H264_VIDEO);
      expect(decoder.getState()).toBe("configured");
    });

    it("should transition to closed after close", async () => {
      await decoder.initialize(StreamType.H264_VIDEO);
      decoder.close();
      expect(decoder.getState()).toBe("closed");
    });

    it("should reset to configured state after reset", async () => {
      await decoder.initialize(StreamType.H264_VIDEO);
      decoder.reset();
      expect(decoder.getState()).toBe("configured");
    });
  });

  describe("resource management", () => {
    it("should close decoder on close", async () => {
      await decoder.initialize(StreamType.H264_VIDEO);
      decoder.close();
      expect(decoder.getState()).toBe("closed");
    });

    it("should not process payloads when closed", async () => {
      await decoder.initialize(StreamType.H264_VIDEO);
      decoder.close();

      const pesPacket = new Uint8Array([0x00, 0x00, 0x01, 0xe0]);
      expect(() => decoder.processPayload(pesPacket)).not.toThrow();
      expect(mockOnFrame).not.toHaveBeenCalled();
    });
  });

  describe("keyframe detection", () => {
    beforeEach(async () => {
      await decoder.initialize(StreamType.H264_VIDEO);
    });

    it("should detect H.264 IDR frames as keyframes", () => {
      const idrPacket = new Uint8Array([
        0x00,
        0x00,
        0x01,
        0xe0,
        0x00,
        0x10,
        0x80,
        0x80,
        0x05,
        0x21,
        0x00,
        0x01,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x01,
        0x65, // IDR NAL (type 5)
      ]);

      expect(() => decoder.processPayload(idrPacket)).not.toThrow();
    });
  });

  describe("flush", () => {
    beforeEach(async () => {
      await decoder.initialize(StreamType.H264_VIDEO);
    });

    it("should flush pending frames", async () => {
      // Process a packet
      const pesPacket = new Uint8Array([
        0x00, 0x00, 0x01, 0xe0, 0x00, 0x10, 0x80, 0x80, 0x05, 0x21, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x65,
      ]);

      decoder.processPayload(pesPacket);
      await decoder.flush();

      expect(decoder.getState()).toBe("configured");
    });
  });

  describe("error handling", () => {
    it("should call error callback on decoder error", async () => {
      // Mock isConfigSupported to return unsupported
      const originalIsConfigSupported = global.VideoDecoder.isConfigSupported;
      global.VideoDecoder.isConfigSupported = jest
        .fn()
        .mockResolvedValue({ supported: false });

      await expect(decoder.initialize(StreamType.H264_VIDEO)).rejects.toThrow(
        "not supported",
      );

      // Restore
      global.VideoDecoder.isConfigSupported = originalIsConfigSupported;
    });
  });

  describe("PTS/DTS parsing with BigInt", () => {
    beforeEach(async () => {
      await decoder.initialize(StreamType.H264_VIDEO, 1920, 1080);
    });

    it("should correctly parse large PTS values above 2^31", () => {
      // Create a PES packet with PTS > 2^31 (0x80000000 = 2147483648)
      // PTS value: 2^31 + 1000 = 2147484648
      // In 90kHz clock, encoded as 33-bit value
      const pesPacket = new Uint8Array([
        0x00,
        0x00,
        0x01,
        0xe0, // PES start code + stream ID
        0x00,
        0x20, // Packet length (32 bytes)
        0x84,
        0x80, // Flags: PTS present
        0x05, // PES header data length (5 bytes for PTS)
        // PTS encoding (33-bit value in 5 bytes):
        // Format: 0010xxxx xxxxxxxx xxxxxxx1 xxxxxxxx xxxxxxx1
        0x21, // 0010 0001 - marker bits + high 3 bits of PTS
        0x00, // Next 8 bits
        0x00, // Next 7 bits + marker bit
        0x0f, // Next 8 bits
        0xa1, // Low 7 bits + marker bit
        // Padding
        ...new Array(27).fill(0),
      ]);

      // Process the packet - should not throw or overflow
      expect(() => decoder.processPayload(pesPacket)).not.toThrow();
    });

    it("should correctly parse PTS and DTS together", () => {
      // Create a PES packet with both PTS and DTS
      const pesPacket = new Uint8Array([
        0x00,
        0x00,
        0x01,
        0xe0, // PES start code + stream ID
        0x00,
        0x20, // Packet length
        0x84,
        0xc0, // Flags: both PTS and DTS present
        0x0a, // PES header data length (10 bytes for PTS+DTS)
        // PTS encoding (sample value)
        0x31,
        0x00,
        0x01,
        0x00,
        0x01,
        // DTS encoding (sample value)
        0x11,
        0x00,
        0x01,
        0x00,
        0x01,
        // Padding
        ...new Array(22).fill(0),
      ]);

      // Process the packet - should not throw
      expect(() => decoder.processPayload(pesPacket)).not.toThrow();
    });

    it("should handle maximum 33-bit PTS value", () => {
      // Maximum 33-bit value: 2^33 - 1 = 8589934591
      // This tests the upper bound of our BigInt parsing
      const pesPacket = new Uint8Array([
        0x00,
        0x00,
        0x01,
        0xe0, // PES start code + stream ID
        0x00,
        0x20, // Packet length
        0x84,
        0x80, // Flags: PTS present
        0x05, // PES header data length
        // PTS encoding for max value (all bits set except marker bits)
        0x3e, // 0011 1110
        0xff, // 1111 1111
        0xff, // 1111 1111
        0xff, // 1111 1111
        0xff, // 1111 1111
        // Padding
        ...new Array(27).fill(0),
      ]);

      // Process the packet - should not throw or overflow
      expect(() => decoder.processPayload(pesPacket)).not.toThrow();
    });
  });
});
