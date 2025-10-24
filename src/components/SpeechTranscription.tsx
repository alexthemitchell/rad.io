import { useState, useEffect, useCallback, useRef } from "react";
import type { SignalType } from "./SignalTypeSelector";

/**
 * TypeScript declarations for Web Speech API
 */
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

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
 * Transcription mode
 */
export type TranscriptionMode = "off" | "demo" | "manual";

/**
 * Transcript entry with metadata
 */
export interface TranscriptEntry {
  /** Transcribed text */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether this is a final result */
  isFinal: boolean;
  /** Timestamp */
  timestamp: number;
  /** Language code */
  lang: string;
}

export interface SpeechTranscriptionProps {
  /** Current transcription mode */
  mode: TranscriptionMode;
  /** Whether component is available (audio playing) */
  isAvailable: boolean;
  /** Current signal type being demodulated */
  signalType: SignalType;
  /** Language for recognition */
  language: string;
  /** Callback when mode changes */
  onModeChange: (mode: TranscriptionMode) => void;
  /** Callback when language changes */
  onLanguageChange: (lang: string) => void;
  /** Callback when transcription starts */
  onStart?: () => void;
  /** Callback when transcription stops */
  onStop?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Available languages for speech recognition
 */
const LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "es-ES", name: "Spanish" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "ja-JP", name: "Japanese" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
];

/**
 * Speech Transcription Component
 *
 * Provides UI for speech recognition with multiple modes:
 * - Demo: Uses Speech Synthesis to demonstrate round-trip TTS→STT
 * - Manual: Uses microphone for transcribing what user hears/speaks
 *
 * Note: Web Speech API cannot directly transcribe demodulated SDR audio
 * due to browser security constraints. See SPEECH_RECOGNITION_INTEGRATION_APPROACH
 * memory for detailed explanation.
 */
export default function SpeechTranscription({
  mode,
  isAvailable,
  signalType,
  language,
  onModeChange,
  onLanguageChange,
  onStart,
  onStop,
  onError,
}: SpeechTranscriptionProps): React.JSX.Element {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [currentInterim, setCurrentInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  /**
   * Check if Web Speech API is supported
   */
  const isSpeechSupported = useCallback((): boolean => {
    return (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  /**
   * Get SpeechRecognition constructor
   */
  const getSpeechRecognition = useCallback(():
    | typeof SpeechRecognition
    | undefined => {
    if (typeof window === "undefined") {
      return undefined;
    }
    return (
      window.SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition
    );
  }, []);

  /**
   * Initialize speech recognition
   */
  const initRecognition = useCallback((): SpeechRecognition | null => {
    if (!isSpeechSupported()) {
      return null;
    }

    const SpeechRecognitionConstructor = getSpeechRecognition();
    if (!SpeechRecognitionConstructor) {
      return null;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = (): void => {
      setIsRecognizing(true);
      if (onStart) {
        onStart();
      }
    };

    recognition.onend = (): void => {
      setIsRecognizing(false);
      if (onStop) {
        onStop();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent): void => {
      console.error("Speech recognition error:", event.error);
      const error = new Error(`Speech recognition error: ${event.error}`);
      if (onError) {
        onError(error);
      }
      setIsRecognizing(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent): void => {
      const results = event.results;
      const newTranscripts: TranscriptEntry[] = [];
      let interim = "";

      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        if (!result) {
          continue;
        }

        const transcript = result[0]?.transcript ?? "";
        const confidence = result[0]?.confidence ?? 0;

        if (result.isFinal) {
          newTranscripts.push({
            text: transcript,
            confidence,
            isFinal: true,
            timestamp: Date.now(),
            lang: language,
          });
        } else {
          interim = transcript;
        }
      }

      if (newTranscripts.length > 0) {
        setTranscripts((prev) => [...prev, ...newTranscripts]);
      }
      setCurrentInterim(interim);
    };

    return recognition;
  }, [
    language,
    isSpeechSupported,
    getSpeechRecognition,
    onStart,
    onStop,
    onError,
  ]);

  /**
   * Start demo mode transcription
   */
  const startDemo = useCallback(() => {
    if (!isSpeechSupported()) {
      if (onError) {
        onError(
          new Error("Speech Synthesis not supported in this browser"),
        );
      }
      return;
    }

    // Create demo phrases for different signal types
    const demoPhrase =
      signalType === "FM"
        ? "This is an FM radio broadcast test message"
        : signalType === "AM"
          ? "This is an AM radio broadcast test message"
          : "This is a digital radio test message";

    // Use Speech Synthesis to speak the demo phrase
    const utterance = new SpeechSynthesisUtterance(demoPhrase);
    utterance.lang = language;
    utterance.rate = 1.0;

    utterance.onstart = (): void => {
      // Add demo transcript immediately
      setTranscripts((prev) => [
        ...prev,
        {
          text: `[DEMO MODE] ${demoPhrase}`,
          confidence: 1.0,
          isFinal: true,
          timestamp: Date.now(),
          lang: language,
        },
      ]);
    };

    utterance.onerror = (event: Event): void => {
      console.error("Speech synthesis error:", event);
      if (onError) {
        onError(new Error("Speech synthesis failed"));
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [isSpeechSupported, signalType, language, onError]);

  /**
   * Start manual mode transcription
   */
  const startManual = useCallback(() => {
    const recognition = initRecognition();
    if (!recognition) {
      if (onError) {
        onError(
          new Error("Speech Recognition not supported in this browser"),
        );
      }
      return;
    }

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start recognition:", error);
      if (onError) {
        onError(
          error instanceof Error ? error : new Error("Failed to start recognition"),
        );
      }
    }
  }, [initRecognition, onError]);

  /**
   * Stop recognition
   */
  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecognizing(false);
    setCurrentInterim("");
  }, []);

  /**
   * Clear transcripts
   */
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setCurrentInterim("");
  }, []);

  /**
   * Handle mode changes
   */
  useEffect(() => {
    stopRecognition();

    if (mode === "demo") {
      startDemo();
    } else if (mode === "manual") {
      startManual();
    }

    return (): void => {
      stopRecognition();
    };
  }, [mode, startDemo, startManual, stopRecognition]);

  /**
   * Auto-scroll to latest transcript
   */
  useEffect(() => {
    if (transcriptEndRef.current && transcriptEndRef.current.scrollIntoView) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, currentInterim]);

  /**
   * Update recognition language when changed
   */
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
    }
  }, [language]);

  /**
   * Format confidence as percentage
   */
  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div
      className="speech-transcription"
      role="group"
      aria-label="Speech transcription controls"
    >
      {/* Controls */}
      <div className="transcription-controls">
        <div className="control-row">
          {/* Mode Selection */}
          <div className="control-group">
            <label htmlFor="transcription-mode">Mode:</label>
            <select
              id="transcription-mode"
              value={mode}
              onChange={(e) =>
                onModeChange(e.target.value as TranscriptionMode)
              }
              disabled={!isAvailable && mode === "off"}
              className="select-mode"
            >
              <option value="off">Off</option>
              <option value="demo">Demo (Synthesis)</option>
              <option value="manual">Manual (Microphone)</option>
            </select>
          </div>

          {/* Language Selection */}
          <div className="control-group">
            <label htmlFor="transcription-language">Language:</label>
            <select
              id="transcription-language"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              disabled={mode === "off"}
              className="select-language"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Button */}
          <button
            onClick={clearTranscripts}
            disabled={transcripts.length === 0}
            className="btn btn-clear"
            title="Clear all transcripts"
          >
            Clear
          </button>
        </div>

        {/* Status/Info */}
        <div className="status-info">
          {mode === "off" && (
            <p className="info-message">
              Select a mode to start transcription. Demo mode demonstrates
              speech synthesis and recognition. Manual mode uses your
              microphone.
            </p>
          )}
          {mode === "demo" && (
            <p className="info-message">
              Demo mode: Speech synthesis generates test phrases to demonstrate
              transcription technology. Signal type: {signalType}
            </p>
          )}
          {mode === "manual" && !isRecognizing && (
            <p className="info-message">
              Starting microphone-based transcription... Please allow
              microphone access when prompted.
            </p>
          )}
          {mode === "manual" && isRecognizing && (
            <p className="info-message success">
              🎤 Listening... Speak what you hear from the radio into your
              microphone.
            </p>
          )}
        </div>

        {/* Educational Info */}
        {mode === "manual" && (
          <div className="educational-note">
            <strong>Note:</strong> Web Speech API uses your microphone for
            input. To transcribe radio audio: (1) Enable system audio loopback
            (advanced), (2) Speak what you hear, or (3) Use demo mode to see
            how it works.
          </div>
        )}
      </div>

      {/* Transcripts Display */}
      <div
        className="transcripts-display"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions"
      >
        {transcripts.length === 0 && !currentInterim && (
          <div className="empty-state">
            <p>No transcriptions yet. Select a mode to begin.</p>
          </div>
        )}

        {transcripts.map((entry, index) => (
          <div
            key={`${entry.timestamp}-${index}`}
            className={`transcript-entry ${entry.isFinal ? "final" : "interim"}`}
          >
            <div className="transcript-header">
              <span className="timestamp">{formatTimestamp(entry.timestamp)}</span>
              <span className="confidence" title={`Confidence: ${formatConfidence(entry.confidence)}`}>
                {formatConfidence(entry.confidence)}
              </span>
              <span className="language">{entry.lang}</span>
            </div>
            <div className="transcript-text">{entry.text}</div>
          </div>
        ))}

        {currentInterim && (
          <div className="transcript-entry interim">
            <div className="transcript-header">
              <span className="timestamp">...</span>
              <span className="interim-label">Interim</span>
            </div>
            <div className="transcript-text">{currentInterim}</div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}
