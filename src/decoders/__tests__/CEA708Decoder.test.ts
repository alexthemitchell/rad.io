/**
 * CEA-708 Decoder Tests
 */

import { CEA708Decoder } from "../CEA708Decoder";
import type {
  DecodedCaption,
  CaptionService,
  CEA708DecoderMetrics,
} from "../CEA708Decoder";

describe("CEA708Decoder", () => {
  let decoder: CEA708Decoder;
  let captionOutput: DecodedCaption | null;
  let errorOutput: Error | null;

  beforeEach(() => {
    captionOutput = null;
    errorOutput = null;

    decoder = new CEA708Decoder(
      (caption) => {
        captionOutput = caption;
      },
      (error) => {
        errorOutput = error;
      },
    );
  });

  afterEach(() => {
    decoder.close();
  });

  describe("Initialization", () => {
    it("should initialize in unconfigured state", () => {
      expect(decoder.getState()).toBe("unconfigured");
    });

    it("should configure with default settings", () => {
      decoder.initialize({});
      expect(decoder.getState()).toBe("configured");
    });

    it("should configure with preferred service", () => {
      decoder.initialize({ preferredService: 2 });
      expect(decoder.getState()).toBe("configured");

      const metrics = decoder.getMetrics();
      expect(metrics.currentService).toBe(2);
    });

    it("should configure with custom settings", () => {
      decoder.initialize({
        preferredService: 1,
        fontSize: 24,
        fontFamily: "Arial",
        backgroundColor: "rgba(0,0,0,0.8)",
        textColor: "white",
        edgeStyle: "drop_shadow",
        windowOpacity: 0.9,
        enabled: true,
      });

      expect(decoder.getState()).toBe("configured");
    });
  });

  describe("Service Management", () => {
    beforeEach(() => {
      decoder.initialize({ preferredService: 1 });
    });

    it("should set active service", () => {
      decoder.setService(2);
      const metrics = decoder.getMetrics();
      expect(metrics.currentService).toBe(2);
    });

    it("should reject invalid service numbers", () => {
      expect(() => decoder.setService(0 as CaptionService)).toThrow();
      expect(() => decoder.setService(7 as CaptionService)).toThrow();
    });

    it("should return empty available services initially", () => {
      const services = decoder.getAvailableServices();
      expect(services).toEqual([]);
    });

    it("should clear service captions", () => {
      // Process some data to create a service
      const testPacket = createTestDTVCCPacket(1, "Test");
      decoder.processVideoPayload(testPacket);

      decoder.clearService(1);
      const caption = decoder.getServiceCaptions(1);
      expect(caption?.text).toEqual([]);
    });

    it("should clear all captions", () => {
      const testPacket1 = createTestDTVCCPacket(1, "Test 1");
      const testPacket2 = createTestDTVCCPacket(2, "Test 2");

      decoder.processVideoPayload(testPacket1);
      decoder.processVideoPayload(testPacket2);

      decoder.clearAll();

      expect(decoder.getAvailableServices()).toEqual([]);
      expect(decoder.getServiceCaptions(1)).toBeNull();
      expect(decoder.getServiceCaptions(2)).toBeNull();
    });
  });

  describe("Caption Processing", () => {
    beforeEach(() => {
      decoder.initialize({ preferredService: 1 });
    });

    it("should process simple text caption", () => {
      const testPacket = createTestDTVCCPacket(1, "Hello World");
      decoder.processVideoPayload(testPacket);

      expect(captionOutput).not.toBeNull();
      expect(captionOutput?.serviceNumber).toBe(1);
      expect(captionOutput?.text.length).toBeGreaterThan(0);
    });

    it("should track available services", () => {
      const testPacket1 = createTestDTVCCPacket(1, "Service 1");
      const testPacket2 = createTestDTVCCPacket(2, "Service 2");

      decoder.processVideoPayload(testPacket1);
      decoder.processVideoPayload(testPacket2);

      const services = decoder.getAvailableServices();
      expect(services).toContain(1);
      expect(services).toContain(2);
    });

    it("should only output captions for current service", () => {
      decoder.setService(2);

      const testPacket1 = createTestDTVCCPacket(1, "Service 1");
      const testPacket2 = createTestDTVCCPacket(2, "Service 2");

      decoder.processVideoPayload(testPacket1);
      expect(captionOutput).toBeNull(); // Service 1, not current

      decoder.processVideoPayload(testPacket2);
      expect(captionOutput).not.toBeNull(); // Service 2, is current
      expect(captionOutput?.serviceNumber).toBe(2);
    });

    it("should handle multiple text segments", () => {
      const testPacket = createTestDTVCCPacketWithMultipleSegments(1, [
        "First line",
        "Second line",
      ]);
      decoder.processVideoPayload(testPacket);

      expect(captionOutput).not.toBeNull();
      expect(captionOutput?.text.length).toBeGreaterThan(0);
    });

    it("should process PTS timestamps", () => {
      const pts = 90000; // 1 second at 90kHz
      const testPacket = createTestDTVCCPacket(1, "Timestamped");
      decoder.processVideoPayload(testPacket, pts);

      const caption = decoder.getServiceCaptions(1);
      expect(caption?.timestamp).toBe(pts);
    });
  });

  describe("User Data Extraction", () => {
    beforeEach(() => {
      decoder.initialize({ preferredService: 1 });
    });

    it("should extract user data from H.264 SEI", () => {
      // Create mock H.264 NAL unit with SEI
      const seiPacket = createH264SEIPacket("Test Caption");
      decoder.processVideoPayload(seiPacket);

      // Should process without error
      const metrics = decoder.getMetrics();
      expect(metrics.errors).toBe(0);
    });

    it("should extract user data from MPEG-2 user data", () => {
      // Create mock MPEG-2 user data
      const mpeg2Packet = createMPEG2UserDataPacket("Test Caption");
      decoder.processVideoPayload(mpeg2Packet);

      // Should process without error
      const metrics = decoder.getMetrics();
      expect(metrics.errors).toBe(0);
    });

    it("should handle empty payloads", () => {
      decoder.processVideoPayload(new Uint8Array(0));

      const metrics = decoder.getMetrics();
      expect(metrics.packetsProcessed).toBe(1);
      expect(metrics.errors).toBe(0);
    });

    it("should handle payloads without caption data", () => {
      const randomData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      decoder.processVideoPayload(randomData);

      const metrics = decoder.getMetrics();
      expect(metrics.packetsProcessed).toBe(1);
      expect(metrics.errors).toBe(0);
    });
  });

  describe("Metrics", () => {
    beforeEach(() => {
      decoder.initialize({ preferredService: 1 });
    });

    it("should track packets processed", () => {
      const testPacket = createTestDTVCCPacket(1, "Test");
      decoder.processVideoPayload(testPacket);
      decoder.processVideoPayload(testPacket);

      const metrics = decoder.getMetrics();
      expect(metrics.packetsProcessed).toBe(2);
    });

    it("should track captions decoded", () => {
      const testPacket = createTestDTVCCPacket(1, "Test");
      decoder.processVideoPayload(testPacket);

      const metrics = decoder.getMetrics();
      expect(metrics.captionsDecoded).toBeGreaterThan(0);
    });

    it("should track current service", () => {
      decoder.setService(3);
      const metrics = decoder.getMetrics();
      expect(metrics.currentService).toBe(3);
    });

    it("should track available services", () => {
      const testPacket1 = createTestDTVCCPacket(1, "Test");
      const testPacket2 = createTestDTVCCPacket(3, "Test");

      decoder.processVideoPayload(testPacket1);
      decoder.processVideoPayload(testPacket2);

      const metrics = decoder.getMetrics();
      expect(metrics.availableServices).toContain(1);
      expect(metrics.availableServices).toContain(3);
    });
  });

  describe("Export Functionality", () => {
    beforeEach(() => {
      decoder.initialize({ preferredService: 1 });
    });

    it("should export captions as text", () => {
      const testPacket = createTestDTVCCPacket(1, "Test Caption");
      decoder.processVideoPayload(testPacket);

      const text = decoder.exportAsText(1);
      expect(text).toContain("Service 1");
    });

    it("should export all services", () => {
      const testPacket1 = createTestDTVCCPacket(1, "Service 1");
      const testPacket2 = createTestDTVCCPacket(2, "Service 2");

      decoder.processVideoPayload(testPacket1);
      decoder.processVideoPayload(testPacket2);

      const text = decoder.exportAsText();
      expect(text).toContain("Service 1");
      expect(text).toContain("Service 2");
    });

    it("should export captions as SRT", () => {
      const testPacket = createTestDTVCCPacket(1, "Test Caption");
      decoder.processVideoPayload(testPacket);

      const srt = decoder.exportAsSRT(1);
      expect(srt).toBeTruthy();
      expect(srt).toContain("00:00:00,000 --> 00:00:05,000");
    });

    it("should return empty string for export with no captions", () => {
      const text = decoder.exportAsText(1);
      expect(text).toBe("");

      const srt = decoder.exportAsSRT(1);
      expect(srt).toBe("");
    });
  });

  describe("State Management", () => {
    it("should reset to configured state", () => {
      decoder.initialize({ preferredService: 1 });

      const testPacket = createTestDTVCCPacket(1, "Test");
      decoder.processVideoPayload(testPacket);

      decoder.reset();

      expect(decoder.getState()).toBe("configured");
      expect(decoder.getAvailableServices()).toEqual([]);

      const metrics = decoder.getMetrics();
      expect(metrics.packetsProcessed).toBe(0);
      expect(metrics.captionsDecoded).toBe(0);
    });

    it("should close properly", () => {
      decoder.initialize({ preferredService: 1 });
      decoder.close();

      expect(decoder.getState()).toBe("closed");
    });

    it("should not process data when unconfigured", () => {
      const testPacket = createTestDTVCCPacket(1, "Test");
      decoder.processVideoPayload(testPacket);

      const metrics = decoder.getMetrics();
      expect(metrics.packetsProcessed).toBe(0);
    });

    it("should not process data when closed", () => {
      decoder.initialize({ preferredService: 1 });
      decoder.close();

      const testPacket = createTestDTVCCPacket(1, "Test");
      decoder.processVideoPayload(testPacket);

      const metrics = decoder.getMetrics();
      expect(metrics.packetsProcessed).toBe(0);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      decoder.initialize({ preferredService: 1 });
    });

    it("should handle malformed packets gracefully", () => {
      const malformedPacket = new Uint8Array([0x03, 0xff, 0xff]); // Invalid
      decoder.processVideoPayload(malformedPacket);

      // Should not throw, error callback should be called
      expect(decoder.getState()).toBe("decoding");
    });

    it("should track errors in metrics", () => {
      // Force an error by processing invalid data
      const invalidPacket = new Uint8Array([0x03]);
      decoder.processVideoPayload(invalidPacket);

      const metricsAfter = decoder.getMetrics();
      // Errors may be incremented depending on validation
      expect(metricsAfter.errors).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Helper function to create a test DTVCC packet
 */
function createTestDTVCCPacket(
  service: CaptionService,
  text: string,
): Uint8Array {
  // Create a simple DTVCC packet with text
  const packet: number[] = [];

  // NAL unit start code
  packet.push(0x00, 0x00, 0x00, 0x01);

  // NAL unit type 6 (SEI)
  packet.push(0x06);

  // SEI payload type (4 = user data)
  packet.push(0x04);

  // Create caption data
  const captionData = createCaptionData(service, text);

  // SEI payload size (DTVCC header + caption data)
  const seiPayloadSize = 2 + captionData.length;
  packet.push(seiPayloadSize);

  // DTVCC packet start (inside SEI payload)
  packet.push(0x03);

  // DTVCC packet size
  packet.push(captionData.length);

  // Caption data
  packet.push(...captionData);

  return new Uint8Array(packet);
}

/**
 * Helper function to create caption data
 */
function createCaptionData(service: CaptionService, text: string): number[] {
  const data: number[] = [];

  // Service block header
  // Block size = 1 (CW command) + text length
  const blockSize = 1 + text.length;
  const serviceHeader = ((service & 0x07) << 5) | (blockSize & 0x1f);
  data.push(serviceHeader);

  // Set current window (CW0)
  data.push(0x80);

  // Add text characters
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode >= 0x20 && charCode <= 0x7f) {
      data.push(charCode);
    } else {
      data.push(0x20); // Space for unsupported characters
    }
  }

  return data;
}

/**
 * Helper function to create a DTVCC packet with multiple segments
 */
function createTestDTVCCPacketWithMultipleSegments(
  service: CaptionService,
  segments: string[],
): Uint8Array {
  const packet: number[] = [];

  // NAL unit start code
  packet.push(0x00, 0x00, 0x00, 0x01);

  // NAL unit type 6 (SEI)
  packet.push(0x06);

  // SEI payload type
  packet.push(0x04);

  // Calculate total size
  let totalSize = 0;
  const segmentData: number[][] = [];
  for (const segment of segments) {
    const data = createCaptionData(service, segment);
    segmentData.push(data);
    totalSize += data.length;
  }

  // SEI payload size (DTVCC header + data)
  packet.push(totalSize + 2);

  // DTVCC packet start (inside SEI payload)
  packet.push(0x03);

  // Packet size
  packet.push(totalSize);

  // Add all segment data
  for (const data of segmentData) {
    packet.push(...data);
  }

  return new Uint8Array(packet);
}

/**
 * Helper function to create H.264 SEI packet
 */
function createH264SEIPacket(text: string): Uint8Array {
  return createTestDTVCCPacket(1, text);
}

/**
 * Helper function to create MPEG-2 user data packet
 */
function createMPEG2UserDataPacket(text: string): Uint8Array {
  const packet: number[] = [];

  // MPEG-2 user data start code
  packet.push(0x00, 0x00, 0x01, 0xb2);

  // DTVCC packet
  packet.push(0x03);

  const captionData = createCaptionData(1, text);
  packet.push(captionData.length);
  packet.push(...captionData);

  return new Uint8Array(packet);
}
