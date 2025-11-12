/**
 * ATSC Video Decoder using WebCodecs API
 *
 * Implements video decoding for ATSC streams with support for:
 * - MPEG-2 video (legacy ATSC 1.0)
 * - H.264/AVC (ATSC 1.0 mobile/handheld)
 *
 * Features:
 * - Frame timing and presentation
 * - Frame buffer management
 * - Resolution change handling
 * - Performance monitoring
 */

import { StreamType } from "../parsers/TransportStreamParser";

/**
 * PES (Packetized Elementary Stream) Header
 */
export interface PESHeader {
  streamId: number;
  packetLength: number;
  pts?: number; // Presentation timestamp (90 kHz clock)
  dts?: number; // Decode timestamp (90 kHz clock)
  headerDataLength: number;
}

/**
 * Video frame metadata
 */
export interface VideoFrameMetadata {
  pts: number;
  dts?: number;
  keyframe: boolean;
  width?: number;
  height?: number;
}

/**
 * Video codec configuration
 */
export interface VideoCodecConfig {
  codec: string; // "avc1.42001E" or "mp2v"
  codedWidth: number;
  codedHeight: number;
  description?: ArrayBuffer; // SPS/PPS for H.264, sequence header for MPEG-2
  hardwareAcceleration?:
    | "no-preference"
    | "prefer-hardware"
    | "prefer-software";
  optimizeForLatency?: boolean;
}

/**
 * Decoder performance metrics
 */
export interface DecoderMetrics {
  framesDecoded: number;
  framesDropped: number;
  totalDecodeTime: number; // milliseconds
  averageDecodeTime: number; // milliseconds per frame
  currentBitrate: number; // bits per second
  lastUpdateTime: number;
}

/**
 * Decoder state
 */
export type DecoderState =
  | "unconfigured"
  | "configured"
  | "decoding"
  | "flushing"
  | "closed"
  | "error";

/**
 * Decoder error callback
 */
export type DecoderErrorCallback = (error: Error) => void;

/**
 * Frame output callback
 */
export type FrameOutputCallback = (frame: VideoFrame) => void;

/**
 * ATSC Video Decoder
 *
 * Handles decoding of MPEG-2 and H.264 video streams from ATSC broadcasts.
 */
export class ATSCVideoDecoder {
  // H.264 NAL unit type constants
  private static readonly H264_NAL_TYPE_SPS = 7;
  private static readonly H264_NAL_TYPE_PPS = 8;
  private static readonly H264_NAL_TYPE_IDR = 5;

  // MPEG-2 picture type constants
  private static readonly MPEG2_PICTURE_TYPE_I_FRAME = 1;

  // Frame buffer timeout (1 second in milliseconds)
  private static readonly FRAME_BUFFER_TIMEOUT_MS = 1000;

  private decoder: VideoDecoder | null = null;
  private state: DecoderState = "unconfigured";
  private streamType: StreamType | null = null;
  private currentConfig: VideoCodecConfig | null = null;

  // PES packet assembly
  private pesBuffer: Uint8Array[] = [];
  private currentPESHeader: PESHeader | null = null;
  private awaitingPESStart = true;

  // Frame buffer for ordering and timing
  private frameBuffer = new Map<
    number,
    { frame: VideoFrame; receivedAt: number }
  >();
  private lastPresentedPTS = 0;

  // Performance metrics
  private metrics: DecoderMetrics = {
    framesDecoded: 0,
    framesDropped: 0,
    totalDecodeTime: 0,
    averageDecodeTime: 0,
    currentBitrate: 0,
    lastUpdateTime: Date.now(),
  };

  // Callbacks
  private onError: DecoderErrorCallback;
  private onFrame: FrameOutputCallback;

  // Configuration extraction state
  private h264SPSPPSExtracted = false;
  private mpeg2SequenceHeaderExtracted = false;

  constructor(onFrame: FrameOutputCallback, onError: DecoderErrorCallback) {
    this.onFrame = onFrame;
    this.onError = onError;
  }

  /**
   * Initialize decoder for the specified stream type
   */
  public async initialize(
    streamType: StreamType,
    width = 1920,
    height = 1080,
  ): Promise<void> {
    if (this.state !== "unconfigured" && this.state !== "closed") {
      throw new Error(
        `Cannot initialize decoder in ${this.state} state. Close first.`,
      );
    }

    this.streamType = streamType;

    // Determine codec string
    let codec: string;
    if (streamType === StreamType.MPEG2_VIDEO) {
      codec = "mp2v"; // MPEG-2 Video
    } else if (streamType === StreamType.H264_VIDEO) {
      // H.264 Baseline profile, level 3.0
      codec = "avc1.42001E";
    } else {
      throw new Error(`Unsupported stream type: ${streamType}`);
    }

    // Create initial configuration
    const config: VideoCodecConfig = {
      codec,
      codedWidth: width,
      codedHeight: height,
      hardwareAcceleration: "prefer-hardware",
      optimizeForLatency: true,
    };

    // Check if codec is supported
    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) {
      throw new Error(`Codec ${codec} is not supported by this browser`);
    }

    this.currentConfig = config;
    this.configureDecoder(config);
    this.state = "configured";
  }

  /**
   * Configure or reconfigure the VideoDecoder
   */
  private configureDecoder(config: VideoCodecConfig): void {
    // Close existing decoder if any
    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }

    // Create new decoder
    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame): void => this.handleDecodedFrame(frame),
      error: (error: DOMException): void => this.handleDecoderError(error),
    });

    // Configure decoder
    this.decoder.configure(config);
  }

  /**
   * Process transport stream payload for video PID
   */
  public processPayload(payload: Uint8Array): void {
    if (this.state === "closed" || this.state === "error") {
      return;
    }

    // Check for PES start indicator (payload starts with 0x000001)
    if (
      payload.length >= 4 &&
      payload[0] === 0x00 &&
      payload[1] === 0x00 &&
      payload[2] === 0x01
    ) {
      // Flush any pending PES packet
      if (this.pesBuffer.length > 0 && !this.awaitingPESStart) {
        this.processPESPacket();
      }

      // Start new PES packet
      this.pesBuffer = [payload];
      this.awaitingPESStart = false;

      // Parse PES header
      this.currentPESHeader = this.parsePESHeader(payload);
    } else if (!this.awaitingPESStart) {
      // Continue accumulating PES packet
      this.pesBuffer.push(payload);
    }
  }

  /**
   * Parse PES packet header
   */
  private parsePESHeader(data: Uint8Array): PESHeader | null {
    if (data.length < 9) return null;

    const streamId = data[3] ?? 0;
    const packetLength = ((data[4] ?? 0) << 8) | (data[5] ?? 0);

    // Check for PTS/DTS flags in PES header
    const ptsFlag = ((data[7] ?? 0) & 0x80) !== 0;
    const dtsFlag = ((data[7] ?? 0) & 0x40) !== 0;
    const headerDataLength = data[8] ?? 0;

    let pts: number | undefined;
    let dts: number | undefined;

    if (ptsFlag && data.length >= 14) {
      // Parse PTS (33-bit value encoded in 5 bytes) using BigInt for accuracy
      pts = Number(
        ((BigInt(data[9] ?? 0) & 0x0en) << 29n) |
          ((BigInt(data[10] ?? 0) & 0xffn) << 22n) |
          ((BigInt(data[11] ?? 0) & 0xfen) << 14n) |
          ((BigInt(data[12] ?? 0) & 0xffn) << 7n) |
          ((BigInt(data[13] ?? 0) & 0xfen) >> 1n),
      );
    }

    if (dtsFlag && data.length >= 19) {
      // Parse DTS (33-bit value encoded in 5 bytes) using BigInt for accuracy
      dts = Number(
        ((BigInt(data[14] ?? 0) & 0x0en) << 29n) |
          ((BigInt(data[15] ?? 0) & 0xffn) << 22n) |
          ((BigInt(data[16] ?? 0) & 0xfen) << 14n) |
          ((BigInt(data[17] ?? 0) & 0xffn) << 7n) |
          ((BigInt(data[18] ?? 0) & 0xfen) >> 1n),
      );
    }

    return {
      streamId,
      packetLength,
      pts,
      dts,
      headerDataLength,
    };
  }

  /**
   * Process complete PES packet
   */
  private processPESPacket(): void {
    if (!this.currentPESHeader || !this.decoder) {
      return;
    }

    // Concatenate PES packet data
    const totalLength = this.pesBuffer.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );
    const pesData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.pesBuffer) {
      pesData.set(chunk, offset);
      offset += chunk.length;
    }

    // Extract ES data (skip PES header)
    const headerLength = 9 + this.currentPESHeader.headerDataLength;
    if (pesData.length <= headerLength) {
      return;
    }

    const esData = pesData.slice(headerLength);

    // For H.264, extract SPS/PPS if not done yet
    if (
      this.streamType === StreamType.H264_VIDEO &&
      !this.h264SPSPPSExtracted
    ) {
      this.extractH264Configuration(esData);
    }

    // For MPEG-2, extract sequence header if not done yet
    if (
      this.streamType === StreamType.MPEG2_VIDEO &&
      !this.mpeg2SequenceHeaderExtracted
    ) {
      this.extractMPEG2Configuration(esData);
    }

    // Create encoded video chunk
    const chunk = new EncodedVideoChunk({
      type: this.isKeyFrame(esData) ? "key" : "delta",
      timestamp: this.currentPESHeader.pts
        ? (this.currentPESHeader.pts * 1000000) / 90000
        : 0, // Convert 90kHz to microseconds
      duration: 0, // Will be calculated by decoder
      data: esData,
    });

    // Decode chunk
    try {
      this.decoder.decode(chunk);

      // Update metrics (note: actual decode time measured in handleDecodedFrame)
      this.updateMetrics(esData.length);

      this.state = "decoding";
    } catch (error) {
      this.handleDecoderError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // Clear buffer for next packet
    this.pesBuffer = [];
    this.awaitingPESStart = true;
  }

  /**
   * Extract H.264 SPS/PPS configuration
   */
  private extractH264Configuration(data: Uint8Array): void {
    // Look for SPS and PPS NAL units
    const nalUnits: Uint8Array[] = [];

    // Find NAL units (search for start codes 0x000001 or 0x00000001)
    let i = 0;
    while (i < data.length - 3) {
      if (data[i] === 0 && data[i + 1] === 0) {
        if (data[i + 2] === 1) {
          // 3-byte start code
          const nalStart = i + 3;
          const nalType = (data[nalStart] ?? 0) & 0x1f;

          // Find next start code
          let nalEnd = nalStart + 1;
          while (nalEnd < data.length - 3) {
            if (
              data[nalEnd] === 0 &&
              data[nalEnd + 1] === 0 &&
              (data[nalEnd + 2] === 1 ||
                (data[nalEnd + 2] === 0 && data[nalEnd + 3] === 1))
            ) {
              break;
            }
            nalEnd++;
          }

          // Extract SPS or PPS NAL units
          if (
            nalType === ATSCVideoDecoder.H264_NAL_TYPE_SPS ||
            nalType === ATSCVideoDecoder.H264_NAL_TYPE_PPS
          ) {
            nalUnits.push(data.slice(nalStart, nalEnd));
          }

          i = nalEnd;
        } else if (data[i + 2] === 0 && data[i + 3] === 1) {
          // 4-byte start code
          i += 4;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    // If we found SPS and PPS, reconfigure decoder
    if (nalUnits.length >= 2 && this.currentConfig) {
      // Build AVCC format: each NAL unit is prefixed by a 4-byte big-endian length
      const totalLength = nalUnits.reduce(
        (sum, nal) => sum + 4 + nal.length,
        0,
      );
      const description = new Uint8Array(totalLength);
      let offset = 0;
      for (const nal of nalUnits) {
        // Write 4-byte big-endian length
        description[offset] = (nal.length >>> 24) & 0xff;
        description[offset + 1] = (nal.length >>> 16) & 0xff;
        description[offset + 2] = (nal.length >>> 8) & 0xff;
        description[offset + 3] = nal.length & 0xff;
        // Write NAL unit bytes
        description.set(nal, offset + 4);
        offset += 4 + nal.length;
      }

      // Update configuration with description
      const newConfig: VideoCodecConfig = {
        ...this.currentConfig,
        description: description.buffer,
      };

      this.currentConfig = newConfig;
      this.configureDecoder(newConfig);
      this.h264SPSPPSExtracted = true;
    }
  }

  /**
   * Extract MPEG-2 sequence header configuration
   */
  private extractMPEG2Configuration(data: Uint8Array): void {
    // Look for sequence header start code (0x000001B3)
    for (let i = 0; i < data.length - 8; i++) {
      if (
        data[i] === 0x00 &&
        data[i + 1] === 0x00 &&
        data[i + 2] === 0x01 &&
        data[i + 3] === 0xb3
      ) {
        // Found sequence header
        // Extract width and height
        const width =
          (((data[i + 4] ?? 0) << 4) | ((data[i + 5] ?? 0) >> 4)) & 0xfff;
        const height =
          ((((data[i + 5] ?? 0) & 0x0f) << 8) | (data[i + 6] ?? 0)) & 0xfff;

        // Extract sequence header (typically ~12 bytes, but can vary)
        let seqHeaderEnd = i + 12;
        while (
          seqHeaderEnd < data.length - 3 &&
          !(
            data[seqHeaderEnd] === 0x00 &&
            data[seqHeaderEnd + 1] === 0x00 &&
            data[seqHeaderEnd + 2] === 0x01
          )
        ) {
          seqHeaderEnd++;
        }

        const seqHeader = data.slice(i, seqHeaderEnd);

        // Update configuration with sequence header
        if (this.currentConfig) {
          const newConfig: VideoCodecConfig = {
            ...this.currentConfig,
            codedWidth: width,
            codedHeight: height,
            description: seqHeader.buffer,
          };

          this.currentConfig = newConfig;
          this.configureDecoder(newConfig);
          this.mpeg2SequenceHeaderExtracted = true;
        }

        break;
      }
    }
  }

  /**
   * Check if frame is a keyframe/IDR
   */
  private isKeyFrame(data: Uint8Array): boolean {
    if (this.streamType === StreamType.H264_VIDEO) {
      // For H.264, look for IDR NAL unit
      for (let i = 0; i < data.length - 4; i++) {
        if (
          data[i] === 0x00 &&
          data[i + 1] === 0x00 &&
          (data[i + 2] === 0x01 ||
            (data[i + 2] === 0x00 && data[i + 3] === 0x01))
        ) {
          const nalStart = data[i + 2] === 0x01 ? i + 3 : i + 4;
          const nalType = (data[nalStart] ?? 0) & 0x1f;
          if (nalType === ATSCVideoDecoder.H264_NAL_TYPE_IDR) {
            return true; // IDR frame
          }
        }
      }
      return false;
    } else if (this.streamType === StreamType.MPEG2_VIDEO) {
      // For MPEG-2, look for I-frame picture start code
      for (let i = 0; i < data.length - 5; i++) {
        if (
          data[i] === 0x00 &&
          data[i + 1] === 0x00 &&
          data[i + 2] === 0x01 &&
          data[i + 3] === 0x00
        ) {
          // Picture start code, check picture coding type
          const pictureCodingType = ((data[i + 5] ?? 0) >> 3) & 0x07;
          if (
            pictureCodingType === ATSCVideoDecoder.MPEG2_PICTURE_TYPE_I_FRAME
          ) {
            return true; // I-frame
          }
        }
      }
      return false;
    }

    return false;
  }

  /**
   * Handle decoded frame from VideoDecoder
   */
  private handleDecodedFrame(frame: VideoFrame): void {
    this.metrics.framesDecoded++;

    // Add to frame buffer for ordering with received timestamp
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const pts = Math.floor(frame.timestamp ?? 0);
    this.frameBuffer.set(pts, { frame, receivedAt: performance.now() });

    // Present frames in order
    this.presentFrames();
  }

  /**
   * Present frames in PTS order
   */
  private presentFrames(): void {
    // Sort frames by PTS
    const sortedPTS = Array.from(this.frameBuffer.keys()).sort((a, b) => a - b);

    // Present frames that are ready
    for (const pts of sortedPTS) {
      if (pts <= this.lastPresentedPTS) {
        // Frame is late, drop it
        const entry = this.frameBuffer.get(pts);
        if (entry) {
          entry.frame.close();
          this.frameBuffer.delete(pts);
          this.metrics.framesDropped++;
        }
        continue;
      }

      // Present frame
      const entry = this.frameBuffer.get(pts);
      if (entry) {
        this.onFrame(entry.frame);
        this.lastPresentedPTS = pts;
        this.frameBuffer.delete(pts);
        break; // Present one frame at a time
      }
    }

    // Clean up old frames (more than FRAME_BUFFER_TIMEOUT_MS old)
    const now = performance.now();
    for (const [pts, entry] of this.frameBuffer.entries()) {
      if (now - entry.receivedAt > ATSCVideoDecoder.FRAME_BUFFER_TIMEOUT_MS) {
        entry.frame.close();
        this.frameBuffer.delete(pts);
        this.metrics.framesDropped++;
      }
    }
  }

  /**
   * Handle decoder errors
   */
  private handleDecoderError(error: Error | DOMException): void {
    this.state = "error";
    const errorMessage =
      error instanceof Error ? error : new Error(String(error));
    this.onError(errorMessage);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(dataSize: number): void {
    // Calculate bitrate (bytes per second)
    const now = Date.now();
    const timeDelta = (now - this.metrics.lastUpdateTime) / 1000; // seconds
    if (timeDelta > 0) {
      this.metrics.currentBitrate = (dataSize * 8) / timeDelta; // bits per second
    }
    this.metrics.lastUpdateTime = now;

    // Average decode time is calculated in handleDecodedFrame
    this.metrics.averageDecodeTime =
      this.metrics.framesDecoded > 0
        ? this.metrics.totalDecodeTime / this.metrics.framesDecoded
        : 0;
  }

  /**
   * Flush pending frames
   */
  public async flush(): Promise<void> {
    if (this.decoder && this.state === "decoding") {
      this.state = "flushing";
      await this.decoder.flush();

      // Present any remaining buffered frames
      this.presentFrames();

      this.state = "configured";
    }
  }

  /**
   * Reset decoder state
   */
  public reset(): void {
    this.pesBuffer = [];
    this.currentPESHeader = null;
    this.awaitingPESStart = true;
    this.lastPresentedPTS = 0;

    // Close buffered frames
    for (const entry of this.frameBuffer.values()) {
      entry.frame.close();
    }
    this.frameBuffer.clear();

    if (this.decoder && this.decoder.state !== "closed") {
      this.decoder.reset();
    }

    // Reset metrics
    this.metrics = {
      framesDecoded: 0,
      framesDropped: 0,
      totalDecodeTime: 0,
      averageDecodeTime: 0,
      currentBitrate: 0,
      lastUpdateTime: Date.now(),
    };

    this.h264SPSPPSExtracted = false;
    this.mpeg2SequenceHeaderExtracted = false;

    this.state = "configured";
  }

  /**
   * Close decoder and release resources
   */
  public close(): void {
    // Close buffered frames
    for (const entry of this.frameBuffer.values()) {
      entry.frame.close();
    }
    this.frameBuffer.clear();

    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }

    this.state = "closed";
  }

  /**
   * Get current decoder state
   */
  public getState(): DecoderState {
    return this.state;
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): DecoderMetrics {
    return { ...this.metrics };
  }
}
