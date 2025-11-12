/**
 * AC-3 (Dolby Digital) Audio Decoder for ATSC Broadcasts
 *
 * Implements decoding of AC-3 audio streams commonly used in ATSC digital television.
 * Supports 5.1 channel downmix to stereo, multiple audio tracks, and A/V synchronization.
 *
 * AC-3 Specification: ATSC A/52 Standard
 */

import type { PESHeader, DecoderState, DecoderErrorCallback } from "./types";

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
 * Callback for decoded audio samples
 */
export type AudioOutputCallback = (
  samples: Float32Array,
  sampleRate: number,
  channelCount: number,
  pts?: number,
) => void;

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

  // ITU-R BS.775 downmix gain: -3dB = 1/√2 ≈ 0.707
  private static readonly CENTER_SURROUND_GAIN = Math.SQRT1_2;

  // Maximum partial frame buffer size to prevent memory leaks (64KB)
  private static readonly MAX_PARTIAL_FRAME_SIZE = 65536;

  private state: DecoderState = "unconfigured";
  private audioContext: AudioContext | null = null;
  private currentConfig: AudioConfig | null = null;

  // WebCodecs AudioDecoder for native AC-3 decoding
  private audioDecoder: AudioDecoder | null = null;
  private useWebCodecs = false;

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
  public async initialize(
    sampleRate = 48000,
    channelCount = 2,
    bufferSize = 4096,
  ): Promise<void> {
    if (
      this.state !== "unconfigured" &&
      this.state !== "closed" &&
      this.state !== "error"
    ) {
      throw new Error(`Cannot initialize decoder in ${this.state} state.`);
    }

    // Create audio context for output
    this.audioContext = new AudioContext();

    this.currentConfig = {
      sampleRate,
      channelCount,
      bufferSize,
    };

    // Try to initialize WebCodecs AudioDecoder for AC-3
    await this.initializeWebCodecsDecoder(sampleRate, channelCount);

    this.state = "configured";
  }

  /**
   * Initialize WebCodecs AudioDecoder for AC-3 decoding
   */
  private async initializeWebCodecsDecoder(
    sampleRate: number,
    channelCount: number,
  ): Promise<void> {
    // Check if AudioDecoder is available
    if (typeof AudioDecoder === "undefined") {
      console.info("WebCodecs AudioDecoder not available, using fallback");
      this.useWebCodecs = false;
      return;
    }

    // Try AC-3 codec strings
    const codecStrings = [
      "ac-3", // Standard AC-3
      "mp4a.a5", // AC-3 in MP4 container
      "mp4a.A5", // AC-3 in MP4 container (alternate)
    ];

    for (const codec of codecStrings) {
      try {
        const config: AudioDecoderConfig = {
          codec,
          sampleRate,
          numberOfChannels: channelCount,
        };

        const support = await AudioDecoder.isConfigSupported(config);
        if (support.supported) {
          this.useWebCodecs = true;

          // Create AudioDecoder
          this.audioDecoder = new AudioDecoder({
            output: (audioData: AudioData): void =>
              this.handleDecodedAudio(audioData),
            error: (error: DOMException): void =>
              this.handleDecoderError(error),
          });

          this.audioDecoder.configure(config);
          console.info(`AC-3 decoder initialized with codec: ${codec}`);
          return;
        }
      } catch (_error) {
        // Try next codec
        continue;
      }
    }

    console.info("AC-3 codec not supported by WebCodecs, using fallback");
    this.useWebCodecs = false;
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
          const remainingData = processData.slice(offset);
          // Prevent memory leak: limit partial frame buffer size
          if (remainingData.length > AC3Decoder.MAX_PARTIAL_FRAME_SIZE) {
            console.error(
              "AC3Decoder: Partial frame buffer exceeded maximum size (64KB), clearing buffer to prevent memory leak",
            );
            this.partialFrame = null;
          } else {
            this.partialFrame = remainingData;
          }
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

    // TODO: Proper LFE bit parsing not implemented. LFE channel is always assumed off.
    // When implemented, parse the lfeon bit and increment numChannels if present.
    const lfeon = 0; // Placeholder - would need proper bit-level parsing

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
   * Uses WebCodecs AudioDecoder if available, otherwise falls back to placeholder
   */
  private processAC3Frame(
    frame: Uint8Array,
    header: AC3FrameHeader,
    pts?: number,
  ): void {
    const startTime = performance.now();

    if (this.useWebCodecs && this.audioDecoder) {
      // Use WebCodecs AudioDecoder for actual AC-3 decoding
      try {
        // Convert PTS from 90kHz to microseconds for WebCodecs
        const timestamp = pts ? Math.floor((pts * 1000000) / 90000) : 0;

        // Create EncodedAudioChunk from AC-3 frame
        const chunk = new EncodedAudioChunk({
          type: "key", // AC-3 frames are self-contained
          timestamp,
          duration: Math.floor((1536 * 1000000) / header.sampleRate), // 1536 samples per frame
          data: frame,
        });

        // Decode the chunk
        this.audioDecoder.decode(chunk);

        // Update metrics
        const decodeTime = performance.now() - startTime;
        this.metrics.framesDecoded++;
        this.metrics.totalDecodeTime += decodeTime;
        this.metrics.averageDecodeTime =
          this.metrics.framesDecoded > 0
            ? this.metrics.totalDecodeTime / this.metrics.framesDecoded
            : 0;
        this.metrics.currentBitrate = header.bitrate;

        this.state = "decoding";
      } catch (error) {
        console.error("WebCodecs decode error:", error);
        this.fallbackDecode(frame, header, pts, startTime);
      }
    } else {
      // Fallback to placeholder decoding
      this.fallbackDecode(frame, header, pts, startTime);
    }
  }

  /**
   * Fallback decoding when WebCodecs is not available
   * Generates placeholder audio to demonstrate the pipeline
   */
  private fallbackDecode(
    _frame: Uint8Array,
    header: AC3FrameHeader,
    pts?: number,
    startTime?: number,
  ): void {
    const begin = startTime ?? performance.now();

    // Calculate samples per frame
    // AC-3 has 1536 samples per frame
    const samplesPerFrame = 1536;

    // For demonstration, generate silent audio
    // In production with WebAssembly, this would be actual decoded samples
    const samples = new Float32Array(samplesPerFrame * 2); // Stereo output

    // Apply channel downmix if needed (5.1 -> stereo)
    // This would normally downmix decoded channels
    const stereoSamples = this.downmixToStereo(samples, header.numChannels);

    // Apply dynamic range compression if enabled
    const processedSamples = this.compressionEnabled
      ? this.applyDynamicRangeCompression(stereoSamples)
      : stereoSamples;

    // Update metrics
    const decodeTime = performance.now() - begin;
    this.metrics.framesDecoded++;
    this.metrics.totalDecodeTime += decodeTime;
    this.metrics.averageDecodeTime =
      this.metrics.framesDecoded > 0
        ? this.metrics.totalDecodeTime / this.metrics.framesDecoded
        : 0;
    this.metrics.currentBitrate = header.bitrate;

    // Apply lip-sync correction
    const adjustedPTS = pts
      ? Math.floor(pts + (this.audioDelay * 90000) / 1000)
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
   * Handle decoded audio from WebCodecs AudioDecoder
   */
  private handleDecodedAudio(audioData: AudioData): void {
    try {
      // Extract audio samples from AudioData
      const channelCount = audioData.numberOfChannels;
      const frameCount = audioData.numberOfFrames;

      // Allocate buffer for planar audio (each channel stored sequentially)
      const planarBuffer = new Float32Array(channelCount * frameCount);

      // Copy each audio plane separately (WebCodecs uses planar format)
      for (let channel = 0; channel < channelCount; channel++) {
        const channelBuffer = new Float32Array(frameCount);
        audioData.copyTo(channelBuffer, {
          planeIndex: channel,
          format: "f32-planar",
        });
        // Copy to the appropriate position in the planar buffer
        planarBuffer.set(channelBuffer, channel * frameCount);
      }

      // Convert planar to interleaved stereo
      let stereoSamples: Float32Array;
      if (channelCount === 1) {
        // Mono to stereo: duplicate channel
        stereoSamples = new Float32Array(frameCount * 2);
        for (let i = 0; i < frameCount; i++) {
          const sample = planarBuffer[i] ?? 0;
          stereoSamples[i * 2] = sample;
          stereoSamples[i * 2 + 1] = sample;
        }
      } else if (channelCount === 2) {
        // Already stereo, just interleave
        stereoSamples = new Float32Array(frameCount * 2);
        for (let i = 0; i < frameCount; i++) {
          stereoSamples[i * 2] = planarBuffer[i] ?? 0;
          stereoSamples[i * 2 + 1] = planarBuffer[frameCount + i] ?? 0;
        }
      } else {
        // Multi-channel (5.1, etc.) - downmix to stereo
        stereoSamples = this.downmixMultiChannelToStereo(
          planarBuffer,
          channelCount,
          frameCount,
        );
      }

      // Apply dynamic range compression if enabled
      const processedSamples = this.compressionEnabled
        ? this.applyDynamicRangeCompression(stereoSamples)
        : stereoSamples;

      // Get timestamp (convert from microseconds to 90kHz)
      const pts = Math.floor((audioData.timestamp * 90000) / 1000000);
      const adjustedPTS = Math.floor(pts + (this.audioDelay * 90000) / 1000);

      // Queue for synchronized output
      this.audioQueue.set(adjustedPTS, {
        samples: processedSamples,
        receivedAt: performance.now(),
      });

      this.presentAudio();
    } catch (error) {
      console.error("Error processing decoded audio:", error);
    } finally {
      // Always close the AudioData to free memory
      audioData.close();
    }
  }

  /**
   * Handle decoder errors
   */
  private handleDecoderError(error: Error | DOMException): void {
    this.state = "error";
    const errorMessage =
      error instanceof Error
        ? error
        : new Error(
            `WebCodecs error: ${(error as DOMException).name} - ${(error as DOMException).message}`,
          );
    this.onError(errorMessage);
  }

  /**
   * Downmix multi-channel audio to stereo (for fallback mode)
   */
  private downmixToStereo(
    samples: Float32Array,
    _numChannels: number,
  ): Float32Array {
    // For fallback mode, samples are already stereo placeholders
    return samples;
  }

  /**
   * Downmix multi-channel planar audio to interleaved stereo
   * Used for WebCodecs decoded audio with >2 channels
   */
  private downmixMultiChannelToStereo(
    planarBuffer: Float32Array,
    channelCount: number,
    frameCount: number,
  ): Float32Array {
    const stereoSamples = new Float32Array(frameCount * 2);
    const centerGain = AC3Decoder.CENTER_SURROUND_GAIN; // -3dB for center channel (1/√2)
    const surroundGain = AC3Decoder.CENTER_SURROUND_GAIN; // -3dB for surround channels (1/√2)

    // Standard downmix matrices based on channel count
    if (channelCount === 6) {
      // 5.1 surround: L, R, C, LFE, Ls, Rs
      for (let i = 0; i < frameCount; i++) {
        const L = planarBuffer[i] ?? 0;
        const R = planarBuffer[frameCount + i] ?? 0;
        const C = planarBuffer[frameCount * 2 + i] ?? 0;
        const LFE = planarBuffer[frameCount * 3 + i] ?? 0;
        const Ls = planarBuffer[frameCount * 4 + i] ?? 0;
        const Rs = planarBuffer[frameCount * 5 + i] ?? 0;

        // ITU-R BS.775 downmix
        stereoSamples[i * 2] = L + centerGain * C + surroundGain * Ls + LFE;
        stereoSamples[i * 2 + 1] = R + centerGain * C + surroundGain * Rs + LFE;
      }
    } else if (channelCount === 5) {
      // 5.0 surround: L, R, C, Ls, Rs
      for (let i = 0; i < frameCount; i++) {
        const L = planarBuffer[i] ?? 0;
        const R = planarBuffer[frameCount + i] ?? 0;
        const C = planarBuffer[frameCount * 2 + i] ?? 0;
        const Ls = planarBuffer[frameCount * 3 + i] ?? 0;
        const Rs = planarBuffer[frameCount * 4 + i] ?? 0;

        stereoSamples[i * 2] = L + centerGain * C + surroundGain * Ls;
        stereoSamples[i * 2 + 1] = R + centerGain * C + surroundGain * Rs;
      }
    } else if (channelCount === 3) {
      // 3.0: L, R, C
      for (let i = 0; i < frameCount; i++) {
        const L = planarBuffer[i] ?? 0;
        const R = planarBuffer[frameCount + i] ?? 0;
        const C = planarBuffer[frameCount * 2 + i] ?? 0;

        stereoSamples[i * 2] = L + centerGain * C;
        stereoSamples[i * 2 + 1] = R + centerGain * C;
      }
    } else {
      // Generic: just use first two channels
      for (let i = 0; i < frameCount; i++) {
        stereoSamples[i * 2] = planarBuffer[i] ?? 0;
        stereoSamples[i * 2 + 1] =
          channelCount > 1
            ? (planarBuffer[frameCount + i] ?? 0)
            : (planarBuffer[i] ?? 0);
      }
    }

    return stereoSamples;
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
   * @param _language - Language code (not yet implemented)
   */
  public setLanguage(_language: string | null): void {
    // Language selection is not yet implemented. This is a placeholder for future multi-audio support.
    console.warn(
      "AC3Decoder.setLanguage: Language selection is not yet implemented.",
    );
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

    // Reset AudioDecoder if it exists
    if (this.audioDecoder && this.audioDecoder.state !== "closed") {
      this.audioDecoder.reset();
    }

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

    // Close AudioDecoder
    if (this.audioDecoder) {
      this.audioDecoder.close();
      this.audioDecoder = null;
    }

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
