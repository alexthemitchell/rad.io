/**
 * Speech Recognition Integration Example
 *
 * This file demonstrates how to integrate the Speech Recognition API
 * with the existing rad.io visualizer components for real-time radio
 * transcription.
 *
 * To use this in your application:
 * 1. Import the necessary components
 * 2. Create a SpeechRecognitionProcessor instance
 * 3. Connect it to the AudioStreamProcessor output
 * 4. Display transcriptions in the UI
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import { SignalType } from "../components/SignalTypeSelector";
import type { IQSample } from "../models/SDRDevice";
import {
  AudioStreamProcessor,
  DemodulationType,
  type AudioStreamResult,
} from "../utils/audioStream";
import {
  SpeechRecognitionProcessor,
  type SpeechRecognitionTranscript,
  SpeechRecognitionError,
  SpeechRecognitionErrorType,
} from "../utils/speechRecognition";

/**
 * Example component showing speech recognition integration
 */
export function SpeechRecognitionExample() {
  const { device } = useHackRFDevice();
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const [language, setLanguage] = useState("en-US");
  const [transcripts, setTranscripts] = useState<SpeechRecognitionTranscript[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [interimText, setInterimText] = useState<string>("");

  // Audio and recognition processing state
  const audioProcessorRef = useRef<AudioStreamProcessor | null>(null);
  const recognizerRef = useRef<SpeechRecognitionProcessor | null>(null);

  // Check browser support on mount
  useEffect(() => {
    if (!SpeechRecognitionProcessor.isSupported()) {
      setError(
        "Web Speech API is not supported. Please use Chrome, Edge, or Safari.",
      );
    }
  }, []);

  // Initialize processors
  useEffect(() => {
    // Create audio processor with SDR sample rate (20 MHz for HackRF)
    audioProcessorRef.current = new AudioStreamProcessor(20000000);

    // Create speech recognizer
    recognizerRef.current = new SpeechRecognitionProcessor({
      lang: language,
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
    });

    // Set up recognition callbacks
    const recognizer = recognizerRef.current;

    recognizer.onTranscript = (transcript: SpeechRecognitionTranscript) => {
      if (transcript.isFinal) {
        // Add final transcript to history
        setTranscripts((prev) => [...prev.slice(-20), transcript]);
        setInterimText("");
      } else {
        // Update interim text
        setInterimText(transcript.text);
      }
    };

    recognizer.onError = (err: SpeechRecognitionError) => {
      if (err.errorType === SpeechRecognitionErrorType.NETWORK) {
        setError(
          "Network error - Speech recognition requires internet connection",
        );
      } else if (err.errorType === SpeechRecognitionErrorType.NO_SPEECH) {
        setError("No speech detected - Check audio signal quality");
      } else if (err.errorType === SpeechRecognitionErrorType.NOT_ALLOWED) {
        setError("Permission denied - Allow microphone access");
      } else {
        setError(`Recognition error: ${err.message}`);
      }
    };

    recognizer.onStart = () => {
      setIsRecognizing(true);
      setError(null);
    };

    recognizer.onEnd = () => {
      setIsRecognizing(false);
    };

    return () => {
      recognizerRef.current?.cleanup();
      audioProcessorRef.current?.cleanup();
    };
  }, [language]);

  // Map signal type to demodulation type
  const getDemodType = useCallback((type: SignalType): DemodulationType => {
    switch (type) {
      case "FM":
        return DemodulationType.FM;
      case "AM":
        return DemodulationType.AM;
      case "P25":
        // P25 uses C4FM modulation, FM demod extracts symbols
        return DemodulationType.FM;
      default:
        return DemodulationType.NONE;
    }
  }, []);

  // Process IQ samples and extract audio for recognition
  const processIQSamples = useCallback(
    async (dataView: DataView) => {
      const audioProcessor = audioProcessorRef.current;
      const recognizer = recognizerRef.current;

      if (!audioProcessor || !recognizer) {
        return;
      }

      try {
        // Parse IQ samples from DataView (Int8 format for HackRF)
        const iqSamples: IQSample[] = [];
        for (let i = 0; i < dataView.byteLength; i += 2) {
          const I = dataView.getInt8(i) / 128.0;
          const Q = dataView.getInt8(i + 1) / 128.0;
          iqSamples.push({ I, Q });
        }

        // Extract audio using appropriate demodulation
        const demodType = getDemodType(signalType);
        const audioResult: AudioStreamResult =
          await audioProcessor.extractAudio(iqSamples, demodType, {
            sampleRate: 48000, // Standard audio rate
            channels: 1, // Mono output
            enableDeEmphasis: signalType === "FM", // De-emphasis for FM only
          });

        // Send audio to speech recognizer
        await recognizer.processAudio(audioResult);
      } catch (err) {
        console.error("Audio processing error:", err);
      }
    },
    [signalType, getDemodType],
  );

  // Start recognition
  const startRecognition = useCallback(async () => {
    if (!device || !recognizerRef.current) {
      setError("Device or recognizer not ready");
      return;
    }

    if (!SpeechRecognitionProcessor.isSupported()) {
      setError(
        "Web Speech API not supported. Use Chrome, Edge, or Safari browser.",
      );
      return;
    }

    try {
      // Start speech recognizer
      await recognizerRef.current.start();

      // Start receiving IQ samples from device
      await device.receive(processIQSamples);
    } catch (err) {
      setError(
        `Failed to start recognition: ${err instanceof Error ? err.message : String(err)}`,
      );
      setIsRecognizing(false);
    }
  }, [device, processIQSamples]);

  // Stop recognition
  const stopRecognition = useCallback(async () => {
    if (!device || !recognizerRef.current) {
      return;
    }

    try {
      await device.stopRx();
      await recognizerRef.current.stop();
      setIsRecognizing(false);
    } catch (err) {
      console.error("Failed to stop recognition:", err);
    }
  }, [device]);

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setInterimText("");
    setError(null);
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h2>Radio Speech Recognition</h2>

      {/* Status indicator */}
      <div
        style={{
          padding: "10px",
          marginBottom: "20px",
          backgroundColor: isRecognizing ? "#d4edda" : "#f8f9fa",
          border: `1px solid ${isRecognizing ? "#c3e6cb" : "#dee2e6"}`,
          borderRadius: "4px",
        }}
      >
        <strong>Status:</strong>{" "}
        {isRecognizing ? "🔴 Recognizing..." : "⚪ Stopped"}
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            padding: "10px",
            marginBottom: "20px",
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "4px",
            color: "#721c24",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        {/* Signal Type Selection */}
        <div>
          <label style={{ display: "block", marginBottom: "5px" }}>
            Signal Type:
          </label>
          <select
            value={signalType}
            onChange={(e) => setSignalType(e.target.value as SignalType)}
            disabled={isRecognizing}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="FM">FM</option>
            <option value="AM">AM</option>
            <option value="P25">P25</option>
          </select>
        </div>

        {/* Language Selection */}
        <div>
          <label style={{ display: "block", marginBottom: "5px" }}>
            Language:
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isRecognizing}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es-ES">Spanish (Spain)</option>
            <option value="es-MX">Spanish (Mexico)</option>
            <option value="fr-FR">French</option>
            <option value="de-DE">German</option>
            <option value="it-IT">Italian</option>
            <option value="ja-JP">Japanese</option>
            <option value="zh-CN">Chinese (Simplified)</option>
            <option value="pt-BR">Portuguese (Brazil)</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={startRecognition}
          disabled={!device || isRecognizing}
          style={{
            padding: "10px 20px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: !device || isRecognizing ? "not-allowed" : "pointer",
            opacity: !device || isRecognizing ? 0.5 : 1,
          }}
        >
          Start Recognition
        </button>
        <button
          onClick={stopRecognition}
          disabled={!isRecognizing}
          style={{
            padding: "10px 20px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: !isRecognizing ? "not-allowed" : "pointer",
            opacity: !isRecognizing ? 0.5 : 1,
          }}
        >
          Stop Recognition
        </button>
        <button
          onClick={clearTranscripts}
          style={{
            padding: "10px 20px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Clear Transcripts
        </button>
      </div>

      {/* Interim Text */}
      {interimText && (
        <div
          style={{
            padding: "10px",
            marginBottom: "10px",
            backgroundColor: "#fff3cd",
            border: "1px solid #ffeaa7",
            borderRadius: "4px",
            fontStyle: "italic",
            color: "#856404",
          }}
        >
          <strong>Recognizing:</strong> {interimText}
        </div>
      )}

      {/* Transcripts */}
      <div
        style={{
          border: "1px solid #dee2e6",
          borderRadius: "4px",
          padding: "15px",
          maxHeight: "400px",
          overflowY: "auto",
          backgroundColor: "#ffffff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Transcripts</h3>
        {transcripts.length === 0 ? (
          <p style={{ color: "#6c757d", fontStyle: "italic" }}>
            No transcripts yet. Start recognition to see results.
          </p>
        ) : (
          <div>
            {transcripts.map((transcript, index) => (
              <div
                key={index}
                style={{
                  padding: "10px",
                  marginBottom: "10px",
                  backgroundColor: "#f8f9fa",
                  borderLeft: "3px solid #007bff",
                  borderRadius: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.9em",
                    color: "#6c757d",
                    marginBottom: "5px",
                  }}
                >
                  {new Date(transcript.timestamp).toLocaleTimeString()} •
                  Confidence: {(transcript.confidence * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: "1.1em" }}>{transcript.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#d1ecf1",
          border: "1px solid #bee5eb",
          borderRadius: "4px",
          color: "#0c5460",
        }}
      >
        <strong>ℹ️ Note:</strong> Web Speech API requires an active internet
        connection. Speech is sent to cloud services for processing.
        <br />
        <br />
        Best results with:
        <ul style={{ margin: "5px 0" }}>
          <li>Clear speech broadcasts (talk radio, news)</li>
          <li>Strong signal quality from SDR</li>
          <li>Appropriate language selection</li>
          <li>FM modulation for voice channels</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Simplified hook for speech recognition integration
 *
 * Usage in Visualizer.tsx:
 *
 * ```typescript
 * import { useSpeechRecognition } from './examples/speechRecognitionIntegration';
 *
 * function Visualizer() {
 *   const { device } = useHackRFDevice();
 *   const [listening, setListening] = useState(false);
 *   const [signalType, setSignalType] = useState<SignalType>("FM");
 *
 *   const {
 *     transcripts,
 *     isRecognizing,
 *     error,
 *     startRecognition,
 *     stopRecognition,
 *   } = useSpeechRecognition(device, signalType, listening);
 *
 *   return (
 *     <div>
 *       <button onClick={startRecognition}>Start Transcription</button>
 *       <div>{transcripts.map(t => <p>{t.text}</p>)}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSpeechRecognition(
  device: ReturnType<typeof useHackRFDevice>["device"],
  signalType: SignalType,
  enabled: boolean,
  lang = "en-US",
) {
  const [transcripts, setTranscripts] = useState<SpeechRecognitionTranscript[]>(
    [],
  );
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [audioProcessor] = useState(() => new AudioStreamProcessor(20000000));
  const [recognizer] = useState(() => new SpeechRecognitionProcessor({ lang }));

  useEffect(() => {
    // Set up callbacks
    recognizer.onTranscript = (transcript) => {
      if (transcript.isFinal) {
        setTranscripts((prev) => [...prev.slice(-20), transcript]);
      }
    };

    recognizer.onError = (err) => {
      setError(err.message);
      setIsRecognizing(false);
    };

    recognizer.onStart = () => {
      setIsRecognizing(true);
      setError(null);
    };

    recognizer.onEnd = () => {
      setIsRecognizing(false);
    };

    return () => {
      recognizer.cleanup();
      audioProcessor.cleanup();
    };
  }, [recognizer, audioProcessor]);

  const startRecognition = useCallback(async () => {
    if (!device || !enabled) {
      return;
    }

    try {
      await recognizer.start();

      const demodType =
        signalType === "FM"
          ? DemodulationType.FM
          : signalType === "AM"
            ? DemodulationType.AM
            : DemodulationType.NONE;

      await device.receive(async (dataView: DataView) => {
        const iqSamples: IQSample[] = [];
        for (let i = 0; i < dataView.byteLength; i += 2) {
          iqSamples.push({
            I: dataView.getInt8(i) / 128.0,
            Q: dataView.getInt8(i + 1) / 128.0,
          });
        }

        const audio = await audioProcessor.extractAudio(iqSamples, demodType, {
          sampleRate: 48000,
          enableDeEmphasis: signalType === "FM",
        });

        await recognizer.processAudio(audio);
      });
    } catch (err) {
      setError(
        `Failed to start: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [device, enabled, signalType, recognizer, audioProcessor]);

  const stopRecognition = useCallback(async () => {
    if (!device) {
      return;
    }

    await device.stopRx();
    await recognizer.stop();
  }, [device, recognizer]);

  return {
    transcripts,
    isRecognizing,
    error,
    startRecognition,
    stopRecognition,
    clearTranscripts: () => setTranscripts([]),
  };
}
