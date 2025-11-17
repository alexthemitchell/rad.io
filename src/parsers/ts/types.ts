/**
 * Type definitions for MPEG-2 Transport Stream and ATSC PSIP
 *
 * This module contains all interface and enum definitions used throughout
 * the Transport Stream parser.
 */

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
 * Transport Stream Packet
 */
export interface TSPacket {
  header: TSPacketHeader;
  adaptationField?: AdaptationField;
  payload?: Uint8Array;
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
 * Elementary Stream Info
 */
export interface StreamInfo {
  streamType: number;
  elementaryPid: number;
  esInfoLength: number;
  descriptors: Descriptor[];
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
 * String Segment
 */
export interface StringSegment {
  compressionType: number;
  mode: number;
  numberOfBytes: number;
  compressedString: Uint8Array;
}

/**
 * Multiple String Structure
 */
export interface MultipleStringStructure {
  iso639LanguageCode: string;
  segments: StringSegment[];
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
