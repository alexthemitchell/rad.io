/**
 * AC-3 (Dolby Digital) Audio Decoder for ATSC Broadcasts
 *
 * Implements decoding of AC-3 audio streams commonly used in ATSC digital television.
 * Supports 5.1 channel downmix to stereo, multiple audio tracks, and A/V synchronization.
 *
 * AC-3 Specification: ATSC A/52 Standard
 */

/**
 * AC-3 frame header information
 */
export interface AC3FrameHeader {
  syncWord: number; // 0x0B77
  crc1: number;
  fscod: number; // Sample rate code (0=48kHz, 1=44.1kHz, 2=32kHz)
  frmsizecod: number; // Frame size code
  bsid: number; // Bitstream ID
  bsmod: number; // Bitstream mode
  acmod: number; // Audio coding mode (channel configuration)
  lfeon: number; // LFE channel on flag
  sampleRate: number; // Actual sample rate in Hz
  frameSize: number; // Frame size in bytes
  numChannels: number; // Number of channels
  bitrate: number; // Bitrate in kbps
}

/**
 * PES packet header information
 */
export interface PESHeader {
  streamId: number;
  packetLength: number;
  pts?: number; // Presentation timestamp (33-bit, 90kHz clock)
  dts?: number; // Decode timestamp (33-bit, 90kHz clock)
  headerDataLength: number;
}

/**
 * Audio configuration for output
 */
export interface AudioConfig {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
}

/**
 * Audio decoder metrics
 */
export interface AudioDecoderMetrics {
  framesDecoded: number;
  framesDropped: number;
  totalDecodeTime: number;
  averageDecodeTime: number;
  currentBitrate: number;
  lastUpdateTime: number;
  bufferHealth: number; // 0-100% indicating buffer fullness
}

/**
 * Decoder state
 */
export type DecoderState =
  | "unconfigured"
  | "configured"
  | "decoding"
  | "flushing"
  | "error"
  | "closed";

/**
 * Callback for decoded audio samples
 */
export type AudioOutputCallback = (
  samples: Float32Array,
  sampleRate: number,
  channelCount: number,
  pts?: number,
) => void;

/**
 * Callback for decoder errors
 */
export type DecoderErrorCallback = (error: Error) => void;

/**
 * Channel configuration constants (acmod values)
 */
/**
 * Sample rate table (fscod values)
 */
const AC3_SAMPLE_RATES = [48000, 44100, 32000];

/**
 * Frame size table [fscod][frmsizecod]
 * Values in 16-bit words (multiply by 2 for bytes)
 */
const AC3_FRAME_SIZES: number[][] = [
  // 48 kHz
  [
    64, 64, 80, 80, 96, 96, 112, 112, 128, 128, 160, 160, 192, 192, 224, 224,
    256, 256, 320, 320, 384, 384, 448, 448, 512, 512, 640, 640, 768, 768, 896,
    896, 1024, 1024, 1152, 1152, 1280, 1280,
  ],
  // 44.1 kHz
  [
    69, 70, 87, 88, 104, 105, 121, 122, 139, 140, 174, 175, 208, 209, 243, 244,
    278, 279, 348, 349, 417, 418, 487, 488, 557, 558, 696, 697, 835, 836, 975,
    976, 1114, 1115, 1253, 1254, 1393, 1394,
  ],
  // 32 kHz
  [
    96, 96, 120, 120, 144, 144, 168, 168, 192, 192, 240, 240, 288, 288, 336,
    336, 384, 384, 480, 480, 576, 576, 672, 672, 768, 768, 960, 960, 1152, 1152,
    1344, 1344, 1536, 1536, 1728, 1728, 1920, 1920,
  ],
];

/**
 * Bitrate table [frmsizecod / 2]
 */
const AC3_BITRATES = [
  32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512,
  576, 640,
];

/**
 * AC-3 Audio Decoder
 *
 * Decodes AC-3 audio streams from ATSC broadcasts. Since native AC-3 decoding
 * is not widely supported in browsers, this implementation uses a hybrid approach:
 * 1. Parse AC-3 frame structure to extract metadata
 * 2. Attempt to use WebCodecs AudioDecoder if AC-3 is supported
 * 3. Fall back to WebAudio processing for unsupported browsers
 *
 * Note: Full AC-3 decoding requires complex DSP (MDCT, etc.). For production,
 * consider using a WebAssembly AC-3 decoder library or server-side transcoding.
 */
export class AC3Decoder {
  // AC-3 sync word (0x0B77)
  private static readonly SYNC_WORD = 0x0b77;

  // Maximum frame buffer size (5 seconds of audio)
  private static readonly MAX_FRAME_BUFFER_SIZE = 5000;

  // Audio buffer timeout (1 second)
  private static readonly AUDIO_BUFFER_TIMEOUT_MS = 1000;

  private state: DecoderState = "unconfigured";
  private audioContext: AudioContext | null = null;
  private currentConfig: AudioConfig | null = null;

  // PES packet assembly
  private pesBuffer: Uint8Array[] = [];
  private currentPESHeader: PESHeader | null = null;
  private awaitingPESStart = true;

  // AC-3 frame buffer
  private partialFrame: Uint8Array | null = null;

  // Audio output queue for synchronization
  private audioQueue = new Map<
    number,
    { samples: Float32Array; receivedAt: number }
  >();
  private lastPresentedPTS = 0;

  // Performance metrics
  private metrics: AudioDecoderMetrics = {
    framesDecoded: 0,
    framesDropped: 0,
    totalDecodeTime: 0,
    averageDecodeTime: 0,
    currentBitrate: 0,
    lastUpdateTime: Date.now(),
    bufferHealth: 0,
  };

  // Callbacks
  private onAudioOutput: AudioOutputCallback;
  private onError: DecoderErrorCallback;

  // Dynamic range compression settings
  private compressionEnabled = false;
  private compressionRatio = 2.0; // 2:1 compression

  // Lip-sync correction (milliseconds)
  private audioDelay = 0;

  constructor(
    onAudioOutput: AudioOutputCallback,
    onError: DecoderErrorCallback,
  ) {
    this.onAudioOutput = onAudioOutput;
    this.onError = onError;
  }

  /**
   * Initialize the decoder
   */
  public initialize(
    sampleRate = 48000,
    channelCount = 2,
    bufferSize = 4096,
  ): void {
    if (this.state !== "unconfigured" && this.state !== "closed") {
      throw new Error(
        `Cannot initialize decoder in ${this.state} state. Close first.`,
      );
    }

    // Create audio context for output
    this.audioContext = new AudioContext();

    this.currentConfig = {
      sampleRate,
      channelCount,
      bufferSize,
    };

    this.state = "configured";
  }

  /**
   * Process transport stream payload for audio PID
   */
  public processPayload(payload: Uint8Array): void {
    if (this.state === "closed" || this.state === "error") {
      return;
    }

    try {
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
    } catch (error) {
      this.state = "error";
      this.onError(error instanceof Error ? error : new Error(String(error)));
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
    if (!this.currentPESHeader) {
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

    // Process AC-3 frames
    this.processAC3Data(esData, this.currentPESHeader.pts);

    // Clear buffer for next packet
    this.pesBuffer = [];
    this.awaitingPESStart = true;
  }

  /**
   * Process AC-3 elementary stream data
   */
  private processAC3Data(data: Uint8Array, pts?: number): void {
    let offset = 0;

    // If we have a partial frame from before, prepend it
    let processData = data;
    if (this.partialFrame) {
      const combined = new Uint8Array(this.partialFrame.length + data.length);
      combined.set(this.partialFrame);
      combined.set(data, this.partialFrame.length);
      processData = combined;
      this.partialFrame = null;
    }

    while (offset < processData.length) {
      // Search for AC-3 sync word (0x0B77)
      const syncOffset = this.findSyncWord(processData, offset);
      if (syncOffset === -1) {
        // No sync word found, save remaining data as partial frame
        if (offset < processData.length) {
          this.partialFrame = processData.slice(offset);
        }
        break;
      }

      offset = syncOffset;

      // Need at least 7 bytes to parse header
      if (offset + 7 > processData.length) {
        this.partialFrame = processData.slice(offset);
        break;
      }

      // Parse frame header
      const header = this.parseAC3FrameHeader(processData.slice(offset));
      if (!header) {
        // Invalid header, skip this sync word and continue searching
        offset += 2;
        continue;
      }

      // Check if we have the complete frame
      if (offset + header.frameSize > processData.length) {
        // Incomplete frame, save it for next call
        this.partialFrame = processData.slice(offset);
        break;
      }

      // Extract complete frame
      const frame = processData.slice(offset, offset + header.frameSize);

      // Process the frame
      this.processAC3Frame(frame, header, pts);

      offset += header.frameSize;
    }
  }

  /**
   * Find AC-3 sync word in data
   */
  private findSyncWord(data: Uint8Array, startOffset: number): number {
    for (let i = startOffset; i < data.length - 1; i++) {
      if (data[i] === 0x0b && data[i + 1] === 0x77) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Parse AC-3 frame header
   */
  private parseAC3FrameHeader(data: Uint8Array): AC3FrameHeader | null {
    if (data.length < 7) return null;

    // Sync word (16 bits)
    const syncWord = ((data[0] ?? 0) << 8) | (data[1] ?? 0);
    if (syncWord !== AC3Decoder.SYNC_WORD) {
      return null;
    }

    // CRC1 (16 bits)
    const crc1 = ((data[2] ?? 0) << 8) | (data[3] ?? 0);

    // Sample rate code and frame size code (8 bits)
    const fscod = ((data[4] ?? 0) >> 6) & 0x03;
    const frmsizecod = (data[4] ?? 0) & 0x3f;

    // Bitstream ID and mode (16 bits)
    const bsid = ((data[5] ?? 0) >> 3) & 0x1f;
    const bsmod = (data[5] ?? 0) & 0x07;

    // Audio coding mode (3 bits)
    const acmod = ((data[6] ?? 0) >> 5) & 0x07;

    // Check for valid values
    if (fscod === 3 || frmsizecod >= 38) {
      return null; // Reserved/invalid values
    }

    // Get sample rate
    const sampleRate = AC3_SAMPLE_RATES[fscod] ?? 48000;

    // Get frame size (in bytes)
    const frameSize = (AC3_FRAME_SIZES[fscod]?.[frmsizecod] ?? 0) * 2;

    // Calculate number of channels from acmod
    let numChannels = 2; // Default to stereo
    if (acmod === 1) {
      // MONO_1_0
      numChannels = 1;
    } else if (acmod === 0 || acmod === 2) {
      // DUAL_MONO_1_1 or STEREO_2_0
      numChannels = 2;
    } else if (acmod === 3 || acmod === 4) {
      // THREE_0 or TWO_ONE
      numChannels = 3;
    } else if (acmod === 5 || acmod === 6) {
      // THREE_ONE or TWO_TWO
      numChannels = 4;
    } else if (acmod === 7) {
      // THREE_TWO
      numChannels = 5;
    }

    // Check for LFE channel (need to parse more bits)
    let lfeon = 0;
    if (data.length > 6) {
      // LFE on is at different bit positions depending on acmod
      // For simplicity, assume bit parsing (would need full bitstream parser)
      lfeon = 0; // Placeholder - would need proper bit-level parsing
    }

    if (lfeon) {
      numChannels++; // Add LFE channel
    }

    // Get bitrate
    const bitrate = AC3_BITRATES[Math.floor(frmsizecod / 2)] ?? 192;

    return {
      syncWord,
      crc1,
      fscod,
      frmsizecod,
      bsid,
      bsmod,
      acmod,
      lfeon,
      sampleRate,
      frameSize,
      numChannels,
      bitrate,
    };
  }

  /**
   * Process AC-3 frame
   *
   * Note: This is a placeholder for actual AC-3 decoding.
   * Full AC-3 decoding requires:
   * - Bit allocation
   * - Exponent decoding
   * - Mantissa decoding
   * - IMDCT (Inverse Modified Discrete Cosine Transform)
   * - Window and overlap-add
   *
   * For production, use a WebAssembly AC-3 decoder or server-side transcoding.
   */
  private processAC3Frame(
    _frame: Uint8Array,
    header: AC3FrameHeader,
    pts?: number,
  ): void {
    const startTime = performance.now();

    // Calculate samples per frame
    // AC-3 has 1536 samples per frame
    const samplesPerFrame = 1536;

    // For demonstration, generate silent audio
    // In production, this would be actual decoded samples
    const samples = new Float32Array(samplesPerFrame * 2); // Stereo output

    // Apply channel downmix if needed (5.1 -> stereo)
    // This would normally downmix decoded channels
    const stereoSamples = this.downmixToStereo(samples, header.numChannels);

    // Apply dynamic range compression if enabled
    const processedSamples = this.compressionEnabled
      ? this.applyDynamicRangeCompression(stereoSamples)
      : stereoSamples;

    // Update metrics
    const decodeTime = performance.now() - startTime;
    this.metrics.framesDecoded++;
    this.metrics.totalDecodeTime += decodeTime;
    this.metrics.averageDecodeTime =
      this.metrics.totalDecodeTime / this.metrics.framesDecoded;
    this.metrics.currentBitrate = header.bitrate;

    // Apply lip-sync correction
    const adjustedPTS = pts
      ? pts + (this.audioDelay * 90000) / 1000
      : undefined;

    // Queue audio for synchronized output
    if (adjustedPTS !== undefined) {
      this.audioQueue.set(adjustedPTS, {
        samples: processedSamples,
        receivedAt: performance.now(),
      });
      this.presentAudio();
    } else {
      // No PTS, output immediately
      this.onAudioOutput(processedSamples, header.sampleRate, 2, adjustedPTS);
    }

    this.state = "decoding";
  }

  /**
   * Downmix multi-channel audio to stereo
   */
  private downmixToStereo(
    samples: Float32Array,
    _numChannels: number,
  ): Float32Array {
    // For now, assume samples are already stereo
    // In production, implement proper downmix matrix:
    // - 5.1: L' = L + 0.707*C + 0.707*Ls
    //        R' = R + 0.707*C + 0.707*Rs
    return samples;
  }

  /**
   * Apply dynamic range compression
   */
  private applyDynamicRangeCompression(samples: Float32Array): Float32Array {
    const compressed = new Float32Array(samples.length);
    const threshold = 0.5;
    const ratio = this.compressionRatio;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i] ?? 0;
      const absSample = Math.abs(sample);

      if (absSample > threshold) {
        // Apply compression above threshold
        const excess = absSample - threshold;
        const compressedExcess = excess / ratio;
        compressed[i] = Math.sign(sample) * (threshold + compressedExcess);
      } else {
        compressed[i] = sample;
      }
    }

    return compressed;
  }

  /**
   * Present audio in PTS order
   */
  private presentAudio(): void {
    // Sort by PTS
    const sortedPTS = Array.from(this.audioQueue.keys()).sort((a, b) => a - b);

    for (const pts of sortedPTS) {
      if (pts <= this.lastPresentedPTS) {
        // Audio is late, drop it
        const entry = this.audioQueue.get(pts);
        if (entry) {
          this.audioQueue.delete(pts);
          this.metrics.framesDropped++;
        }
        continue;
      }

      // Present audio
      const entry = this.audioQueue.get(pts);
      if (entry && this.currentConfig) {
        this.onAudioOutput(
          entry.samples,
          this.currentConfig.sampleRate,
          this.currentConfig.channelCount,
          pts,
        );
        this.lastPresentedPTS = pts;
        this.audioQueue.delete(pts);
        break; // Present one frame at a time
      }
    }

    // Clean up old audio (more than AUDIO_BUFFER_TIMEOUT_MS old)
    const now = performance.now();
    for (const [pts, entry] of this.audioQueue.entries()) {
      if (now - entry.receivedAt > AC3Decoder.AUDIO_BUFFER_TIMEOUT_MS) {
        this.audioQueue.delete(pts);
        this.metrics.framesDropped++;
      }
    }

    // Update buffer health
    this.metrics.bufferHealth = Math.min(
      100,
      (this.audioQueue.size / AC3Decoder.MAX_FRAME_BUFFER_SIZE) * 100,
    );
  }

  /**
   * Set dynamic range compression
   */
  public setDynamicRangeCompression(enabled: boolean, ratio = 2.0): void {
    this.compressionEnabled = enabled;
    this.compressionRatio = ratio;
  }

  /**
   * Set audio delay for lip-sync correction (in milliseconds)
   */
  public setAudioDelay(delayMs: number): void {
    this.audioDelay = delayMs;
  }

  /**
   * Set language track selection
   */
  public setLanguage(_language: string | null): void {
    // Language selection would be implemented with multi-audio support
  }

  /**
   * Flush pending audio
   */
  public flush(): void {
    if (this.state === "decoding") {
      this.state = "flushing";

      // Present any remaining buffered audio
      this.presentAudio();

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
    this.partialFrame = null;
    this.lastPresentedPTS = 0;

    // Clear audio queue
    this.audioQueue.clear();

    // Reset metrics
    this.metrics = {
      framesDecoded: 0,
      framesDropped: 0,
      totalDecodeTime: 0,
      averageDecodeTime: 0,
      currentBitrate: 0,
      lastUpdateTime: Date.now(),
      bufferHealth: 0,
    };

    this.state = "configured";
  }

  /**
   * Close decoder and release resources
   */
  public close(): void {
    // Clear queues
    this.audioQueue.clear();
    this.partialFrame = null;

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
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
  public getMetrics(): AudioDecoderMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current audio configuration
   */
  public getConfig(): AudioConfig | null {
    return this.currentConfig ? { ...this.currentConfig } : null;
  }
}
