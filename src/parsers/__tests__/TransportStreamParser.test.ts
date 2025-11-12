/**
 * Tests for MPEG-2 Transport Stream Parser
 */

import {
  TransportStreamParser,
  TSPacket,
  StreamType,
  TableId,
} from "../TransportStreamParser";

describe("TransportStreamParser", () => {
  let parser: TransportStreamParser;

  beforeEach(() => {
    parser = new TransportStreamParser();
  });

  describe("Packet Parsing", () => {
    it("should parse a valid transport packet header", () => {
      const packetData = new Uint8Array(188);
      packetData[0] = 0x47; // Sync byte
      packetData[1] = 0x40; // Payload unit start
      packetData[2] = 0x00; // PID = 0x0000 (PAT)
      packetData[3] = 0x10; // Adaptation field control = 01, CC = 0

      const packet = parser.parsePacket(packetData);

      expect(packet).not.toBeNull();
      expect(packet?.header.syncByte).toBe(0x47);
      expect(packet?.header.payloadUnitStartIndicator).toBe(true);
      expect(packet?.header.pid).toBe(0x0000);
      expect(packet?.header.adaptationFieldControl).toBe(0x01);
      expect(packet?.header.continuityCounter).toBe(0);
    });

    it("should reject packet without sync byte", () => {
      const packetData = new Uint8Array(188);
      packetData[0] = 0x00; // Invalid sync byte

      const packet = parser.parsePacket(packetData);

      expect(packet).toBeNull();
    });

    it("should reject packet with incorrect length", () => {
      const packetData = new Uint8Array(100);
      packetData[0] = 0x47;

      const packet = parser.parsePacket(packetData);

      expect(packet).toBeNull();
    });

    it("should parse packet with adaptation field", () => {
      const packetData = new Uint8Array(188);
      packetData[0] = 0x47; // Sync byte
      packetData[1] = 0x00;
      packetData[2] = 0x00;
      packetData[3] = 0x30; // Adaptation field control = 11, CC = 0
      packetData[4] = 0x07; // Adaptation field length
      packetData[5] = 0x50; // Flags: PCR flag set, random access

      const packet = parser.parsePacket(packetData);

      expect(packet).not.toBeNull();
      expect(packet?.adaptationField).toBeDefined();
      expect(packet?.adaptationField?.length).toBe(7);
      expect(packet?.adaptationField?.pcrFlag).toBe(true);
      expect(packet?.adaptationField?.randomAccessIndicator).toBe(true);
    });

    it("should extract payload from packet", () => {
      const packetData = new Uint8Array(188);
      packetData[0] = 0x47; // Sync byte
      packetData[1] = 0x40; // Payload unit start
      packetData[2] = 0x00; // PID = 0x0000
      packetData[3] = 0x10; // Adaptation field control = 01, CC = 0
      packetData[4] = 0xaa; // First payload byte

      const packet = parser.parsePacket(packetData);

      expect(packet).not.toBeNull();
      expect(packet?.payload).toBeDefined();
      expect(packet?.payload?.[0]).toBe(0xaa);
      expect(packet?.payload?.length).toBe(184); // 188 - 4 header bytes
    });
  });

  describe("PAT Parsing", () => {
    it("should parse a simple PAT", () => {
      // Create a minimal PAT packet
      const packetData = new Uint8Array(188);
      packetData.fill(0xff); // Fill with padding

      // TS header
      packetData[0] = 0x47; // Sync byte
      packetData[1] = 0x40; // Payload unit start
      packetData[2] = 0x00; // PID = 0x0000 (PAT)
      packetData[3] = 0x10; // Adaptation = 01, CC = 0

      // Payload starts at byte 4
      let offset = 4;
      packetData[offset++] = 0x00; // Pointer field

      // PAT section
      packetData[offset++] = 0x00; // Table ID (PAT)
      packetData[offset++] = 0xb0; // Section syntax indicator + section length high bits
      packetData[offset++] = 0x0d; // Section length low bits (13 bytes)
      packetData[offset++] = 0x00; // Transport stream ID high
      packetData[offset++] = 0x01; // Transport stream ID low
      packetData[offset++] = 0xc1; // Version 0, current
      packetData[offset++] = 0x00; // Section number
      packetData[offset++] = 0x00; // Last section number

      // One program: program_number=1, PMT PID=0x0100
      packetData[offset++] = 0x00; // Program number high
      packetData[offset++] = 0x01; // Program number low
      packetData[offset++] = 0xe1; // Reserved + PID high
      packetData[offset++] = 0x00; // PID low

      // CRC32 (not validated in this test)
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x00;

      parser.parseStream(packetData);
      const pat = parser.getPAT();

      expect(pat).not.toBeNull();
      expect(pat?.tableId).toBe(TableId.PAT);
      expect(pat?.transportStreamId).toBe(0x0001);
      expect(pat?.programs.size).toBe(1);
      expect(pat?.programs.get(1)).toBe(0x0100);
    });

    it("should parse PAT with multiple programs", () => {
      const packetData = new Uint8Array(188);
      packetData.fill(0xff);

      packetData[0] = 0x47;
      packetData[1] = 0x40;
      packetData[2] = 0x00;
      packetData[3] = 0x10;

      let offset = 4;
      packetData[offset++] = 0x00;

      packetData[offset++] = 0x00; // Table ID
      packetData[offset++] = 0xb0;
      packetData[offset++] = 0x15; // Section length (21 bytes for 3 programs)
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x01;
      packetData[offset++] = 0xc1;
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x00;

      // Program 1
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x01;
      packetData[offset++] = 0xe1;
      packetData[offset++] = 0x00;

      // Program 2
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x02;
      packetData[offset++] = 0xe1;
      packetData[offset++] = 0x01;

      // Program 3
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x03;
      packetData[offset++] = 0xe1;
      packetData[offset++] = 0x02;

      // CRC32
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x00;
      packetData[offset++] = 0x00;

      parser.parseStream(packetData);
      const pat = parser.getPAT();

      expect(pat).not.toBeNull();
      expect(pat?.programs.size).toBe(3);
      expect(pat?.programs.get(1)).toBe(0x0100);
      expect(pat?.programs.get(2)).toBe(0x0101);
      expect(pat?.programs.get(3)).toBe(0x0102);
    });
  });

  describe("PMT Parsing", () => {
    it("should parse a simple PMT", () => {
      // First send PAT to register PMT PID
      const patData = new Uint8Array(188);
      patData.fill(0xff);

      patData[0] = 0x47;
      patData[1] = 0x40;
      patData[2] = 0x00;
      patData[3] = 0x10;

      let offset = 4;
      patData[offset++] = 0x00;

      patData[offset++] = 0x00;
      patData[offset++] = 0xb0;
      patData[offset++] = 0x0d;
      patData[offset++] = 0x00;
      patData[offset++] = 0x01;
      patData[offset++] = 0xc1;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;

      patData[offset++] = 0x00;
      patData[offset++] = 0x01;
      patData[offset++] = 0xe1;
      patData[offset++] = 0x00; // PMT PID = 0x0100

      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;

      parser.parseStream(patData);

      // Now send PMT
      const pmtData = new Uint8Array(188);
      pmtData.fill(0xff);

      pmtData[0] = 0x47;
      pmtData[1] = 0x41; // Payload unit start
      pmtData[2] = 0x00; // PID = 0x0100
      pmtData[3] = 0x10;

      offset = 4;
      pmtData[offset++] = 0x00;

      pmtData[offset++] = 0x02; // Table ID (PMT)
      pmtData[offset++] = 0xb0;
      pmtData[offset++] = 0x17; // Section length (23 bytes)
      pmtData[offset++] = 0x00; // Program number high
      pmtData[offset++] = 0x01; // Program number low
      pmtData[offset++] = 0xc1;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0xe1; // PCR PID high
      pmtData[offset++] = 0x00; // PCR PID low = 0x0100
      pmtData[offset++] = 0xf0;
      pmtData[offset++] = 0x00; // Program info length = 0

      // One video stream: type=0x1b (H.264), PID=0x0101
      pmtData[offset++] = 0x1b; // Stream type
      pmtData[offset++] = 0xe1; // Elementary PID high
      pmtData[offset++] = 0x01; // Elementary PID low = 0x0101
      pmtData[offset++] = 0xf0;
      pmtData[offset++] = 0x00; // ES info length = 0

      // One audio stream: type=0x0f (AAC), PID=0x0102
      pmtData[offset++] = 0x0f;
      pmtData[offset++] = 0xe1;
      pmtData[offset++] = 0x02; // PID = 0x0102
      pmtData[offset++] = 0xf0;
      pmtData[offset++] = 0x00;

      // CRC32
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;

      parser.parseStream(pmtData);
      const pmt = parser.getPMT(1);

      expect(pmt).not.toBeNull();
      expect(pmt?.tableId).toBe(TableId.PMT);
      expect(pmt?.programNumber).toBe(1);
      expect(pmt?.pcrPid).toBe(0x0100);
      expect(pmt?.streams.length).toBe(2);
      expect(pmt?.streams[0]?.streamType).toBe(StreamType.H264_VIDEO);
      expect(pmt?.streams[0]?.elementaryPid).toBe(0x0101);
      expect(pmt?.streams[1]?.streamType).toBe(StreamType.AAC_AUDIO);
      expect(pmt?.streams[1]?.elementaryPid).toBe(0x0102);
    });
  });

  describe("Stream Synchronization", () => {
    it("should find sync byte in stream", () => {
      const data = new Uint8Array(400);
      data.fill(0x00);

      // Place sync byte at offset 10
      data[10] = 0x47;
      data[11] = 0x40;
      data[12] = 0x00;
      data[13] = 0x10;

      // Valid packet continues for 188 bytes
      for (let i = 14; i < 10 + 188; i++) {
        data[i] = 0xff;
      }

      const packets = parser.parseStream(data);

      expect(packets.length).toBeGreaterThan(0);
      expect(packets[0]?.header.syncByte).toBe(0x47);
    });

    it("should handle multiple packets in stream", () => {
      const data = new Uint8Array(188 * 3);
      data.fill(0xff);

      // Create 3 valid packets
      for (let i = 0; i < 3; i++) {
        const offset = i * 188;
        data[offset] = 0x47;
        data[offset + 1] = 0x40;
        data[offset + 2] = 0x00;
        data[offset + 3] = 0x10 + i; // Different continuity counters
      }

      const packets = parser.parseStream(data);

      expect(packets.length).toBe(3);
      expect(packets[0]?.header.continuityCounter).toBe(0);
      expect(packets[1]?.header.continuityCounter).toBe(1);
      expect(packets[2]?.header.continuityCounter).toBe(2);
    });
  });

  describe("PID Filtering", () => {
    it("should filter packets by PID", () => {
      parser.addPIDFilter(0x0100);

      const data = new Uint8Array(188 * 3);
      data.fill(0xff);

      // Packet 1: PID 0x0000
      data[0] = 0x47;
      data[1] = 0x00;
      data[2] = 0x00;
      data[3] = 0x10;

      // Packet 2: PID 0x0100 (should be processed)
      data[188] = 0x47;
      data[189] = 0x01;
      data[190] = 0x00;
      data[191] = 0x10;

      // Packet 3: PID 0x0200
      data[376] = 0x47;
      data[377] = 0x02;
      data[378] = 0x00;
      data[379] = 0x10;

      const packets = parser.parseStream(data);

      // All packets are parsed, but only 0x0100 is processed
      expect(packets.length).toBe(3);
    });

    it("should clear PID filters", () => {
      parser.addPIDFilter(0x0100);
      parser.addPIDFilter(0x0200);

      expect(parser["pidFilters"].size).toBe(2);

      parser.clearPIDFilters();

      expect(parser["pidFilters"].size).toBe(0);
    });

    it("should remove specific PID filter", () => {
      parser.addPIDFilter(0x0100);
      parser.addPIDFilter(0x0200);

      parser.removePIDFilter(0x0100);

      expect(parser["pidFilters"].has(0x0100)).toBe(false);
      expect(parser["pidFilters"].has(0x0200)).toBe(true);
    });
  });

  describe("Demultiplexing", () => {
    it("should demultiplex stream by PID", () => {
      const packets: TSPacket[] = [];

      // Create packets with different PIDs
      for (let i = 0; i < 5; i++) {
        const packetData = new Uint8Array(188);
        packetData[0] = 0x47;
        packetData[1] = i < 2 ? 0x01 : 0x02; // First 2 have PID 0x0100, rest 0x0200
        packetData[2] = 0x00;
        packetData[3] = 0x10;
        packetData[4] = i; // Marker byte in payload

        const packet = parser.parsePacket(packetData);
        if (packet) {
          packets.push(packet);
        }
      }

      const pid100Payloads = parser.demultiplex(packets, 0x0100);

      expect(pid100Payloads.length).toBe(2);
      expect(pid100Payloads[0]?.[0]).toBe(0);
      expect(pid100Payloads[1]?.[0]).toBe(1);
    });
  });

  describe("Elementary Stream Detection", () => {
    it("should identify video PIDs", () => {
      // Setup PAT and PMT
      const patData = new Uint8Array(188);
      patData.fill(0xff);
      patData[0] = 0x47;
      patData[1] = 0x40;
      patData[2] = 0x00;
      patData[3] = 0x10;

      let offset = 4;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0xb0;
      patData[offset++] = 0x0d;
      patData[offset++] = 0x00;
      patData[offset++] = 0x01;
      patData[offset++] = 0xc1;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x01;
      patData[offset++] = 0xe1;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;

      parser.parseStream(patData);

      // PMT with H.264 video
      const pmtData = new Uint8Array(188);
      pmtData.fill(0xff);
      pmtData[0] = 0x47;
      pmtData[1] = 0x41;
      pmtData[2] = 0x00;
      pmtData[3] = 0x10;

      offset = 4;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x02;
      pmtData[offset++] = 0xb0;
      pmtData[offset++] = 0x12;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x01;
      pmtData[offset++] = 0xc1;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0xe1;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0xf0;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x1b; // H.264 video
      pmtData[offset++] = 0xe1;
      pmtData[offset++] = 0x01;
      pmtData[offset++] = 0xf0;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;

      parser.parseStream(pmtData);

      const videoPIDs = parser.getVideoPIDs(1);

      expect(videoPIDs.length).toBe(1);
      expect(videoPIDs[0]).toBe(0x0101);
    });

    it("should identify audio PIDs", () => {
      // Setup PAT
      const patData = new Uint8Array(188);
      patData.fill(0xff);
      patData[0] = 0x47;
      patData[1] = 0x40;
      patData[2] = 0x00;
      patData[3] = 0x10;

      let offset = 4;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0xb0;
      patData[offset++] = 0x0d;
      patData[offset++] = 0x00;
      patData[offset++] = 0x01;
      patData[offset++] = 0xc1;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x01;
      patData[offset++] = 0xe1;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;

      parser.parseStream(patData);

      // PMT with AAC audio
      const pmtData = new Uint8Array(188);
      pmtData.fill(0xff);
      pmtData[0] = 0x47;
      pmtData[1] = 0x41;
      pmtData[2] = 0x00;
      pmtData[3] = 0x10;

      offset = 4;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x02;
      pmtData[offset++] = 0xb0;
      pmtData[offset++] = 0x12;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x01;
      pmtData[offset++] = 0xc1;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0xe1;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0xf0;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x0f; // AAC audio
      pmtData[offset++] = 0xe1;
      pmtData[offset++] = 0x02;
      pmtData[offset++] = 0xf0;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;
      pmtData[offset++] = 0x00;

      parser.parseStream(pmtData);

      const audioPIDs = parser.getAudioPIDs(1);

      expect(audioPIDs.length).toBe(1);
      expect(audioPIDs[0]).toBe(0x0102);
    });
  });

  describe("Error Handling", () => {
    it("should handle corrupted packet gracefully", () => {
      const data = new Uint8Array(188);
      data[0] = 0x47;
      // Corrupt header
      data[1] = 0xff;
      data[2] = 0xff;
      data[3] = 0xff;

      const packet = parser.parsePacket(data);

      expect(packet).not.toBeNull();
      // Parser should handle gracefully without throwing
    });

    it("should handle incomplete PAT section", () => {
      const packetData = new Uint8Array(188);
      packetData.fill(0xff);

      packetData[0] = 0x47;
      packetData[1] = 0x40;
      packetData[2] = 0x00;
      packetData[3] = 0x10;
      packetData[4] = 0x00;
      packetData[5] = 0x00;
      packetData[6] = 0xb0;
      packetData[7] = 0xff; // Invalid section length

      // Should not throw
      expect(() => parser.parseStream(packetData)).not.toThrow();
    });

    it("should handle sync loss and recovery", () => {
      const data = new Uint8Array(188 * 3);
      data.fill(0x00);

      // Valid packet 1
      data[0] = 0x47;
      data[1] = 0x00;
      data[2] = 0x00;
      data[3] = 0x10;

      // Corrupted area (no sync byte at 188)
      data[188] = 0x00;

      // Valid packet 2 at offset 200
      data[200] = 0x47;
      data[201] = 0x00;
      data[202] = 0x01;
      data[203] = 0x10;

      const packets = parser.parseStream(data);

      // Should recover and parse at least the first packet
      expect(packets.length).toBeGreaterThan(0);
    });
  });

  describe("Reset", () => {
    it("should reset parser state", () => {
      // Parse some data
      const patData = new Uint8Array(188);
      patData.fill(0xff);
      patData[0] = 0x47;
      patData[1] = 0x40;
      patData[2] = 0x00;
      patData[3] = 0x10;

      let offset = 4;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0xb0;
      patData[offset++] = 0x0d;
      patData[offset++] = 0x00;
      patData[offset++] = 0x01;
      patData[offset++] = 0xc1;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x01;
      patData[offset++] = 0xe1;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;
      patData[offset++] = 0x00;

      parser.parseStream(patData);

      expect(parser.getPAT()).not.toBeNull();

      parser.reset();

      expect(parser.getPAT()).toBeNull();
      expect(parser.getAllPMTs().size).toBe(0);
    });
  });

  describe("PCR Parsing", () => {
    it("should parse PCR from adaptation field", () => {
      const packetData = new Uint8Array(188);
      packetData.fill(0xff);

      packetData[0] = 0x47;
      packetData[1] = 0x00;
      packetData[2] = 0x00;
      packetData[3] = 0x20; // Adaptation field only
      packetData[4] = 0x07; // AF length
      packetData[5] = 0x10; // PCR flag set

      // PCR: base=100, extension=200
      // For simplicity, just verify it doesn't crash
      packetData[6] = 0x00;
      packetData[7] = 0x00;
      packetData[8] = 0x00;
      packetData[9] = 0x00;
      packetData[10] = 0x64; // Part of base
      packetData[11] = 0x00; // Extension

      const packet = parser.parsePacket(packetData);

      expect(packet).not.toBeNull();
      expect(packet?.adaptationField?.pcrFlag).toBe(true);
      expect(packet?.adaptationField?.pcr).toBeDefined();
    });
  });

  describe("Stream Type Constants", () => {
    it("should have correct stream type values", () => {
      expect(StreamType.MPEG2_VIDEO).toBe(0x02);
      expect(StreamType.H264_VIDEO).toBe(0x1b);
      expect(StreamType.H265_VIDEO).toBe(0x24);
      expect(StreamType.AAC_AUDIO).toBe(0x0f);
      expect(StreamType.AC3_AUDIO).toBe(0x81);
    });
  });

  describe("Table ID Constants", () => {
    it("should have correct table ID values", () => {
      expect(TableId.PAT).toBe(0x00);
      expect(TableId.PMT).toBe(0x02);
      expect(TableId.MGT).toBe(0xc7);
      expect(TableId.TVCT).toBe(0xc8);
      expect(TableId.EIT).toBe(0xcb);
      expect(TableId.ETT).toBe(0xcc);
    });
  });
});
