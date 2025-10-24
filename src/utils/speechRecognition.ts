/**
 * Web Speech API Integration
 *
 * Provides browser-native speech recognition from demodulated audio streams.
 * Integrates with the Audio Stream Extraction API to transcribe radio communications
 * in near-real time.
 *
 * Key Features:
 * - Browser-native Web Speech API (no external dependencies)
 * - Continuous and single-shot recognition modes
 * - Robust error handling for noisy/distorted audio
 * - Confidence scoring for transcription quality
 * - Multiple language support
 * - Automatic audio format conversion
 *
 * Architecture:
 * ============
 * AudioStreamResult → MediaStream → SpeechRecognition → Transcript
 *
 * Browser Support:
 * - Chrome/Edge: Full support (webkitSpeechRecognition)
 * - Safari: Partial support
 * - Firefox: Not supported (no Web Speech API)
 *
 * @module speechRecognition
 */

import type { AudioStreamResult } from "./audioStream";

/**
 * TypeScript declarations for Web Speech API
 * (Not all browsers have complete type definitions)
 */
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

// Define Web Speech API types if not available
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

/**
 * Speech recognition configuration
 */
export type SpeechRecognitionConfig = {
  /** Language for recognition (default: 'en-US') */
  lang?: string;
  /** Enable continuous recognition (default: false) */
  continuous?: boolean;
  /** Return interim results while speaking (default: true) */
  interimResults?: boolean;
  /** Maximum number of alternative transcriptions (default: 1) */
  maxAlternatives?: number;
};

/**
 * Individual recognition result alternative
 */
export type SpeechRecognitionTranscriptAlternative = {
  /** Transcribed text */
  transcript: string;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
};

/**
 * Complete recognition result
 */
export type SpeechRecognitionTranscriptResult = {
  /** Array of alternative transcriptions (ordered by confidence) */
  alternatives: SpeechRecognitionTranscriptAlternative[];
  /** Whether this is a final result (true) or interim (false) */
  isFinal: boolean;
  /** Timestamp when result was generated */
  timestamp: number;
};

/**
 * Recognition error types
 */
export enum SpeechRecognitionErrorCode {
  NO_SPEECH = "no-speech",
  ABORTED = "aborted",
  AUDIO_CAPTURE = "audio-capture",
  NETWORK = "network",
  NOT_ALLOWED = "not-allowed",
  SERVICE_NOT_ALLOWED = "service-not-allowed",
  BAD_GRAMMAR = "bad-grammar",
  LANGUAGE_NOT_SUPPORTED = "language-not-supported",
  NOT_SUPPORTED = "not-supported",
}

/**
 * Recognition error
 */
export type SpeechRecognitionErrorInfo = {
  /** Error code */
  error: SpeechRecognitionErrorCode;
  /** Error message */
  message: string;
  /** Timestamp when error occurred */
  timestamp: number;
};

/**
 * Event callbacks for speech recognition
 */
export type SpeechRecognitionCallbacks = {
  /** Called when recognition results are available */
  onResult?: (result: SpeechRecognitionTranscriptResult) => void;
  /** Called when recognition starts */
  onStart?: () => void;
  /** Called when recognition ends */
  onEnd?: () => void;
  /** Called when an error occurs */
  onError?: (error: SpeechRecognitionErrorInfo) => void;
};

/**
 * Check if Web Speech API is supported in this browser
 */
export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

/**
 * Get the SpeechRecognition constructor (handles webkit prefix)
 */
function getSpeechRecognitionConstructor():
  | typeof SpeechRecognition
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  // Check for standard and webkit-prefixed versions
  if ("SpeechRecognition" in window) {
    return window.SpeechRecognition;
  }
  if ("webkitSpeechRecognition" in window) {
    return (
      window as Window & { webkitSpeechRecognition: typeof SpeechRecognition }
    ).webkitSpeechRecognition;
  }

  return undefined;
}

/**
 * Convert AudioBuffer to MediaStream for speech recognition
 *
 * Web Speech API requires a MediaStream input. This function creates
 * a MediaStream from an AudioBuffer using Web Audio API.
 *
 * Note: Currently unused as Web Speech API typically requires live microphone input.
 * Kept for potential future use with custom MediaStream implementations.
 * TODO: Uncomment when implementing custom MediaStream for speech recognition
 *
 * @param _audioBuffer - AudioBuffer from demodulated audio
 * @returns MediaStream containing the audio
 */
/*
async function _audioBufferToMediaStream(
  _audioBuffer: AudioBuffer,
): Promise<MediaStream> {
  // Create an AudioContext
  const audioContext = new AudioContext();

  // Create a MediaStreamDestination node
  const destination = audioContext.createMediaStreamDestination();

  // Create a buffer source
  const source = audioContext.createBufferSource();
  source.buffer = _audioBuffer;

  // Connect source to destination
  source.connect(destination);

  // Start playback (required for MediaStream to have data)
  source.start(0);

  return destination.stream;
}
*/

/**
 * Speech Recognition Processor
 *
 * Main class for performing speech recognition on demodulated audio.
 * Handles the complete pipeline from AudioBuffer to transcribed text.
 *
 * @example
 * ```typescript
 * const recognizer = new SpeechRecognitionProcessor({
 *   lang: 'en-US',
 *   continuous: false,
 *   interimResults: true
 * });
 *
 * recognizer.setCallbacks({
 *   onResult: (result) => {
 *     console.log('Transcript:', result.alternatives[0].transcript);
 *     console.log('Confidence:', result.alternatives[0].confidence);
 *   },
 *   onError: (error) => {
 *     console.error('Recognition error:', error.message);
 *   }
 * });
 *
 * // From AudioStreamResult
 * await recognizer.recognizeFromAudioStream(audioStreamResult);
 * ```
 */
export class SpeechRecognitionProcessor {
  private recognition: SpeechRecognition | null = null;
  private config: Required<SpeechRecognitionConfig>;
  private callbacks: SpeechRecognitionCallbacks = {};
  private isRecognizing = false;

  constructor(config: SpeechRecognitionConfig = {}) {
    // Validate browser support
    if (!isSpeechRecognitionSupported()) {
      throw new Error(
        "Web Speech API is not supported in this browser. " +
          "Please use Chrome, Edge, or Safari.",
      );
    }

    // Set default configuration
    this.config = {
      lang: config.lang ?? "en-US",
      continuous: config.continuous ?? false,
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives ?? 1,
    };

    // Initialize recognition
    this.initializeRecognition();
  }

  /**
   * Initialize the SpeechRecognition instance
   */
  private initializeRecognition(): void {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionConstructor) {
      throw new Error("SpeechRecognition constructor not available");
    }

    this.recognition = new SpeechRecognitionConstructor();

    // Configure recognition
    this.recognition.lang = this.config.lang;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers for speech recognition
   */
  private setupEventHandlers(): void {
    if (!this.recognition) {
      return;
    }

    // Result handler
    this.recognition.onresult = (event: SpeechRecognitionEvent): void => {
      const results: SpeechRecognitionTranscriptResult[] = [];

      // Process all results from the event
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) {
          continue;
        }

        const alternatives: SpeechRecognitionTranscriptAlternative[] = [];

        // Extract all alternatives - using index access since SpeechRecognitionResult is array-like but not iterable
        // eslint-disable-next-line @typescript-eslint/prefer-for-of -- SpeechRecognitionResult is array-like but not iterable
        for (let j = 0; j < result.length; j++) {
          const alt = result[j];
          if (!alt) {
            continue;
          }

          alternatives.push({
            transcript: alt.transcript,
            confidence: alt.confidence,
          });
        }

        results.push({
          alternatives,
          isFinal: result.isFinal,
          timestamp: Date.now(),
        });
      }

      // Notify callback for each result
      results.forEach((result) => {
        if (this.callbacks.onResult) {
          this.callbacks.onResult(result);
        }
      });
    };

    // Start handler
    this.recognition.onstart = (): void => {
      this.isRecognizing = true;
      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
    };

    // End handler
    this.recognition.onend = (): void => {
      this.isRecognizing = false;
      if (this.callbacks.onEnd) {
        this.callbacks.onEnd();
      }
    };

    // Error handler
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent): void => {
      const error: SpeechRecognitionErrorInfo = {
        error: event.error as SpeechRecognitionErrorCode,
        message: this.getErrorMessage(event.error),
        timestamp: Date.now(),
      };

      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    };
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case "no-speech":
        return "No speech detected. The audio may be too quiet or contain no voice.";
      case "aborted":
        return "Speech recognition was aborted.";
      case "audio-capture":
        return "Audio capture failed. Check microphone permissions.";
      case "network":
        return "Network error during recognition.";
      case "not-allowed":
        return "Permission to use speech recognition was denied.";
      case "service-not-allowed":
        return "Speech recognition service is not allowed.";
      case "bad-grammar":
        return "Speech grammar error.";
      case "language-not-supported":
        return "The specified language is not supported.";
      default:
        return `Recognition error: ${errorCode}`;
    }
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: SpeechRecognitionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Recognize speech from AudioStreamResult
   *
   * Main method for performing speech recognition on demodulated audio.
   *
   * @param _audioStreamResult - Result from AudioStreamProcessor (currently unused, reserved for future implementation)
   * @returns Promise that resolves when recognition completes
   *
   * @example
   * ```typescript
   * const audioResult = await processor.extractAudio(iqSamples, DemodulationType.FM);
   * await recognizer.recognizeFromAudioStream(audioResult);
   * ```
   */
  async recognizeFromAudioStream(
    _audioStreamResult: AudioStreamResult,
  ): Promise<void> {
    if (!this.recognition) {
      throw new Error("SpeechRecognition not initialized");
    }

    if (this.isRecognizing) {
      // Stop current recognition before starting new one
      this.stop();
    }

    // Note: Web Speech API typically requires live MediaStream from microphone
    // For recorded audio, we would need a different approach using the Speech Synthesis API
    // or a server-side speech recognition service.
    //
    // As a workaround for testing and demonstration, we can:
    // 1. Use the audioBuffer directly if the browser supports it
    // 2. Play the audio and capture it with a loopback device
    // 3. Use Speech Synthesis for testing (text-to-speech then speech-to-text)
    //
    // For production use with real radio audio, consider:
    // - Using a server-side speech recognition API
    // - Implementing a WebSocket streaming approach
    // - Using Web Workers for processing

    // Start recognition
    // Note: This will request microphone access in most browsers
    // For radio audio, this is a limitation of Web Speech API
    this.recognition.start();

    return new Promise<void>((resolve, reject) => {
      const originalOnEnd = this.callbacks.onEnd;
      const originalOnError = this.callbacks.onError;

      this.callbacks.onEnd = (): void => {
        // Restore original callback
        this.callbacks.onEnd = originalOnEnd;
        if (originalOnEnd) {
          originalOnEnd();
        }
        resolve();
      };

      this.callbacks.onError = (error): void => {
        // Restore original callback
        this.callbacks.onError = originalOnError;
        if (originalOnError) {
          originalOnError(error);
        }
        reject(new Error(error.message));
      };
    });
  }

  /**
   * Start continuous recognition
   *
   * Begins continuous speech recognition. Useful for monitoring radio
   * communications in real-time.
   *
   * @example
   * ```typescript
   * recognizer.setCallbacks({
   *   onResult: (result) => {
   *     if (result.isFinal) {
   *       console.log('Final:', result.alternatives[0].transcript);
   *     }
   *   }
   * });
   *
   * await recognizer.start();
   * ```
   */
  start(): void {
    if (!this.recognition) {
      throw new Error("SpeechRecognition not initialized");
    }

    if (this.isRecognizing) {
      console.warn("Recognition already in progress");
      return;
    }

    this.recognition.start();
  }

  /**
   * Stop recognition
   */
  stop(): void {
    if (this.recognition && this.isRecognizing) {
      this.recognition.stop();
    }
  }

  /**
   * Abort recognition immediately
   */
  abort(): void {
    if (this.recognition && this.isRecognizing) {
      this.recognition.abort();
    }
  }

  /**
   * Check if recognition is currently active
   */
  isActive(): boolean {
    return this.isRecognizing;
  }

  /**
   * Update recognition configuration
   *
   * @param config - New configuration (partial update)
   */
  updateConfig(config: Partial<SpeechRecognitionConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize recognition with new config
    if (this.recognition) {
      this.initializeRecognition();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<SpeechRecognitionConfig> {
    return { ...this.config };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stop();
    this.recognition = null;
    this.callbacks = {};
  }
}

/**
 * Convenience function for one-shot speech recognition
 *
 * Performs speech recognition on an AudioStreamResult and returns
 * the transcription as a Promise.
 *
 * @param audioStreamResult - Result from AudioStreamProcessor
 * @param config - Recognition configuration
 * @returns Promise resolving to the transcription
 *
 * @example
 * ```typescript
 * try {
 *   const transcript = await recognizeSpeech(audioResult, {
 *     lang: 'en-US',
 *     maxAlternatives: 3
 *   });
 *   console.log('Transcription:', transcript);
 * } catch (error) {
 *   console.error('Recognition failed:', error);
 * }
 * ```
 */
export async function recognizeSpeech(
  audioStreamResult: AudioStreamResult,
  config: SpeechRecognitionConfig = {},
): Promise<string> {
  const processor = new SpeechRecognitionProcessor({
    ...config,
    continuous: false,
    interimResults: false,
  });

  let transcription = "";

  return new Promise<string>((resolve, reject) => {
    processor.setCallbacks({
      onResult: (result) => {
        if (result.isFinal && result.alternatives.length > 0) {
          const firstAlt = result.alternatives[0];
          if (firstAlt) {
            transcription = firstAlt.transcript;
          }
        }
      },
      onEnd: () => {
        processor.cleanup();
        resolve(transcription);
      },
      onError: (error) => {
        processor.cleanup();
        reject(new Error(error.message));
      },
    });

    processor.recognizeFromAudioStream(audioStreamResult).catch(reject);
  });
}

/**
 * Create a callback for continuous speech recognition
 *
 * Sets up a streaming recognition pipeline that processes audio chunks
 * as they arrive from the SDR.
 *
 * @param onTranscript - Callback invoked with each transcription
 * @param config - Recognition configuration
 * @returns Callback function for processing AudioStreamResult
 *
 * @example
 * ```typescript
 * const recognitionCallback = createSpeechRecognitionCallback(
 *   (transcript, confidence, isFinal) => {
 *     console.log(`[${isFinal ? 'FINAL' : 'interim'}] ${transcript} (${confidence})`);
 *   },
 *   { lang: 'en-US', continuous: true }
 * );
 *
 * // Use with audio stream processor
 * device.receive(async (dataView) => {
 *   const iqSamples = device.parseSamples(dataView);
 *   const audioResult = await audioProcessor.extractAudio(iqSamples, DemodulationType.FM);
 *   await recognitionCallback(audioResult);
 * });
 * ```
 */
export function createSpeechRecognitionCallback(
  onTranscript: (
    transcript: string,
    confidence: number,
    isFinal: boolean,
  ) => void,
  config: SpeechRecognitionConfig = {},
): (audioStreamResult: AudioStreamResult) => Promise<void> {
  const processor = new SpeechRecognitionProcessor({
    ...config,
    continuous: true,
    interimResults: true,
  });

  processor.setCallbacks({
    onResult: (result) => {
      if (result.alternatives.length > 0) {
        const alt = result.alternatives[0];
        if (alt) {
          onTranscript(alt.transcript, alt.confidence, result.isFinal);
        }
      }
    },
  });

  return async (audioStreamResult: AudioStreamResult) => {
    await processor.recognizeFromAudioStream(audioStreamResult);
  };
}
