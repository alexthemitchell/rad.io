/**
 * Web Speech API Integration for SDR Audio Streams
 *
 * Provides speech-to-text transcription capabilities for demodulated audio
 * from radio signals using the browser's native Web Speech API.
 *
 * IMPORTANT LIMITATIONS:
 * ======================
 * - Web Speech API requires an internet connection in most browsers (Chrome, Edge, Safari)
 * - Recognition is powered by cloud-based services (e.g., Google Speech API)
 * - There is NO true offline speech recognition available via Web Speech API
 * - Audio quality from radio demodulation may affect recognition accuracy
 * - Best results with clear speech signals (FM radio talk shows, AM radio news, etc.)
 *
 * Browser Support:
 * ================
 * - Chrome/Edge: Uses Google's cloud speech recognition (requires internet)
 * - Safari: Uses Apple's cloud speech recognition (requires internet)
 * - Firefox: Limited/no support for Web Speech API
 *
 * @module speechRecognition
 */

import type { AudioStreamResult } from "./audioStream";

/**
 * Speech recognition result from the Web Speech API
 */
export type SpeechRecognitionTranscript = {
  /** The transcribed text */
  text: string;
  /** Confidence score (0-1, where 1 is highest confidence) */
  confidence: number;
  /** Whether this is a final result or interim */
  isFinal: boolean;
  /** Timestamp when recognition occurred */
  timestamp: number;
};

/**
 * Speech recognition error types
 */
export enum SpeechRecognitionErrorType {
  NO_SPEECH = "no-speech",
  ABORTED = "aborted",
  AUDIO_CAPTURE = "audio-capture",
  NETWORK = "network",
  NOT_ALLOWED = "not-allowed",
  SERVICE_NOT_ALLOWED = "service-not-allowed",
  BAD_GRAMMAR = "bad-grammar",
  LANGUAGE_NOT_SUPPORTED = "language-not-supported",
  NO_MATCH = "no-match",
  UNKNOWN = "unknown",
}

/**
 * Speech recognition error
 */
export class SpeechRecognitionError extends Error {
  constructor(
    public errorType: SpeechRecognitionErrorType,
    message: string,
  ) {
    super(message);
    this.name = "SpeechRecognitionError";
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SpeechRecognitionError.prototype);
  }
}

/**
 * Configuration for speech recognition
 */
export type SpeechRecognitionConfig = {
  /** Language code (e.g., 'en-US', 'es-ES') */
  lang?: string;
  /** Whether to return interim results as speech is being recognized */
  interimResults?: boolean;
  /** Maximum number of alternative transcriptions to return */
  maxAlternatives?: number;
  /** Continuous recognition (keeps listening after results) */
  continuous?: boolean;
};

/**
 * Speech Recognition Processor
 *
 * Integrates Web Speech API with SDR audio streams for real-time transcription.
 * Uses MediaStream API to pipe audio buffers to speech recognition engine.
 *
 * @example
 * ```typescript
 * const recognizer = new SpeechRecognitionProcessor({
 *   lang: 'en-US',
 *   interimResults: true,
 *   continuous: true
 * });
 *
 * recognizer.onTranscript = (transcript) => {
 *   console.log(`${transcript.isFinal ? 'Final' : 'Interim'}: ${transcript.text}`);
 * };
 *
 * recognizer.onError = (error) => {
 *   console.error('Recognition error:', error);
 * };
 *
 * // Connect to audio stream
 * await recognizer.start();
 *
 * // Process audio from SDR
 * const audioResult = await audioProcessor.extractAudio(iqSamples, DemodulationType.FM);
 * await recognizer.processAudio(audioResult);
 * ```
 */
export class SpeechRecognitionProcessor {
  private recognition: SpeechRecognition | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private isRecognizing = false;
  private config: Required<SpeechRecognitionConfig>;

  /** Callback for transcription results */
  public onTranscript:
    | ((transcript: SpeechRecognitionTranscript) => void)
    | null = null;

  /** Callback for recognition errors */
  public onError: ((error: SpeechRecognitionError) => void) | null = null;

  /** Callback when recognition starts */
  public onStart: (() => void) | null = null;

  /** Callback when recognition ends */
  public onEnd: (() => void) | null = null;

  constructor(config: SpeechRecognitionConfig = {}) {
    this.config = {
      lang: config.lang || "en-US",
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives || 1,
      continuous: config.continuous ?? true,
    };
  }

  /**
   * Check if Web Speech API is supported in the current browser
   */
  static isSupported(): boolean {
    if (typeof global !== "undefined") {
      // Check global scope (for tests)
      return (
        typeof (global as any).SpeechRecognition !== "undefined" ||
        typeof (global as any).webkitSpeechRecognition !== "undefined"
      );
    }

    if (typeof window !== "undefined") {
      // Check window scope (for browser)
      return (
        typeof window.SpeechRecognition !== "undefined" ||
        typeof window.webkitSpeechRecognition !== "undefined"
      );
    }

    return false;
  }

  /**
   * Initialize and start speech recognition
   *
   * @throws {SpeechRecognitionError} If Web Speech API is not supported
   */
  async start(): Promise<void> {
    if (!SpeechRecognitionProcessor.isSupported()) {
      throw new SpeechRecognitionError(
        SpeechRecognitionErrorType.NOT_ALLOWED,
        "Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.",
      );
    }

    // Initialize audio context for media stream processing
    this.audioContext = new AudioContext();
    this.mediaStreamDestination =
      this.audioContext.createMediaStreamDestination();

    // Create speech recognition instance
    const SpeechRecognitionConstructor =
      (typeof window !== "undefined" &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
      (typeof global !== "undefined" &&
        ((global as any).SpeechRecognition ||
          (global as any).webkitSpeechRecognition));

    if (!SpeechRecognitionConstructor) {
      throw new SpeechRecognitionError(
        SpeechRecognitionErrorType.NOT_ALLOWED,
        "Web Speech API is not available",
      );
    }

    this.recognition = new SpeechRecognitionConstructor() as any;

    // Configure recognition
    (this.recognition as any).lang = this.config.lang;
    (this.recognition as any).interimResults = this.config.interimResults;
    (this.recognition as any).maxAlternatives = this.config.maxAlternatives;
    (this.recognition as any).continuous = this.config.continuous;

    // Set up event handlers
    this.setupEventHandlers();

    // Start recognition
    (this.recognition as any).start();
    this.isRecognizing = true;
  }

  /**
   * Stop speech recognition
   */
  async stop(): Promise<void> {
    if (this.recognition && this.isRecognizing) {
      (this.recognition as any).stop();
      this.isRecognizing = false;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
      this.mediaStreamDestination = null;
    }
  }

  /**
   * Process audio from SDR audio stream
   *
   * Converts AudioBuffer to MediaStream and pipes it to speech recognition.
   * Note: This requires the audio to be played or connected to a MediaStream.
   *
   * @param audioResult - Audio result from AudioStreamProcessor
   */
  async processAudio(audioResult: AudioStreamResult): Promise<void> {
    if (!this.audioContext || !this.mediaStreamDestination) {
      throw new SpeechRecognitionError(
        SpeechRecognitionErrorType.AUDIO_CAPTURE,
        "Recognition not started. Call start() first.",
      );
    }

    // Create buffer source and connect to media stream
    const source = this.audioContext.createBufferSource();
    source.buffer = audioResult.audioBuffer;
    source.connect(this.mediaStreamDestination);
    source.start();
  }

  /**
   * Get the MediaStream for direct connection to Web Audio API nodes
   *
   * This allows you to connect DSP output directly to speech recognition:
   * ```typescript
   * const stream = recognizer.getMediaStream();
   * // Connect your audio source to this stream
   * audioSourceNode.connect(streamDestination);
   * ```
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStreamDestination?.stream || null;
  }

  /**
   * Check if recognition is currently active
   */
  isActive(): boolean {
    return this.isRecognizing;
  }

  /**
   * Set up event handlers for speech recognition
   */
  private setupEventHandlers(): void {
    if (!this.recognition) {
      return;
    }

    const recognition = this.recognition as any;

    recognition.onstart = () => {
      this.isRecognizing = true;
      if (this.onStart) {
        this.onStart();
      }
    };

    recognition.onend = () => {
      this.isRecognizing = false;
      if (this.onEnd) {
        this.onEnd();
      }

      // Automatically restart if continuous mode is enabled
      if (this.config.continuous && this.recognition) {
        try {
          (this.recognition as any).start();
        } catch {
          // Ignore errors on restart attempt
        }
      }
    };

    recognition.onresult = (event: any) => {
      if (!this.onTranscript) {
        return;
      }

      // Process results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) {
          continue;
        }

        const alternative = result[0];
        if (!alternative) {
          continue;
        }

        const transcript: SpeechRecognitionTranscript = {
          text: alternative.transcript,
          confidence: alternative.confidence,
          isFinal: result.isFinal,
          timestamp: Date.now(),
        };

        this.onTranscript(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      const errorType = this.mapErrorType(event.error);
      const error = new SpeechRecognitionError(
        errorType,
        `Speech recognition error: ${event.error} - ${event.message || "Unknown error"}`,
      );

      if (this.onError) {
        this.onError(error);
      }
    };

    recognition.onnomatch = () => {
      const error = new SpeechRecognitionError(
        SpeechRecognitionErrorType.NO_MATCH,
        "No speech was recognized",
      );

      if (this.onError) {
        this.onError(error);
      }
    };
  }

  /**
   * Map browser error codes to our error types
   */
  private mapErrorType(errorCode: string): SpeechRecognitionErrorType {
    switch (errorCode) {
      case "no-speech":
        return SpeechRecognitionErrorType.NO_SPEECH;
      case "aborted":
        return SpeechRecognitionErrorType.ABORTED;
      case "audio-capture":
        return SpeechRecognitionErrorType.AUDIO_CAPTURE;
      case "network":
        return SpeechRecognitionErrorType.NETWORK;
      case "not-allowed":
        return SpeechRecognitionErrorType.NOT_ALLOWED;
      case "service-not-allowed":
        return SpeechRecognitionErrorType.SERVICE_NOT_ALLOWED;
      case "bad-grammar":
        return SpeechRecognitionErrorType.BAD_GRAMMAR;
      case "language-not-supported":
        return SpeechRecognitionErrorType.LANGUAGE_NOT_SUPPORTED;
      default:
        return SpeechRecognitionErrorType.UNKNOWN;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.stop();
    this.onTranscript = null;
    this.onError = null;
    this.onStart = null;
    this.onEnd = null;
  }
}

/**
 * Create a speech recognition processor with audio stream integration
 *
 * Convenience function to create a processor that automatically processes
 * audio results from the AudioStreamProcessor.
 *
 * @param onTranscript - Callback for transcription results
 * @param config - Speech recognition configuration
 * @returns Speech recognition processor instance
 *
 * @example
 * ```typescript
 * const recognizer = createSpeechRecognizer(
 *   (transcript) => {
 *     if (transcript.isFinal) {
 *       console.log('Transcription:', transcript.text);
 *     }
 *   },
 *   { lang: 'en-US', interimResults: true }
 * );
 *
 * await recognizer.start();
 *
 * // In your audio processing loop:
 * const audioResult = await audioProcessor.extractAudio(iqSamples, DemodulationType.FM);
 * await recognizer.processAudio(audioResult);
 * ```
 */
export function createSpeechRecognizer(
  onTranscript: (transcript: SpeechRecognitionTranscript) => void,
  config: SpeechRecognitionConfig = {},
): SpeechRecognitionProcessor {
  const processor = new SpeechRecognitionProcessor(config);
  processor.onTranscript = onTranscript;
  return processor;
}
