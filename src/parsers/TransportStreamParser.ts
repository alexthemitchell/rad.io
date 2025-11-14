/**
 * MPEG-2 Transport Stream Parser for ATSC
 *
 * Implements parsing of MPEG-2 Transport Stream packets for ATSC digital television.
 * Supports PSI (Program Specific Information) and PSIP (Program and System Information Protocol).
 *
 * Technical Specifications:
 * - Packet size: 188 bytes
 * - Sync byte: 0x47
 * - PAT PID: 0x0000
 * - PSIP Base PID: 0x1FFB
 *
 * References:
 * - ISO/IEC 13818-1 (MPEG-2 Systems)
 * - ATSC A/65 (Program and System Information Protocol)
 */

import { useStore } from "../store";

/**
 * Transport Stream Packet Header
 */
export interface TSPacketHeader {
  syncByte: number; // 0x47
  transportErrorIndicator: boolean;
  payloadUnitStartIndicator: boolean;
  transportPriority: boolean;
  pid: number; // 13-bit PID
  scramblingControl: number; // 2 bits
  adaptationFieldControl: number; // 2 bits
  continuityCounter: number; // 4 bits
}

/**
 * Transport Stream Packet
 */
export interface TSPacket {
  header: TSPacketHeader;
  adaptationField?: AdaptationField;
  payload?: Uint8Array;
}

/**
 * Adaptation Field
 */
export interface AdaptationField {
  length: number;
  discontinuityIndicator: boolean;
  randomAccessIndicator: boolean;
  elementaryStreamPriorityIndicator: boolean;
  pcrFlag: boolean;
  opcrFlag: boolean;
  splicingPointFlag: boolean;
  transportPrivateDataFlag: boolean;
  adaptationFieldExtensionFlag: boolean;
  pcr?: bigint; // 42-bit Program Clock Reference
  opcr?: bigint; // 42-bit Original Program Clock Reference
}

/**
 * Program Association Table (PAT)
 */
export interface ProgramAssociationTable {
  tableId: number; // 0x00
  sectionLength: number;
  transportStreamId: number;
  versionNumber: number;
  currentNextIndicator: boolean;
  sectionNumber: number;
  lastSectionNumber: number;
  programs: Map<number, number>; // program_number -> PID
  crc32: number;
}

/**
 * Program Map Table (PMT)
 */
export interface ProgramMapTable {
  tableId: number; // 0x02
  sectionLength: number;
  programNumber: number;
  versionNumber: number;
  currentNextIndicator: boolean;
  sectionNumber: number;
  lastSectionNumber: number;
  pcrPid: number;
  programInfoLength: number;
  programDescriptors: Descriptor[];
  streams: StreamInfo[];
  crc32: number;
}

/**
 * Elementary Stream Info
 */
export interface StreamInfo {
  streamType: number;
  elementaryPid: number;
  esInfoLength: number;
  descriptors: Descriptor[];
}

/**
 * Generic Descriptor
 */
export interface Descriptor {
  tag: number;
  length: number;
  data: Uint8Array;
}

/**
 * Master Guide Table (MGT) - PSIP
 */
export interface MasterGuideTable {
  tableId: number; // 0xC7
  sectionLength: number;
  protocolVersion: number;
  tablesDefinedCount: number;
  tables: TableDefinition[];
  descriptors: Descriptor[];
}

/**
 * Table Definition in MGT
 */
export interface TableDefinition {
  tableType: number;
  tablePid: number;
  versionNumber: number;
  numberOfBytes: number;
  descriptors: Descriptor[];
}

/**
 * Virtual Channel Table (VCT) - PSIP
 */
export interface VirtualChannelTable {
  tableId: number; // 0xC8 (Terrestrial) or 0xC9 (Cable)
  sectionLength: number;
  protocolVersion: number;
  numChannels: number;
  channels: VirtualChannel[];
  descriptors: Descriptor[];
}

/**
 * Virtual Channel
 */
export interface VirtualChannel {
  shortName: string; // 7 UTF-16 characters
  majorChannelNumber: number;
  minorChannelNumber: number;
  modulationMode: number;
  carrierFrequency: number;
  channelTSID: number;
  programNumber: number;
  etmLocation: number;
  accessControlled: boolean;
  hidden: boolean;
  hideGuide: boolean;
  serviceType: number;
  sourceid: number;
  descriptors: Descriptor[];
}

/**
 * Event Information Table (EIT) - PSIP
 */
export interface EventInformationTable {
  tableId: number; // 0xCB
  sectionLength: number;
  protocolVersion: number;
  sourceid: number;
  numEvents: number;
  events: Event[];
}

/**
 * Event
 */
export interface Event {
  eventid: number;
  startTime: number; // GPS seconds since 1980-01-06 00:00:00 UTC
  etmLocation: number;
  lengthInSeconds: number;
  titleLength: number;
  title: MultipleStringStructure[];
  descriptors: Descriptor[];
}

/**
 * Multiple String Structure
 */
export interface MultipleStringStructure {
  iso639LanguageCode: string;
  segments: StringSegment[];
}

/**
 * String Segment
 */
export interface StringSegment {
  compressionType: number;
  mode: number;
  numberOfBytes: number;
  compressedString: Uint8Array;
}

/**
 * Extended Text Table (ETT) - PSIP
 */
export interface ExtendedTextTable {
  tableId: number; // 0xCC
  sectionLength: number;
  protocolVersion: number;
  ettTableIdExtension: number;
  extendedTextMessage: MultipleStringStructure[];
}

/**
 * Stream Type Constants
 */
export enum StreamType {
  MPEG1_VIDEO = 0x01,
  MPEG2_VIDEO = 0x02,
  MPEG1_AUDIO = 0x03,
  MPEG2_AUDIO = 0x04,
  PRIVATE_SECTIONS = 0x05,
  PRIVATE_DATA = 0x06,
  MHEG = 0x07,
  DSM_CC = 0x08,
  H222_1 = 0x09,
  MPEG2_MULTIPROTOCOL_ENCAPSULATION = 0x0a,
  DSM_CC_U_N_MESSAGES = 0x0b,
  DSM_CC_STREAM_DESCRIPTORS = 0x0c,
  DSM_CC_SECTIONS = 0x0d,
  H222_AUXILIARY = 0x0e,
  AAC_AUDIO = 0x0f,
  MPEG4_VIDEO = 0x10,
  LATM_AAC_AUDIO = 0x11,
  H264_VIDEO = 0x1b,
  H265_VIDEO = 0x24,
  AC3_AUDIO = 0x81,
  DTS_AUDIO = 0x82,
  ATSC_PROGRAM_IDENTIFIER = 0x85,
}

/**
 * Table ID Constants
 */
export enum TableId {
  PAT = 0x00,
  CAT = 0x01,
  PMT = 0x02,
  TSDT = 0x03,
  MGT = 0xc7,
  TVCT = 0xc8, // Terrestrial Virtual Channel Table
  CVCT = 0xc9, // Cable Virtual Channel Table
  RRT = 0xca, // Rating Region Table
  EIT = 0xcb,
  ETT = 0xcc,
  STT = 0xcd, // System Time Table
  DCCT = 0xd3, // Directed Channel Change Table
  DCCSCT = 0xd4, // DCC Selection Code Table
}

/**
 * MPEG-2 Transport Stream Parser
 */
export class TransportStreamParser {
  private static readonly PACKET_SIZE = 188;
  private static readonly SYNC_BYTE = 0x47;
  private static readonly PAT_PID = 0x0000;
  private static readonly PSIP_BASE_PID = 0x1ffb;

  private patTable: ProgramAssociationTable | null = null;
  private pmtTables = new Map<number, ProgramMapTable>();
  private pidFilters = new Set<number>();
  private continuityCounters = new Map<number, number>();
  // Reserved for future use: multi-packet section reassembly
  private sectionBuffers = new Map<number, Uint8Array>();
  // Reverse lookup map: PMT PID → program number (for efficient PMT detection)
  private pmtPidToProgram = new Map<number, number>();

  // PSIP tables
  private mgtTable: MasterGuideTable | null = null;
  private vctTable: VirtualChannelTable | null = null;
  private eitTables = new Map<number, EventInformationTable>();
  private ettTables = new Map<number, ExtendedTextTable>();

  // Diagnostics
  private packetsProcessed = 0;
  private continuityErrors = 0;
  private teiErrors = 0;
  private syncErrors = 0;
  private patUpdates = 0;
  private pmtUpdates = 0;
  private lastDiagnosticsUpdate = 0;
  private diagnosticsUpdateInterval = 1000; // Update diagnostics every 1 second

  /**
   * Parse transport stream data
   */
  public parseStream(data: Uint8Array): TSPacket[] {
    const packets: TSPacket[] = [];
    let offset = 0;

    // Find first sync byte
    while (
      offset < data.length &&
      data[offset] !== TransportStreamParser.SYNC_BYTE
    ) {
      offset++;
      this.syncErrors++;
    }

    // Parse packets
    while (offset + TransportStreamParser.PACKET_SIZE <= data.length) {
      if (data[offset] !== TransportStreamParser.SYNC_BYTE) {
        // Lost sync - try to resync
        this.syncErrors++;
        offset++;
        while (
          offset < data.length &&
          data[offset] !== TransportStreamParser.SYNC_BYTE
        ) {
          offset++;
          this.syncErrors++;
        }
        continue;
      }

      const packet = this.parsePacket(
        data.subarray(offset, offset + TransportStreamParser.PACKET_SIZE),
      );
      if (packet) {
        packets.push(packet);
        this.processPacket(packet);
        this.packetsProcessed++;
      }

      offset += TransportStreamParser.PACKET_SIZE;
    }

    // Update diagnostics
    this.updateDiagnostics();

    return packets;
  }

  /**
   * Parse a single 188-byte transport packet
   */
  public parsePacket(data: Uint8Array): TSPacket | null {
    if (
      data.length !== TransportStreamParser.PACKET_SIZE ||
      data[0] !== TransportStreamParser.SYNC_BYTE
    ) {
      return null;
    }

    const header = this.parsePacketHeader(data);
    if (!header) {
      return null;
    }

    let offset = 4; // Header is 4 bytes
    let adaptationField: AdaptationField | undefined;
    let payload: Uint8Array | undefined;

    // Parse adaptation field if present
    if (
      header.adaptationFieldControl === 0x02 ||
      header.adaptationFieldControl === 0x03
    ) {
      const afLength = data[offset] ?? 0;
      offset++;
      if (afLength > 0 && offset + afLength <= data.length) {
        const af = this.parseAdaptationField(
          data.subarray(offset, offset + afLength),
        );
        if (af) {
          adaptationField = af;
        }
        offset += afLength;
      }
    }

    // Extract payload if present
    if (
      header.adaptationFieldControl === 0x01 ||
      header.adaptationFieldControl === 0x03
    ) {
      if (offset < data.length) {
        payload = data.subarray(offset);
      }
    }

    return {
      header,
      adaptationField,
      payload,
    };
  }

  /**
   * Parse packet header (first 4 bytes)
   */
  private parsePacketHeader(data: Uint8Array): TSPacketHeader | null {
    if (data.length < 4) {
      return null;
    }

    const byte0 = data[0] ?? 0;
    const byte1 = data[1] ?? 0;
    const byte2 = data[2] ?? 0;
    const byte3 = data[3] ?? 0;

    return {
      syncByte: byte0,
      transportErrorIndicator: (byte1 & 0x80) !== 0,
      payloadUnitStartIndicator: (byte1 & 0x40) !== 0,
      transportPriority: (byte1 & 0x20) !== 0,
      pid: ((byte1 & 0x1f) << 8) | byte2,
      scramblingControl: (byte3 >> 6) & 0x03,
      adaptationFieldControl: (byte3 >> 4) & 0x03,
      continuityCounter: byte3 & 0x0f,
    };
  }

  /**
   * Parse adaptation field
   */
  private parseAdaptationField(data: Uint8Array): AdaptationField | null {
    if (data.length === 0) {
      return null;
    }

    const byte0 = data[0] ?? 0;

    const field: AdaptationField = {
      length: data.length,
      discontinuityIndicator: (byte0 & 0x80) !== 0,
      randomAccessIndicator: (byte0 & 0x40) !== 0,
      elementaryStreamPriorityIndicator: (byte0 & 0x20) !== 0,
      pcrFlag: (byte0 & 0x10) !== 0,
      opcrFlag: (byte0 & 0x08) !== 0,
      splicingPointFlag: (byte0 & 0x04) !== 0,
      transportPrivateDataFlag: (byte0 & 0x02) !== 0,
      adaptationFieldExtensionFlag: (byte0 & 0x01) !== 0,
    };

    let offset = 1;

    // Parse PCR if present
    if (field.pcrFlag && offset + 6 <= data.length) {
      field.pcr = this.parsePCR(data.subarray(offset, offset + 6));
      offset += 6;
    }

    // Parse OPCR if present
    if (field.opcrFlag && offset + 6 <= data.length) {
      field.opcr = this.parsePCR(data.subarray(offset, offset + 6));
      offset += 6;
    }

    return field;
  }

  /**
   * Parse Program Clock Reference (42 bits)
   */
  private parsePCR(data: Uint8Array): bigint {
    if (data.length < 6) {
      return BigInt(0);
    }

    const byte0 = BigInt(data[0] ?? 0);
    const byte1 = BigInt(data[1] ?? 0);
    const byte2 = BigInt(data[2] ?? 0);
    const byte3 = BigInt(data[3] ?? 0);
    const byte4 = BigInt(data[4] ?? 0);
    const byte5 = BigInt(data[5] ?? 0);

    // PCR base (33 bits)
    const pcrBase =
      (byte0 << BigInt(25)) |
      (byte1 << BigInt(17)) |
      (byte2 << BigInt(9)) |
      (byte3 << BigInt(1)) |
      (byte4 >> BigInt(7));

    // PCR extension (9 bits)
    const pcrExt = ((byte4 & BigInt(0x01)) << BigInt(8)) | byte5;

    return pcrBase * BigInt(300) + pcrExt;
  }

  /**
   * Process a parsed packet
   */
  private processPacket(packet: TSPacket): void {
    const pid = packet.header.pid;

    // Validate continuity counter
    if (!this.validateContinuityCounter(packet)) {
      // Continuity error detected
      return;
    }

    // Check if this PID should be filtered
    // Always allow PAT and PSIP base tables through
    if (
      this.pidFilters.size > 0 &&
      !this.pidFilters.has(pid) &&
      pid !== TransportStreamParser.PAT_PID &&
      pid !== TransportStreamParser.PSIP_BASE_PID
    ) {
      return;
    }

    // Process PAT
    if (pid === TransportStreamParser.PAT_PID) {
      this.processPAT(packet);
      return;
    }

    // Process PSIP base table
    if (pid === TransportStreamParser.PSIP_BASE_PID) {
      this.processPSIP(packet);
      return;
    }

    // Process PMT if this PID is registered as PMT (efficient O(1) lookup)
    const programNumber = this.pmtPidToProgram.get(pid);
    if (programNumber !== undefined) {
      this.processPMT(packet, programNumber);
      return;
    }
  }

  /**
   * Validate continuity counter
   */
  private validateContinuityCounter(packet: TSPacket): boolean {
    const pid = packet.header.pid;
    const cc = packet.header.continuityCounter;

    // Track TEI errors
    if (packet.header.transportErrorIndicator) {
      this.teiErrors++;
    }

    // Skip validation if no payload
    if (!packet.payload || packet.payload.length === 0) {
      return true;
    }

    if (this.continuityCounters.has(pid)) {
      const expectedCC = ((this.continuityCounters.get(pid) ?? 0) + 1) & 0x0f;
      if (cc !== expectedCC) {
        // Continuity error - might indicate packet loss
        this.continuityErrors++;
        // Update to current value and continue
        this.continuityCounters.set(pid, cc);
        return false;
      }
    }

    this.continuityCounters.set(pid, cc);
    return true;
  }

  /**
   * Process Program Association Table
   */
  private processPAT(packet: TSPacket): void {
    if (!packet.payload || packet.payload.length === 0) {
      return;
    }

    const data = packet.payload;
    let offset = 0;

    // Handle pointer field if payload unit start
    if (packet.header.payloadUnitStartIndicator) {
      const pointerField = data[0] ?? 0;
      offset = 1 + pointerField;
      if (offset >= data.length) {
        return;
      }
    }

    const tableId = data[offset] ?? 0;
    if (tableId !== (TableId.PAT as number)) {
      return;
    }

    // Parse section length
    const byte1 = data[offset + 1] ?? 0;
    const byte2 = data[offset + 2] ?? 0;
    const sectionLength = ((byte1 & 0x0f) << 8) | byte2;

    if (offset + 3 + sectionLength > data.length) {
      return; // Incomplete section
    }

    const section = data.subarray(offset, offset + 3 + sectionLength);
    this.patTable = this.parsePAT(section);

    // Track PAT update
    if (this.patTable) {
      this.patUpdates++;
    }

    // Update reverse lookup map for efficient PMT detection
    if (this.patTable) {
      this.pmtPidToProgram.clear();
      for (const [programNumber, pmtPid] of this.patTable.programs.entries()) {
        this.pmtPidToProgram.set(pmtPid, programNumber);
      }
    }
  }

  /**
   * Parse PAT section
   */
  private parsePAT(data: Uint8Array): ProgramAssociationTable | null {
    if (data.length < 12) {
      return null;
    }

    const tableId = data[0] ?? 0;
    const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
    const transportStreamId = ((data[3] ?? 0) << 8) | (data[4] ?? 0);
    const versionNumber = ((data[5] ?? 0) >> 1) & 0x1f;
    const currentNextIndicator = ((data[5] ?? 0) & 0x01) !== 0;
    const sectionNumber = data[6] ?? 0;
    const lastSectionNumber = data[7] ?? 0;

    const programs = new Map<number, number>();
    let offset = 8;
    const endOffset = 3 + sectionLength - 4; // Exclude CRC

    while (offset + 4 <= endOffset && offset < data.length) {
      const programNumber =
        ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
      const pid =
        (((data[offset + 2] ?? 0) & 0x1f) << 8) | (data[offset + 3] ?? 0);

      if (programNumber !== 0) {
        // Program number 0 is Network PID
        programs.set(programNumber, pid);
      }

      offset += 4;
    }

    // Parse CRC
    let crcOffset = 3 + sectionLength - 4;
    if (data.length < 4) {
      return null;
    }
    if (crcOffset + 4 > data.length) {
      crcOffset = data.length - 4;
    }
    const crc32 =
      (((data[crcOffset] ?? 0) << 24) |
        ((data[crcOffset + 1] ?? 0) << 16) |
        ((data[crcOffset + 2] ?? 0) << 8) |
        (data[crcOffset + 3] ?? 0)) >>>
      0;

    return {
      tableId,
      sectionLength,
      transportStreamId,
      versionNumber,
      currentNextIndicator,
      sectionNumber,
      lastSectionNumber,
      programs,
      crc32,
    };
  }

  /**
   * Process Program Map Table
   */
  private processPMT(packet: TSPacket, programNumber: number): void {
    if (!packet.payload || packet.payload.length === 0) {
      return;
    }

    const data = packet.payload;
    let offset = 0;

    // Handle pointer field if payload unit start
    if (packet.header.payloadUnitStartIndicator) {
      const pointerField = data[0] ?? 0;
      offset = 1 + pointerField;
      if (offset >= data.length) {
        return;
      }
    }

    const tableId = data[offset] ?? 0;
    if (tableId !== (TableId.PMT as number)) {
      return;
    }

    // Parse section length
    const byte1 = data[offset + 1] ?? 0;
    const byte2 = data[offset + 2] ?? 0;
    const sectionLength = ((byte1 & 0x0f) << 8) | byte2;

    if (offset + 3 + sectionLength > data.length) {
      return; // Incomplete section
    }

    const section = data.subarray(offset, offset + 3 + sectionLength);
    const pmt = this.parsePMT(section, programNumber);
    if (pmt) {
      this.pmtTables.set(programNumber, pmt);
      this.pmtUpdates++;
    }
  }

  /**
   * Parse PMT section
   */
  private parsePMT(
    data: Uint8Array,
    programNumber: number,
  ): ProgramMapTable | null {
    if (data.length < 16) {
      return null;
    }

    const tableId = data[0] ?? 0;
    const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
    const versionNumber = ((data[5] ?? 0) >> 1) & 0x1f;
    const currentNextIndicator = ((data[5] ?? 0) & 0x01) !== 0;
    const sectionNumber = data[6] ?? 0;
    const lastSectionNumber = data[7] ?? 0;
    const pcrPid = (((data[8] ?? 0) & 0x1f) << 8) | (data[9] ?? 0);
    const programInfoLength = (((data[10] ?? 0) & 0x0f) << 8) | (data[11] ?? 0);

    let offset = 12;

    // Parse program descriptors
    if (offset + programInfoLength > data.length) {
      return null;
    }
    const programDescriptors = this.parseDescriptors(
      data.subarray(offset, offset + programInfoLength),
    );
    offset += programInfoLength;

    // Parse streams
    const streams: StreamInfo[] = [];
    const endOffset = 3 + sectionLength - 4; // Exclude CRC

    while (offset + 5 <= endOffset && offset < data.length) {
      const streamType = data[offset] ?? 0;
      const elementaryPid =
        (((data[offset + 1] ?? 0) & 0x1f) << 8) | (data[offset + 2] ?? 0);
      const esInfoLength =
        (((data[offset + 3] ?? 0) & 0x0f) << 8) | (data[offset + 4] ?? 0);

      offset += 5;

      // Bounds check before parsing descriptors
      if (offset + esInfoLength > data.length) {
        break;
      }

      const descriptors = this.parseDescriptors(
        data.subarray(offset, offset + esInfoLength),
      );
      offset += esInfoLength;

      streams.push({
        streamType,
        elementaryPid,
        esInfoLength,
        descriptors,
      });
    }

    // Parse CRC
    let crcOffset = 3 + sectionLength - 4;
    if (crcOffset + 4 > data.length) {
      crcOffset = data.length - 4;
    }
    const crc32 =
      (((data[crcOffset] ?? 0) << 24) |
        ((data[crcOffset + 1] ?? 0) << 16) |
        ((data[crcOffset + 2] ?? 0) << 8) |
        (data[crcOffset + 3] ?? 0)) >>>
      0;

    return {
      tableId,
      sectionLength,
      programNumber,
      versionNumber,
      currentNextIndicator,
      sectionNumber,
      lastSectionNumber,
      pcrPid,
      programInfoLength,
      programDescriptors,
      streams,
      crc32,
    };
  }

  /**
   * Parse descriptors
   */
  private parseDescriptors(data: Uint8Array): Descriptor[] {
    const descriptors: Descriptor[] = [];
    let offset = 0;

    while (offset + 2 <= data.length) {
      const tag = data[offset] ?? 0;
      const length = data[offset + 1] ?? 0;

      if (offset + 2 + length > data.length) {
        break;
      }

      descriptors.push({
        tag,
        length,
        data: data.subarray(offset + 2, offset + 2 + length),
      });

      offset += 2 + length;
    }

    return descriptors;
  }

  /**
   * Process PSIP tables
   */
  private processPSIP(packet: TSPacket): void {
    if (!packet.payload || packet.payload.length === 0) {
      return;
    }

    const data = packet.payload;
    let offset = 0;

    // Handle pointer field if payload unit start
    if (packet.header.payloadUnitStartIndicator) {
      const pointerField = data[0] ?? 0;
      offset = 1 + pointerField;
      if (offset >= data.length) {
        return;
      }
    }

    const tableId = data[offset] ?? 0;

    switch (tableId as TableId) {
      case TableId.MGT:
        this.processMGT(data.subarray(offset));
        break;
      case TableId.TVCT:
      case TableId.CVCT:
        this.processVCT(data.subarray(offset));
        break;
      case TableId.EIT:
        this.processEIT(data.subarray(offset));
        break;
      case TableId.ETT:
        this.processETT(data.subarray(offset));
        break;
      case TableId.PAT:
      case TableId.CAT:
      case TableId.PMT:
      case TableId.TSDT:
      case TableId.RRT:
      case TableId.STT:
      case TableId.DCCT:
      case TableId.DCCSCT:
      default:
        // Unhandled PSIP table types - ignore
        break;
    }
  }

  /**
   * Process Master Guide Table
   */
  private processMGT(data: Uint8Array): void {
    if (data.length < 17) {
      return;
    }

    const tableId = data[0] ?? 0;
    const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
    const protocolVersion = data[8] ?? 0;
    const tablesDefinedCount = ((data[9] ?? 0) << 8) | (data[10] ?? 0);

    const tables: TableDefinition[] = [];
    let offset = 11;

    for (let i = 0; i < tablesDefinedCount && offset + 11 <= data.length; i++) {
      const tableType = ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
      const tablePid =
        (((data[offset + 2] ?? 0) & 0x1f) << 8) | (data[offset + 3] ?? 0);
      const versionNumber = (data[offset + 4] ?? 0) & 0x1f;
      const numberOfBytes =
        (((data[offset + 5] ?? 0) << 24) |
          ((data[offset + 6] ?? 0) << 16) |
          ((data[offset + 7] ?? 0) << 8) |
          (data[offset + 8] ?? 0)) >>>
        0;
      const tableDescriptorsLength =
        (((data[offset + 9] ?? 0) & 0x0f) << 8) | (data[offset + 10] ?? 0);

      offset += 11;

      // Bounds check: ensure we have enough data for tableDescriptorsLength
      if (offset + tableDescriptorsLength > data.length) {
        break;
      }

      const descriptors = this.parseDescriptors(
        data.subarray(offset, offset + tableDescriptorsLength),
      );
      offset += tableDescriptorsLength;

      tables.push({
        tableType,
        tablePid,
        versionNumber,
        numberOfBytes,
        descriptors,
      });
    }

    // Bounds check: ensure we have at least two bytes to read descriptorsLength
    if (offset + 2 > data.length) {
      return;
    }

    const descriptorsLength =
      (((data[offset] ?? 0) & 0x0f) << 8) | (data[offset + 1] ?? 0);
    offset += 2;

    // Bounds check: ensure we have enough data for descriptors
    if (offset + descriptorsLength > data.length) {
      return;
    }

    const descriptors = this.parseDescriptors(
      data.subarray(offset, offset + descriptorsLength),
    );

    this.mgtTable = {
      tableId,
      sectionLength,
      protocolVersion,
      tablesDefinedCount,
      tables,
      descriptors,
    };
  }

  /**
   * Process Virtual Channel Table
   */
  private processVCT(data: Uint8Array): void {
    if (data.length < 14) {
      return;
    }

    const tableId = data[0] ?? 0;
    const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
    const protocolVersion = data[8] ?? 0;
    const numChannels = data[9] ?? 0;

    const channels: VirtualChannel[] = [];
    let offset = 10;

    for (let i = 0; i < numChannels && offset + 32 <= data.length; i++) {
      // Parse short name (14 bytes, 7 UTF-16 characters)
      let shortName = "";
      for (let j = 0; j < 7; j++) {
        const charCode =
          ((data[offset + j * 2] ?? 0) << 8) | (data[offset + j * 2 + 1] ?? 0);
        if (charCode !== 0) {
          shortName += String.fromCharCode(charCode);
        }
      }
      offset += 14;

      const majorChannelNumber =
        (((data[offset] ?? 0) & 0x0f) << 6) |
        (((data[offset + 1] ?? 0) >> 2) & 0x3f);
      const minorChannelNumber =
        (((data[offset + 1] ?? 0) & 0x03) << 8) | (data[offset + 2] ?? 0);
      const modulationMode = data[offset + 3] ?? 0;
      const carrierFrequency =
        (((data[offset + 4] ?? 0) << 24) |
          ((data[offset + 5] ?? 0) << 16) |
          ((data[offset + 6] ?? 0) << 8) |
          (data[offset + 7] ?? 0)) >>>
        0;
      const channelTSID =
        ((data[offset + 8] ?? 0) << 8) | (data[offset + 9] ?? 0);
      const programNumber =
        ((data[offset + 10] ?? 0) << 8) | (data[offset + 11] ?? 0);
      const etmLocation = ((data[offset + 12] ?? 0) >> 6) & 0x03;
      const accessControlled = ((data[offset + 12] ?? 0) & 0x20) !== 0;
      const hidden = ((data[offset + 12] ?? 0) & 0x10) !== 0;
      const hideGuide = ((data[offset + 12] ?? 0) & 0x02) !== 0;
      const serviceType = (data[offset + 13] ?? 0) & 0x3f;
      const sourceid =
        ((data[offset + 14] ?? 0) << 8) | (data[offset + 15] ?? 0);
      const descriptorsLength =
        (((data[offset + 16] ?? 0) & 0x03) << 8) | (data[offset + 17] ?? 0);

      offset += 18;

      // Bounds check before parsing descriptors
      if (offset + descriptorsLength > data.length) break;

      const descriptors = this.parseDescriptors(
        data.subarray(offset, offset + descriptorsLength),
      );
      offset += descriptorsLength;

      channels.push({
        shortName: shortName.trim(),
        majorChannelNumber,
        minorChannelNumber,
        modulationMode,
        carrierFrequency,
        channelTSID,
        programNumber,
        etmLocation,
        accessControlled,
        hidden,
        hideGuide,
        serviceType,
        sourceid,
        descriptors,
      });
    }

    // Bounds check: ensure we have at least two bytes to read descriptorsLength
    if (offset + 2 > data.length) {
      return;
    }

    const descriptorsLength =
      (((data[offset] ?? 0) & 0x03) << 8) | (data[offset + 1] ?? 0);
    offset += 2;

    // Bounds check: ensure we do not read past the end of data
    if (offset + descriptorsLength > data.length) {
      return;
    }

    const descriptors = this.parseDescriptors(
      data.subarray(offset, offset + descriptorsLength),
    );

    this.vctTable = {
      tableId,
      sectionLength,
      protocolVersion,
      numChannels,
      channels,
      descriptors,
    };
  }

  /**
   * Process Event Information Table
   */
  private processEIT(data: Uint8Array): void {
    if (data.length < 14) {
      return;
    }

    const tableId = data[0] ?? 0;
    const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
    const protocolVersion = data[8] ?? 0;
    const sourceid = ((data[9] ?? 0) << 8) | (data[10] ?? 0);
    const numEvents = data[11] ?? 0;

    const events: Event[] = [];
    let offset = 12;

    for (let i = 0; i < numEvents && offset + 12 <= data.length; i++) {
      const eventid = ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
      const startTime =
        (((data[offset + 2] ?? 0) << 24) |
          ((data[offset + 3] ?? 0) << 16) |
          ((data[offset + 4] ?? 0) << 8) |
          (data[offset + 5] ?? 0)) >>>
        0;
      const etmLocation = ((data[offset + 6] ?? 0) >> 6) & 0x03;
      const lengthInSeconds =
        (((data[offset + 6] ?? 0) & 0x0f) << 16) |
        ((data[offset + 7] ?? 0) << 8) |
        (data[offset + 8] ?? 0);
      const titleLength = data[offset + 9] ?? 0;

      offset += 10;

      // Parse multiple string structure for title
      const title = this.parseMultipleStringStructure(
        data.subarray(offset, offset + titleLength),
      );
      offset += titleLength;

      const descriptorsLength =
        (((data[offset] ?? 0) & 0x0f) << 8) | (data[offset + 1] ?? 0);
      offset += 2;

      // Bounds check before parsing descriptors
      if (offset + descriptorsLength > data.length) break;

      const descriptors = this.parseDescriptors(
        data.subarray(offset, offset + descriptorsLength),
      );
      offset += descriptorsLength;

      events.push({
        eventid,
        startTime,
        etmLocation,
        lengthInSeconds,
        titleLength,
        title,
        descriptors,
      });
    }

    const eit: EventInformationTable = {
      tableId,
      sectionLength,
      protocolVersion,
      sourceid,
      numEvents,
      events,
    };

    this.eitTables.set(sourceid, eit);
  }

  /**
   * Process Extended Text Table
   */
  private processETT(data: Uint8Array): void {
    if (data.length < 13) {
      return;
    }

    const tableId = data[0] ?? 0;
    const sectionLength = (((data[1] ?? 0) & 0x0f) << 8) | (data[2] ?? 0);
    const protocolVersion = data[8] ?? 0;
    const ettTableIdExtension = ((data[3] ?? 0) << 8) | (data[4] ?? 0);

    const messageLength = sectionLength - 10; // Subtract header and CRC
    if (9 + messageLength > data.length) {
      return;
    }
    const extendedTextMessage = this.parseMultipleStringStructure(
      data.subarray(9, 9 + messageLength),
    );

    const ett: ExtendedTextTable = {
      tableId,
      sectionLength,
      protocolVersion,
      ettTableIdExtension,
      extendedTextMessage,
    };

    this.ettTables.set(ettTableIdExtension, ett);
  }

  /**
   * Parse Multiple String Structure
   */
  private parseMultipleStringStructure(
    data: Uint8Array,
  ): MultipleStringStructure[] {
    const structures: MultipleStringStructure[] = [];
    let offset = 0;

    if (offset >= data.length) {
      return structures;
    }

    const numberOfStrings = data[offset] ?? 0;
    offset++;

    for (let i = 0; i < numberOfStrings && offset + 4 <= data.length; i++) {
      const iso639LanguageCode = String.fromCharCode(
        data[offset] ?? 0,
        data[offset + 1] ?? 0,
        data[offset + 2] ?? 0,
      );
      const numberOfSegments = data[offset + 3] ?? 0;
      offset += 4;

      const segments: StringSegment[] = [];

      for (let j = 0; j < numberOfSegments && offset + 3 <= data.length; j++) {
        const compressionType = data[offset] ?? 0;
        const mode = data[offset + 1] ?? 0;
        const numberOfBytes = data[offset + 2] ?? 0;
        offset += 3;

        if (offset + numberOfBytes > data.length) {
          break;
        }

        const compressedString = data.subarray(offset, offset + numberOfBytes);
        offset += numberOfBytes;

        segments.push({
          compressionType,
          mode,
          numberOfBytes,
          compressedString,
        });
      }

      structures.push({
        iso639LanguageCode,
        segments,
      });
    }

    return structures;
  }

  /**
   * Add PID to filter list
   */
  public addPIDFilter(pid: number): void {
    this.pidFilters.add(pid);
  }

  /**
   * Remove PID from filter list
   */
  public removePIDFilter(pid: number): void {
    this.pidFilters.delete(pid);
  }

  /**
   * Clear all PID filters
   */
  public clearPIDFilters(): void {
    this.pidFilters.clear();
  }

  /**
   * Get PAT
   */
  public getPAT(): ProgramAssociationTable | null {
    return this.patTable;
  }

  /**
   * Get PMT for program
   */
  public getPMT(programNumber: number): ProgramMapTable | null {
    return this.pmtTables.get(programNumber) ?? null;
  }

  /**
   * Get all PMTs
   */
  public getAllPMTs(): Map<number, ProgramMapTable> {
    return this.pmtTables;
  }

  /**
   * Get MGT
   */
  public getMGT(): MasterGuideTable | null {
    return this.mgtTable;
  }

  /**
   * Get VCT
   */
  public getVCT(): VirtualChannelTable | null {
    return this.vctTable;
  }

  /**
   * Get EIT for source
   */
  public getEIT(sourceid: number): EventInformationTable | null {
    return this.eitTables.get(sourceid) ?? null;
  }

  /**
   * Get all EITs
   */
  public getAllEITs(): Map<number, EventInformationTable> {
    return this.eitTables;
  }

  /**
   * Get ETT
   */
  public getETT(ettId: number): ExtendedTextTable | null {
    return this.ettTables.get(ettId) ?? null;
  }

  /**
   * Reset parser state
   */
  public reset(): void {
    this.patTable = null;
    this.pmtTables.clear();
    this.pmtPidToProgram.clear();
    this.continuityCounters.clear();
    this.sectionBuffers.clear();
    this.mgtTable = null;
    this.vctTable = null;
    this.eitTables.clear();
    this.ettTables.clear();
  }

  /**
   * Demultiplex stream by PID
   */
  public demultiplex(packets: TSPacket[], pid: number): Uint8Array[] {
    const payloads: Uint8Array[] = [];

    for (const packet of packets) {
      if (packet.header.pid === pid && packet.payload) {
        payloads.push(packet.payload);
      }
    }

    return payloads;
  }

  /**
   * Get elementary streams from PMT
   */
  public getElementaryStreams(
    programNumber: number,
  ): Map<StreamType, number[]> {
    const pmt = this.pmtTables.get(programNumber);
    if (!pmt) {
      return new Map();
    }

    const streams = new Map<StreamType, number[]>();

    for (const stream of pmt.streams) {
      const streamType = stream.streamType as StreamType;
      if (!streams.has(streamType)) {
        streams.set(streamType, []);
      }
      const pids = streams.get(streamType);
      if (pids) {
        pids.push(stream.elementaryPid);
      }
    }

    return streams;
  }

  /**
   * Get video PIDs for program
   */
  public getVideoPIDs(programNumber: number): number[] {
    const streams = this.getElementaryStreams(programNumber);
    const videoPIDs: number[] = [];

    const videoTypes = [
      StreamType.MPEG1_VIDEO,
      StreamType.MPEG2_VIDEO,
      StreamType.MPEG4_VIDEO,
      StreamType.H264_VIDEO,
      StreamType.H265_VIDEO,
    ];

    for (const type of videoTypes) {
      const pids = streams.get(type);
      if (pids) {
        videoPIDs.push(...pids);
      }
    }

    return videoPIDs;
  }

  /**
   * Get audio PIDs for program
   */
  public getAudioPIDs(programNumber: number): number[] {
    const streams = this.getElementaryStreams(programNumber);
    const audioPIDs: number[] = [];

    const audioTypes = [
      StreamType.MPEG1_AUDIO,
      StreamType.MPEG2_AUDIO,
      StreamType.AAC_AUDIO,
      StreamType.LATM_AAC_AUDIO,
      StreamType.AC3_AUDIO,
      StreamType.DTS_AUDIO,
    ];

    for (const type of audioTypes) {
      const pids = streams.get(type);
      if (pids) {
        audioPIDs.push(...pids);
      }
    }

    return audioPIDs;
  }

  /**
   * Update diagnostics metrics
   */
  private updateDiagnostics(): void {
    const now = Date.now();
    if (now - this.lastDiagnosticsUpdate < this.diagnosticsUpdateInterval) {
      return;
    }

    this.lastDiagnosticsUpdate = now;

    try {
      const store = useStore.getState();

      store.updateTSParserMetrics({
        packetsProcessed: this.packetsProcessed,
        continuityErrors: this.continuityErrors,
        teiErrors: this.teiErrors,
        syncErrors: this.syncErrors,
        patUpdates: this.patUpdates,
        pmtUpdates: this.pmtUpdates,
      });

      // Add diagnostic events for errors
      if (this.continuityErrors > 0 && this.packetsProcessed % 1000 === 0) {
        store.addDiagnosticEvent({
          source: "ts-parser",
          severity: "warning",
          message: `Continuity errors detected: ${this.continuityErrors}`,
        });
      }

      if (this.syncErrors > 100) {
        store.addDiagnosticEvent({
          source: "ts-parser",
          severity: "error",
          message: `High sync error rate: ${this.syncErrors} errors`,
        });
      }
    } catch (_error) {
      // Silently fail if store is not available
    }
  }
}
