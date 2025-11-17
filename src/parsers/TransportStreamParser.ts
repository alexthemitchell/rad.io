/**
 * MPEG-2 Transport Stream Parser for ATSC
 *
 * Main parser class that orchestrates packet parsing, PSI table extraction,
 * and PSIP table management. Internal implementation is split across submodules
 * in the ts/ directory for better maintainability:
 *
 * - ts/types.ts: Type definitions and enums
 * - ts/tsPacket.ts: Low-level packet parsing
 * - ts/psi.ts: PSI parsing (PAT, PMT)
 * - ts/psip.ts: PSIP parsing (MGT, VCT, EIT, ETT)
 * - ts/descriptors.ts: Generic descriptor parsing
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

// Re-export all types and enums for backward compatibility
export * from "./ts/types";

// Import parsing functions from internal modules
import {
  PACKET_SIZE,
  SYNC_BYTE,
  parsePacket,
} from "./ts/tsPacket";
import {
  parsePAT,
  parsePMT,
} from "./ts/psi";
import {
  parseMGT,
  parseVCT,
  parseEIT,
  parseETT,
} from "./ts/psip";
import type {
  TSPacket,
  ProgramAssociationTable,
  ProgramMapTable,
  MasterGuideTable,
  VirtualChannelTable,
  EventInformationTable,
  ExtendedTextTable,
} from "./ts/types";
import { TableId, StreamType } from "./ts/types";

/**
 * MPEG-2 Transport Stream Parser
 */
export class TransportStreamParser {
  private static readonly PAT_PID = 0x0000;
  private static readonly PSIP_BASE_PID = 0x1ffb;

  // Diagnostic thresholds
  private static readonly CONTINUITY_ERROR_THRESHOLD = 5;
  private static readonly SYNC_ERROR_THRESHOLD = 10;

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
  // Track previous error counts to detect deltas
  private lastContinuityErrors = 0;
  private lastSyncErrors = 0;

  /**
   * Parse transport stream data
   */
  public parseStream(data: Uint8Array): TSPacket[] {
    const packets: TSPacket[] = [];
    let offset = 0;

    // Find first sync byte
    while (offset < data.length && data[offset] !== SYNC_BYTE) {
      offset++;
      this.syncErrors++;
    }

    // Parse packets
    while (offset + PACKET_SIZE <= data.length) {
      if (data[offset] !== SYNC_BYTE) {
        // Lost sync - try to resync
        this.syncErrors++;
        offset++;
        while (offset < data.length && data[offset] !== SYNC_BYTE) {
          offset++;
          this.syncErrors++;
        }
        continue;
      }

      const packet = parsePacket(data.subarray(offset, offset + PACKET_SIZE));
      if (packet) {
        packets.push(packet);
        this.processPacket(packet);
        this.packetsProcessed++;
      }

      offset += PACKET_SIZE;
    }

    // Update diagnostics
    this.updateDiagnostics();

    return packets;
  }

  /**
   * Parse a single 188-byte transport packet
   */
  public parsePacket(data: Uint8Array): TSPacket | null {
    return parsePacket(data);
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
    this.patTable = parsePAT(section);

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
    const pmt = parsePMT(section, programNumber);
    if (pmt) {
      this.pmtTables.set(programNumber, pmt);
      this.pmtUpdates++;
    }
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
    const mgt = parseMGT(data);
    if (mgt) {
      this.mgtTable = mgt;
    }
  }

  /**
   * Process Virtual Channel Table
   */
  private processVCT(data: Uint8Array): void {
    const vct = parseVCT(data);
    if (vct) {
      this.vctTable = vct;
    }
  }

  /**
   * Process Event Information Table
   */
  private processEIT(data: Uint8Array): void {
    const eit = parseEIT(data);
    if (eit) {
      this.eitTables.set(eit.sourceid, eit);
    }
  }

  /**
   * Process Extended Text Table
   */
  private processETT(data: Uint8Array): void {
    const ett = parseETT(data);
    if (ett) {
      this.ettTables.set(ett.ettTableIdExtension, ett);
    }
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

      // Add diagnostic events for new errors only (track deltas)
      // Use consistent threshold: report if significant new errors occur
      const newContinuityErrors =
        this.continuityErrors - this.lastContinuityErrors;
      if (
        newContinuityErrors > TransportStreamParser.CONTINUITY_ERROR_THRESHOLD
      ) {
        store.addDiagnosticEvent({
          source: "ts-parser",
          severity: "warning",
          message: `Continuity errors: +${newContinuityErrors} (total: ${this.continuityErrors})`,
        });
        this.lastContinuityErrors = this.continuityErrors;
      }

      const newSyncErrors = this.syncErrors - this.lastSyncErrors;
      if (newSyncErrors > TransportStreamParser.SYNC_ERROR_THRESHOLD) {
        // Only report if significant new errors
        store.addDiagnosticEvent({
          source: "ts-parser",
          severity: "error",
          message: `High sync error rate: +${newSyncErrors} errors (total: ${this.syncErrors})`,
        });
        this.lastSyncErrors = this.syncErrors;
      }
    } catch (_error) {
      // Silently fail if store is not available
    }
  }
}
