/**
 * CEA-708 Digital Closed Caption Decoder
 *
 * Implements CEA-708 (ANSI/CTA-708-E) digital closed captioning decoder
 * for ATSC broadcasts. Extracts and decodes caption data from video
 * elementary streams and provides rendered caption output.
 *
 * @see docs/reference/cea-708-captions.md
 */

/**
 * Caption service identifier (1-6)
 */
export type CaptionService = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Caption window anchor point
 */
export interface CaptionAnchorPoint {
  vertical: number; // 0-100 percentage
  horizontal: number; // 0-100 percentage
  anchorId: number; // 0-8
}

/**
 * Caption window definition
 */
export interface CaptionWindow {
  id: number; // 0-7
  visible: boolean;
  anchorPoint: CaptionAnchorPoint;
  rowCount: number;
  columnCount: number;
  rowLock: boolean;
  columnLock: boolean;
  priority: number; // 0-7
  relativePositioning: boolean;
  anchorVertical: number;
  anchorHorizontal: number;
  windowStyle: number; // 0-7
  penStyle: number; // 0-7
}

/**
 * Pen attributes for text styling
 */
export interface PenAttributes {
  penSize: "small" | "standard" | "large";
  fontStyle:
    | "default"
    | "mono_serif"
    | "prop_serif"
    | "mono_sans"
    | "prop_sans"
    | "casual"
    | "cursive"
    | "small_caps";
  textTag: number; // 0-15
  offset: "subscript" | "normal" | "superscript";
  italics: boolean;
  underline: boolean;
  edgeType: "none" | "raised" | "depressed" | "uniform" | "drop_shadow";
}

/**
 * Pen color (RGBA)
 */
export interface PenColor {
  red: number; // 0-255
  green: number; // 0-255
  blue: number; // 0-255
  opacity: "solid" | "flash" | "translucent" | "transparent";
}

/**
 * Pen location within window
 */
export interface PenLocation {
  row: number;
  column: number;
}

/**
 * Caption text with styling
 */
export interface CaptionText {
  text: string;
  penAttributes: PenAttributes;
  foregroundColor: PenColor;
  backgroundColor: PenColor;
  edgeColor: PenColor;
}

/**
 * Service block from DTVCC packet
 */
export interface ServiceBlock {
  serviceNumber: CaptionService;
  blockSize: number;
  data: Uint8Array;
}

/**
 * Decoded caption output for a service
 */
export interface DecodedCaption {
  serviceNumber: CaptionService;
  windows: Map<number, CaptionWindow>;
  currentWindow: number;
  text: CaptionText[];
  timestamp?: number; // PTS
}

/**
 * Caption decoder configuration
 */
export interface CaptionDecoderConfig {
  preferredService?: CaptionService;
  fontSize?: number; // px
  fontFamily?: string;
  backgroundColor?: string;
  textColor?: string;
  edgeStyle?: "none" | "raised" | "depressed" | "uniform" | "drop_shadow";
  windowOpacity?: number; // 0-1
  enabled?: boolean;
}

/**
 * Caption output callback
 */
export type CaptionOutputCallback = (caption: DecodedCaption) => void;

/**
 * CEA-708 Decoder State
 */
export type CEA708DecoderState =
  | "unconfigured"
  | "configured"
  | "decoding"
  | "error"
  | "closed";

/**
 * CEA-708 Decoder Metrics
 */
export interface CEA708DecoderMetrics {
  packetsProcessed: number;
  captionsDecoded: number;
  errors: number;
  currentService: CaptionService | null;
  availableServices: CaptionService[];
}

/**
 * CEA-708 Digital Closed Caption Decoder
 *
 * Decodes CEA-708 closed captions from ATSC video elementary streams.
 * Supports multiple caption services, advanced text styling, and
 * flexible window positioning.
 */
export class CEA708Decoder {
  // Constants
  private static readonly DTVCC_PACKET_START = 0x03;
  private static readonly MAX_SERVICE_COUNT = 6;
  private static readonly MAX_WINDOW_COUNT = 8;

  // State
  private state: CEA708DecoderState = "unconfigured";
  private config: CaptionDecoderConfig = {};

  // Service data
  private services: Map<CaptionService, DecodedCaption> = new Map<
    CaptionService,
    DecodedCaption
  >();
  private currentService: CaptionService | null = null;

  // Callbacks
  private onCaptionOutput?: CaptionOutputCallback;
  private onError?: (error: Error) => void;

  // Metrics
  private metrics: CEA708DecoderMetrics = {
    packetsProcessed: 0,
    captionsDecoded: 0,
    errors: 0,
    currentService: null,
    availableServices: [],
  };

  // Buffer for partial data
  private userDataBuffer: Uint8Array = new Uint8Array(0);

  /**
   * Create a new CEA-708 decoder
   */
  constructor(
    onCaptionOutput?: CaptionOutputCallback,
    onError?: (error: Error) => void,
  ) {
    this.onCaptionOutput = onCaptionOutput;
    this.onError = onError;
  }

  /**
   * Initialize the decoder with configuration
   */
  public initialize(config: CaptionDecoderConfig): void {
    this.config = { ...config };
    this.state = "configured";
    this.currentService = config.preferredService ?? 1;
    this.metrics.currentService = this.currentService;
  }

  /**
   * Process video PES packet payload to extract caption data
   *
   * Searches for SEI user data (H.264) or user data start codes (MPEG-2)
   * and extracts DTVCC caption packets.
   */
  public processVideoPayload(payload: Uint8Array, pts?: number): void {
    if (this.state !== "configured" && this.state !== "decoding") {
      return;
    }

    this.metrics.packetsProcessed++;

    try {
      this.state = "decoding";

      // Look for user data
      const userData = this.extractUserData(payload);
      if (userData.length === 0) {
        return;
      }

      // Extract DTVCC packets
      const dtvccPackets = this.extractDTVCCPackets(userData);

      // Process each packet
      for (const packet of dtvccPackets) {
        this.processDTVCCPacket(packet, pts);
      }
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Extract user data from video elementary stream payload
   *
   * For H.264: Looks for SEI NAL units (type 6) with ATSC user data
   * For MPEG-2: Looks for user data start codes (0x000001B2)
   */
  private extractUserData(payload: Uint8Array): Uint8Array {
    const userData: number[] = [];

    // Search for NAL units (H.264) or start codes (MPEG-2)
    for (let i = 0; i < payload.length - 4; i++) {
      // Check for NAL unit start code (0x00000001)
      if (
        payload[i] === 0x00 &&
        payload[i + 1] === 0x00 &&
        payload[i + 2] === 0x00 &&
        payload[i + 3] === 0x01
      ) {
        const nalType = payload[i + 4] & 0x1f;

        // SEI NAL unit (type 6)
        if (nalType === 6) {
          // Extract SEI payload
          const seiData = this.extractSEIPayload(payload, i + 5);
          userData.push(...seiData);
        }
        // User data start code (MPEG-2: 0x000001B2)
        else if (payload[i + 4] === 0xb2 && i < payload.length - 5) {
          // Extract until next start code
          let end = i + 5;
          while (
            end < payload.length - 2 &&
            !(
              payload[end] === 0x00 &&
              payload[end + 1] === 0x00 &&
              payload[end + 2] === 0x01
            )
          ) {
            end++;
          }
          userData.push(...Array.from(payload.slice(i + 5, end)));
        }
      }
    }

    return new Uint8Array(userData);
  }

  /**
   * Extract SEI payload from H.264 NAL unit
   */
  private extractSEIPayload(data: Uint8Array, offset: number): number[] {
    const payload: number[] = [];
    let i = offset;

    // SEI payload type
    let payloadType = 0;
    while (i < data.length && data[i] === 0xff) {
      payloadType += 255;
      i++;
    }
    if (i < data.length) {
      payloadType += data[i] ?? 0;
      i++;
    }

    // SEI payload size
    let payloadSize = 0;
    while (i < data.length && data[i] === 0xff) {
      payloadSize += 255;
      i++;
    }
    if (i < data.length) {
      payloadSize += data[i] ?? 0;
      i++;
    }

    // Check for ATSC user data (type 4)
    if (payloadType === 4 && payloadSize > 0) {
      // Extract payload
      const end = Math.min(i + payloadSize, data.length);
      payload.push(...Array.from(data.slice(i, end)));
    }

    return payload;
  }

  /**
   * Extract DTVCC packets from user data
   */
  private extractDTVCCPackets(userData: Uint8Array): Uint8Array[] {
    const packets: Uint8Array[] = [];

    for (let i = 0; i < userData.length - 2; i++) {
      // Look for DTVCC packet start (0x03)
      if (userData[i] === CEA708Decoder.DTVCC_PACKET_START) {
        const packetSize = userData[i + 1] & 0x3f;

        if (i + 2 + packetSize <= userData.length) {
          const packet = userData.slice(i + 2, i + 2 + packetSize);
          packets.push(packet);
          i += 1 + packetSize;
        }
      }
    }

    return packets;
  }

  /**
   * Process a DTVCC caption packet
   */
  private processDTVCCPacket(packet: Uint8Array, pts?: number): void {
    let offset = 0;

    // Process service blocks within the packet
    while (offset < packet.length) {
      const serviceBlock = this.parseServiceBlock(packet, offset);

      if (!serviceBlock) {
        break;
      }

      this.processServiceBlock(serviceBlock, pts);
      offset += 2 + serviceBlock.blockSize; // header (2 bytes) + data
    }
  }

  /**
   * Parse a service block header
   */
  private parseServiceBlock(
    data: Uint8Array,
    offset: number,
  ): ServiceBlock | null {
    if (offset + 1 >= data.length) {
      return null;
    }

    const header = data[offset];
    const serviceNumberRaw = ((header ?? 0) >> 5) & 0x07;
    const blockSize = (header ?? 0) & 0x1f;

    // Service number must be 1-6
    if (serviceNumberRaw < 1 || serviceNumberRaw > 6) {
      return null;
    }
    const serviceNumber = serviceNumberRaw as CaptionService;

    if (offset + 1 + blockSize > data.length) {
      return null;
    }

    return {
      serviceNumber,
      blockSize,
      data: data.slice(offset + 1, offset + 1 + blockSize),
    };
  }

  /**
   * Process a service block
   */
  private processServiceBlock(block: ServiceBlock, pts?: number): void {
    // Get or create service data
    let service = this.services.get(block.serviceNumber);
    if (!service) {
      service = {
        serviceNumber: block.serviceNumber,
        windows: new Map(),
        currentWindow: 0,
        text: [],
        timestamp: pts,
      };
      this.services.set(block.serviceNumber, service);

      // Update available services
      if (!this.metrics.availableServices.includes(block.serviceNumber)) {
        this.metrics.availableServices.push(block.serviceNumber);
      }
    } else {
      // Update timestamp for existing service
      service.timestamp = pts;
    }

    // Process commands in block data
    this.processCommands(service, block.data);

    // Emit caption if this is the current service
    if (
      this.currentService === block.serviceNumber &&
      this.onCaptionOutput &&
      service.text.length > 0
    ) {
      this.onCaptionOutput(service);
      this.metrics.captionsDecoded++;
    }
  }

  /**
   * Process caption commands
   */
  private processCommands(service: DecodedCaption, data: Uint8Array): void {
    let offset = 0;

    while (offset < data.length) {
      const command = data[offset];

      // C0 commands (0x00-0x1F)
      if (command <= 0x1f) {
        offset = this.processC0Command(service, command, data, offset);
      }
      // G0 characters (0x20-0x7F) - printable ASCII
      else if (command >= 0x20 && command <= 0x7f) {
        this.addCharacter(service, String.fromCharCode(command));
        offset++;
      }
      // C1 commands (0x80-0x9F)
      else if (command >= 0x80 && command <= 0x9f) {
        offset = this.processC1Command(service, command, data, offset);
      }
      // G1 characters (0xA0-0xFF) - extended characters
      else {
        this.addCharacter(service, String.fromCharCode(command));
        offset++;
      }
    }
  }

  /**
   * Process C0 control codes
   */
  private processC0Command(
    service: DecodedCaption,
    command: number,
    data: Uint8Array,
    offset: number,
  ): number {
    switch (command) {
      case 0x03: // ETX (End of Text)
        // No-op for now
        return offset + 1;

      case 0x08: // BS (Backspace)
        if (service.text.length > 0) {
          const lastText = service.text[service.text.length - 1];
          if (lastText && lastText.text.length > 0) {
            lastText.text = lastText.text.slice(0, -1);
          }
        }
        return offset + 1;

      case 0x0c: // FF (Form Feed - clear window)
        // eslint-disable-next-line no-param-reassign
        service.text = [];
        return offset + 1;

      case 0x0d: // CR (Carriage Return)
        // Move to next line - add newline
        this.addCharacter(service, "\n");
        return offset + 1;

      case 0x0e: // HCR (Horizontal Carriage Return)
        // Move to beginning of current line
        return offset + 1;

      default:
        // Unknown command, skip
        return offset + 1;
    }
  }

  /**
   * Process C1 control codes
   */
  private processC1Command(
    service: DecodedCaption,
    command: number,
    data: Uint8Array,
    offset: number,
  ): number {
    // C1 commands are typically multi-byte, but simplified here
    switch (command) {
      case 0x80: // CW0-CW7 (Set Current Window)
      case 0x81:
      case 0x82:
      case 0x83:
      case 0x84:
      case 0x85:
      case 0x86:
      case 0x87:
        // eslint-disable-next-line no-param-reassign
        service.currentWindow = command - 0x80;
        return offset + 1;

      case 0x88: // CLW (Clear Windows)
        // Takes window bitmap as parameter
        if (offset + 1 < data.length) {
          const windowBitmap = data[offset + 1];
          for (let i = 0; i < 8; i++) {
            if (windowBitmap !== undefined && windowBitmap & (1 << i)) {
              // Clear window i
              // eslint-disable-next-line no-param-reassign
              service.text = [];
            }
          }
          return offset + 2;
        }
        return offset + 1;

      case 0x89: // DSW (Display Windows)
      case 0x8a: // HDW (Hide Windows)
      case 0x8b: // TGW (Toggle Windows)
        // Takes window bitmap as parameter
        return offset + 2;

      case 0x8c: // DLW (Delete Windows)
        if (offset + 1 < data.length) {
          const windowBitmap = data[offset + 1];
          for (let i = 0; i < 8; i++) {
            if (windowBitmap !== undefined && windowBitmap & (1 << i)) {
              service.windows.delete(i);
            }
          }
          return offset + 2;
        }
        return offset + 1;

      case 0x8d: // DLY (Delay)
        // Takes delay value as parameter
        return offset + 2;

      case 0x8e: // DLC (Delay Cancel)
        return offset + 1;

      case 0x8f: // RST (Reset)
        // Reset service to initial state
        service.windows.clear();
        // eslint-disable-next-line no-param-reassign
        service.text = [];
        // eslint-disable-next-line no-param-reassign
        service.currentWindow = 0;
        return offset + 1;

      case 0x90: // SPA (Set Pen Attributes)
        // 2-byte parameter
        return offset + 3;

      case 0x91: // SPC (Set Pen Color)
        // 3-byte parameter
        return offset + 4;

      case 0x92: // SPL (Set Pen Location)
        // 2-byte parameter
        return offset + 3;

      case 0x97: // SWA (Set Window Attributes)
        // 4-byte parameter
        return offset + 5;

      case 0x98: // DF0-DF7 (Define Window)
      case 0x99:
      case 0x9a:
      case 0x9b:
      case 0x9c:
      case 0x9d:
      case 0x9e:
      case 0x9f:
        // 6-byte parameter for window definition
        return offset + 7;

      default:
        // Unknown command, skip
        return offset + 1;
    }
  }

  /**
   * Add a character to the current service
   */
  private addCharacter(service: DecodedCaption, char: string): void {
    // Create default text entry if none exists
    if (service.text.length === 0) {
      service.text.push({
        text: "",
        penAttributes: this.getDefaultPenAttributes(),
        foregroundColor: this.getDefaultForegroundColor(),
        backgroundColor: this.getDefaultBackgroundColor(),
        edgeColor: this.getDefaultEdgeColor(),
      });
    }

    // Add character to last text entry
    const lastText = service.text[service.text.length - 1];
    if (lastText) {
      lastText.text += char;
    }
  }

  /**
   * Get default pen attributes
   */
  private getDefaultPenAttributes(): PenAttributes {
    return {
      penSize: "standard",
      fontStyle: "default",
      textTag: 0,
      offset: "normal",
      italics: false,
      underline: false,
      edgeType: "none",
    };
  }

  /**
   * Get default foreground color (white)
   */
  private getDefaultForegroundColor(): PenColor {
    return { red: 255, green: 255, blue: 255, opacity: "solid" };
  }

  /**
   * Get default background color (black)
   */
  private getDefaultBackgroundColor(): PenColor {
    return { red: 0, green: 0, blue: 0, opacity: "solid" };
  }

  /**
   * Get default edge color (black)
   */
  private getDefaultEdgeColor(): PenColor {
    return { red: 0, green: 0, blue: 0, opacity: "solid" };
  }

  /**
   * Set the active caption service
   */
  public setService(service: CaptionService): void {
    if (service < 1 || service > 6) {
      throw new Error(`Invalid service number: ${service}`);
    }

    this.currentService = service;
    this.metrics.currentService = service;
  }

  /**
   * Get available caption services
   */
  public getAvailableServices(): CaptionService[] {
    return this.metrics.availableServices;
  }

  /**
   * Get captions for a specific service
   */
  public getServiceCaptions(service: CaptionService): DecodedCaption | null {
    return this.services.get(service) ?? null;
  }

  /**
   * Clear all captions for a service
   */
  public clearService(service: CaptionService): void {
    const serviceData = this.services.get(service);
    if (serviceData) {
      serviceData.text = [];
      serviceData.windows.clear();
    }
  }

  /**
   * Clear all captions
   */
  public clearAll(): void {
    this.services.clear();
    this.metrics.availableServices = [];
  }

  /**
   * Get decoder metrics
   */
  public getMetrics(): CEA708DecoderMetrics {
    return { ...this.metrics };
  }

  /**
   * Get decoder state
   */
  public getState(): CEA708DecoderState {
    return this.state;
  }

  /**
   * Reset the decoder
   */
  public reset(): void {
    this.services.clear();
    this.metrics = {
      packetsProcessed: 0,
      captionsDecoded: 0,
      errors: 0,
      currentService: this.currentService,
      availableServices: [],
    };
    this.userDataBuffer = new Uint8Array(0);
    this.state = "configured";
  }

  /**
   * Close the decoder
   */
  public close(): void {
    this.reset();
    this.state = "closed";
    this.onCaptionOutput = undefined;
    this.onError = undefined;
  }

  /**
   * Handle decoder errors
   */
  private handleError(error: Error): void {
    // Don't transition to error state - just log and increment counter
    // This allows the decoder to recover from transient errors
    this.metrics.errors++;

    if (this.onError) {
      this.onError(error);
    } else {
      console.error("CEA-708 Decoder Error:", error);
    }
  }

  /**
   * Export captions as text
   */
  public exportAsText(service?: CaptionService): string {
    const services = service
      ? [service]
      : Array.from(this.services.keys()).sort((a, b) => a - b);

    const lines: string[] = [];

    for (const svc of services) {
      const caption = this.services.get(svc);
      if (caption) {
        lines.push(`=== Service ${svc} ===`);
        for (const text of caption.text) {
          lines.push(text.text);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Export captions as SRT (SubRip) format
   */
  public exportAsSRT(service?: CaptionService): string {
    const svc = service ?? this.currentService ?? 1;
    const caption = this.services.get(svc);

    if (!caption || caption.text.length === 0) {
      return "";
    }

    const lines: string[] = [];
    let index = 1;

    // Simple SRT export - would need timing info for full implementation
    for (const text of caption.text) {
      if (text.text.trim()) {
        lines.push(`${index}`);
        lines.push("00:00:00,000 --> 00:00:05,000");
        lines.push(text.text.trim());
        lines.push("");
        index++;
      }
    }

    return lines.join("\n");
  }
}
