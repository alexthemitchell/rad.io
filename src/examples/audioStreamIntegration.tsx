/**
 * Audio Stream Integration Example
 *
 * This file demonstrates how to integrate the Audio Stream Extraction API
 * with the existing rad.io visualizer components for real-time audio playback.
 *
 * To use this in your application:
 * 1. Import the necessary components
 * 2. Create an AudioStreamProcessor instance
 * 3. Connect it to your SDR device receive callback
 * 4. Play the extracted audio through Web Audio API
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

/**
 * Example component showing audio stream integration
 */
export function AudioStreamExample() {
  const { device } = useHackRFDevice();
  const [isPlaying, setIsPlaying] = useState(false);
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const [volume, setVolume] = useState(0.5);

  // Audio processing state
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioStreamProcessor | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize audio context and processor
  useEffect(() => {
    audioContextRef.current = new AudioContext();
    gainNodeRef.current = audioContextRef.current.createGain();
    gainNodeRef.current.connect(audioContextRef.current.destination);

    // Create processor with SDR sample rate (20 MHz for HackRF)
    processorRef.current = new AudioStreamProcessor(20000000);

    return () => {
      processorRef.current?.cleanup();
      audioContextRef.current?.close();
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

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

  // Play audio buffer
  const playAudio = useCallback((result: AudioStreamResult) => {
    const audioContext = audioContextRef.current;
    const gainNode = gainNodeRef.current;

    if (!audioContext || !gainNode) {
      return;
    }

    try {
      // Create buffer source
      const source = audioContext.createBufferSource();
      source.buffer = result.audioBuffer;

      // Connect through gain node for volume control
      source.connect(gainNode);

      // Start playback
      source.start();
    } catch (error) {
      console.error("Audio playback error:", error);
    }
  }, []);

  // Start audio streaming
  const startAudio = useCallback(async () => {
    if (!device || !processorRef.current) {
      console.error("Device or processor not ready");
      return;
    }

    const processor = processorRef.current;
    const demodType = getDemodType(signalType);

    setIsPlaying(true);

    try {
      // Start receiving IQ samples from device
      await device.receive(async (dataView) => {
        // Parse IQ samples using device's parseSamples method
        // Note: This example assumes device has parseSamples.
        // For HackRFOne, use HackRFOneAdapter which implements ISDRDevice interface
        const iqSamples: IQSample[] = [];

        // Simple Int8 parsing (HackRF format)
        for (let i = 0; i < dataView.byteLength; i += 2) {
          const I = dataView.getInt8(i) / 128.0;
          const Q = dataView.getInt8(i + 1) / 128.0;
          iqSamples.push({ I, Q });
        }

        // Extract audio using appropriate demodulation
        const result = await processor.extractAudio(iqSamples, demodType, {
          sampleRate: 48000, // CD quality audio
          channels: 1, // Mono output
          enableDeEmphasis: signalType === "FM", // De-emphasis for FM only
        });

        // Play the extracted audio
        playAudio(result);
      });
    } catch (error) {
      console.error("Audio streaming error:", error);
      setIsPlaying(false);
    }
  }, [device, signalType, getDemodType, playAudio]);

  // Stop audio streaming
  const stopAudio = useCallback(async () => {
    if (!device) {
      return;
    }

    await device.stopRx();
    processorRef.current?.reset();
    setIsPlaying(false);
  }, [device]);

  return (
    <div>
      <h2>Audio Stream Output</h2>

      {/* Signal Type Selection */}
      <div>
        <label>Signal Type:</label>
        <select
          value={signalType}
          onChange={(e) => setSignalType(e.target.value as SignalType)}
          disabled={isPlaying}
        >
          <option value="FM">FM</option>
          <option value="AM">AM</option>
          <option value="P25">P25</option>
        </select>
      </div>

      {/* Volume Control */}
      <div>
        <label>Volume:</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
        />
        <span>{Math.round(volume * 100)}%</span>
      </div>

      {/* Playback Controls */}
      <div>
        <button onClick={startAudio} disabled={!device || isPlaying}>
          Start Audio
        </button>
        <button onClick={stopAudio} disabled={!isPlaying}>
          Stop Audio
        </button>
      </div>

      {/* Status */}
      <div>
        <p>
          Status: <strong>{isPlaying ? "Playing" : "Stopped"}</strong>
        </p>
        <p>
          Demodulation: <strong>{getDemodType(signalType)}</strong>
        </p>
      </div>
    </div>
  );
}

/**
 * Simplified integration for existing Visualizer component
 *
 * Add this to your Visualizer.tsx to enable audio output:
 */
export function useAudioStream(
  device: ReturnType<typeof useHackRFDevice>["device"],
  signalType: SignalType,
  enabled: boolean,
) {
  const [processor] = useState(() => new AudioStreamProcessor(20000000));
  const [audioContext] = useState(() => new AudioContext());
  const [gainNode] = useState(() => {
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);
    return gain;
  });

  useEffect(() => {
    if (!enabled || !device) {
      return;
    }

    const demodType =
      signalType === "FM"
        ? DemodulationType.FM
        : signalType === "AM"
          ? DemodulationType.AM
          : DemodulationType.NONE;

    const processAudio = async (dataView: DataView) => {
      // Parse IQ samples from DataView (Int8 format for HackRF)
      const iqSamples: IQSample[] = [];
      for (let i = 0; i < dataView.byteLength; i += 2) {
        const I = dataView.getInt8(i) / 128.0;
        const Q = dataView.getInt8(i + 1) / 128.0;
        iqSamples.push({ I, Q });
      }

      const result = await processor.extractAudio(iqSamples, demodType, {
        sampleRate: 48000,
        channels: 1,
        enableDeEmphasis: signalType === "FM",
      });

      // Play audio
      const source = audioContext.createBufferSource();
      source.buffer = result.audioBuffer;
      source.connect(gainNode);
      source.start();
    };

    device.receive(processAudio).catch(console.error);

    return () => {
      device.stopRx().catch(console.error);
      processor.reset();
    };
  }, [device, signalType, enabled, processor, audioContext, gainNode]);

  return {
    setVolume: (volume: number) => {
      gainNode.gain.value = volume;
    },
    cleanup: async () => {
      await processor.cleanup();
      await audioContext.close();
    },
  };
}

/**
 * Usage in Visualizer.tsx:
 *
 * ```typescript
 * import { useAudioStream } from './examples/audioStreamIntegration';
 *
 * function Visualizer() {
 *   const { device } = useHackRFDevice();
 *   const [listening, setListening] = useState(false);
 *   const [signalType, setSignalType] = useState<SignalType>("FM");
 *   const [audioEnabled, setAudioEnabled] = useState(false);
 *
 *   const { setVolume } = useAudioStream(device, signalType, audioEnabled && listening);
 *
 *   return (
 *     <div>
 *       {/* Existing controls... *\/}
 *
 *       <div>
 *         <label>
 *           <input
 *             type="checkbox"
 *             checked={audioEnabled}
 *             onChange={(e) => setAudioEnabled(e.target.checked)}
 *           />
 *           Enable Audio Output
 *         </label>
 *       </div>
 *
 *       <div>
 *         <label>Volume:</label>
 *         <input
 *           type="range"
 *           min="0"
 *           max="1"
 *           step="0.1"
 *           onChange={(e) => setVolume(parseFloat(e.target.value))}
 *         />
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
