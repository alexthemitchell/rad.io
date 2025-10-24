import { useEffect, useState, useCallback, useRef } from "react";
import AudioControls from "../components/AudioControls";
import BandwidthSelector from "../components/BandwidthSelector";
import Card from "../components/Card";
import DeviceControlBar from "../components/DeviceControlBar";
import FrequencyScanner from "../components/FrequencyScanner";
import InteractiveDSPPipeline from "../components/InteractiveDSPPipeline";
import P25SystemPresets from "../components/P25SystemPresets";
import PresetStations from "../components/PresetStations";
import SignalTypeSelector, {
  SignalType,
} from "../components/SignalTypeSelector";
import RadioControls from "../components/RadioControls";
import TalkgroupScanner, {
  type Talkgroup,
} from "../components/TalkgroupScanner";
import TalkgroupStatus from "../components/TalkgroupStatus";
import TrunkedRadioControls from "../components/TrunkedRadioControls";
import SampleChart from "../components/SampleChart";
import FFTChart from "../components/FFTChart";
import WaveformChart from "../components/WaveformChart";
import SignalStrengthMeterChart from "../components/SignalStrengthMeterChart";
import PerformanceMetrics from "../components/PerformanceMetrics";
import RecordingControls, {
  type RecordingState,
} from "../components/RecordingControls";
import RDSDisplay from "../components/RDSDisplay";
import { useFrequencyScanner } from "../hooks/useFrequencyScanner";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import { type ISDRDevice, type IQSample } from "../models/SDRDevice";
import {
  AudioStreamProcessor,
  DemodulationType,
  type AudioStreamResult,
} from "../utils/audioStream";
import { type Sample } from "../utils/dsp";
import {
  IQRecorder,
  IQPlayback,
  downloadRecording,
  type IQRecording,
} from "../utils/iqRecorder";
import { performanceMonitor } from "../utils/performanceMonitor";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";
import "../styles/main.css";

const MAX_BUFFER_SAMPLES = 32768;
const UPDATE_INTERVAL_MS = 33; // Target 30 FPS (1000ms / 30fps ≈ 33ms)

function Visualizer(): React.JSX.Element {
  const {
    device,
    initialize,
    cleanup: _cleanup,
    isCheckingPaired,
  } = useHackRFDevice();
  const [listening, setListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const [frequency, setFrequency] = useState(100.3e6);
  const [bandwidth, setBandwidth] = useState(20e6); // Default 20 MHz bandwidth
  const [samples, setSamples] = useState<Sample[]>([]);
  const [latestSamples, setLatestSamples] = useState<Sample[]>([]);
  const [currentFPS, setCurrentFPS] = useState<number>(0);
  const [deviceError, setDeviceError] = useState<Error | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [spectrogramMode, setSpectrogramMode] = useState<
    "spectrogram" | "waterfall"
  >("spectrogram");

  // Frequency scanner hook
  const scanner = useFrequencyScanner(device);

  // Audio playback state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // RDS state
  const [rdsData, setRdsData] = useState<RDSStationData | null>(null);
  const [rdsStats, setRdsStats] = useState<RDSDecoderStats | null>(null);

  const sampleBufferRef = useRef<Sample[]>([]);
  const latestChunkRef = useRef<Sample[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsLastUpdateRef = useRef<number>(0);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const shouldStartOnConnectRef = useRef(false);

  // Audio processing refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<AudioStreamProcessor | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioSampleBufferRef = useRef<Sample[]>([]);
  // Accumulate ~64ms of RF at 2.048 MSPS (~131,072 IQ samples) before audio extraction
  const AUDIO_BUFFER_SIZE = 131072;

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const iqRecorderRef = useRef<IQRecorder | null>(null);
  const iqPlaybackRef = useRef<IQPlayback | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingSampleCount, setRecordingSampleCount] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false);
  const playbackIntervalRef = useRef<number | null>(null);

  // Initialize audio context and processor
  useEffect(() => {
    const initialVolume = audioVolume;
    audioContextRef.current = new AudioContext();
    gainNodeRef.current = audioContextRef.current.createGain();
    gainNodeRef.current.connect(audioContextRef.current.destination);
    gainNodeRef.current.gain.value = initialVolume;

    // Create processor with SDR sample rate tuned for real-time audio (2.048 MSPS)
    audioProcessorRef.current = new AudioStreamProcessor(2048000);

    return (): void => {
      audioProcessorRef.current?.cleanup();
      audioContextRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isAudioMuted ? 0 : audioVolume;
    }
  }, [audioVolume, isAudioMuted]);

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
        return DemodulationType.FM;
    }
  }, []);

  // Play audio buffer
  const playAudioBuffer = useCallback(
    (result: AudioStreamResult) => {
      const audioContext = audioContextRef.current;
      const gainNode = gainNodeRef.current;

      if (!audioContext || !gainNode || !isAudioPlaying) {
        return;
      }

      try {
        // IMPORTANT: Create AudioBuffer in the SAME AudioContext used for playback
        // Some browsers disallow playing buffers created by a different context
        const buffer = audioContext.createBuffer(
          result.channels,
          result.audioData.length,
          result.sampleRate,
        );
        for (let ch = 0; ch < result.channels; ch++) {
          const channelData = buffer.getChannelData(ch);
          channelData.set(result.audioData);
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);
        source.start();
      } catch (error) {
        console.error("Visualizer: Audio playback failed", error, {
          audioContextState: audioContext?.state,
          resultChannels: result.channels,
          resultSampleRate: result.sampleRate,
          resultDataLength: result.audioData.length,
          isAudioEnabled: isAudioPlaying,
        });
      }
    },
    [isAudioPlaying],
  );

  // Process audio from sample chunks
  const processAudioChunk = useCallback(
    async (chunk: Sample[]): Promise<void> => {
      if (!isAudioPlaying || !audioProcessorRef.current) {
        return;
      }

      // Add to audio buffer
      audioSampleBufferRef.current = audioSampleBufferRef.current.concat(chunk);

      // Process when we have enough samples
      if (audioSampleBufferRef.current.length >= AUDIO_BUFFER_SIZE) {
        const samplesToProcess = audioSampleBufferRef.current.slice(
          0,
          AUDIO_BUFFER_SIZE,
        );
        audioSampleBufferRef.current =
          audioSampleBufferRef.current.slice(AUDIO_BUFFER_SIZE);

        try {
          const demodType = getDemodType(signalType);
          const result = await audioProcessorRef.current.extractAudio(
            samplesToProcess,
            demodType,
            {
              sampleRate: 48000, // CD quality audio
              channels: 1, // Mono output
              enableDeEmphasis: signalType === "FM", // De-emphasis for FM only
              enableRDS: signalType === "FM", // Enable RDS decoding for FM
            },
          );

          playAudioBuffer(result);

          // Update RDS data if available
          if (result.rdsData) {
            setRdsData(result.rdsData);
          }
          if (result.rdsStats) {
            setRdsStats(result.rdsStats);
          }
        } catch (error) {
          console.error("Audio processing error:", error);
        }
      }
    },
    [
      isAudioPlaying,
      signalType,
      getDemodType,
      playAudioBuffer,
      AUDIO_BUFFER_SIZE,
    ],
  );

  // Audio control handlers
  const handleToggleAudio = useCallback(() => {
    setIsAudioPlaying((prev) => {
      const newState = !prev;
      if (newState) {
        // Ensure AudioContext is running after a user gesture
        try {
          void audioContextRef.current?.resume();
        } catch (e) {
          console.error("Failed to resume AudioContext:", e);
        }
      } else {
        // Clear audio buffer when stopping
        audioSampleBufferRef.current = [];
        audioProcessorRef.current?.reset();
      }
      setLiveRegionMessage(
        newState ? "Audio playback started" : "Audio playback stopped",
      );
      return newState;
    });
  }, []);

  const handleVolumeChange = useCallback((volume: number) => {
    setAudioVolume(volume);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsAudioMuted((prev) => {
      const newState = !prev;
      setLiveRegionMessage(newState ? "Audio muted" : "Audio unmuted");
      return newState;
    });
  }, []);

  // Device reset handler
  const handleResetDevice = useCallback(async () => {
    if (!device || isResetting) {
      return;
    }

    setIsResetting(true);
    setLiveRegionMessage("Resetting device...");

    try {
      console.warn("Visualizer: Attempting software reset");
      await device.reset();
      setDeviceError(null);
      setLiveRegionMessage(
        "Device reset successful. You can try starting reception again.",
      );
      console.warn("Visualizer: Reset successful");
    } catch (error) {
      console.error("Visualizer: Reset failed:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDeviceError(new Error(`Reset failed: ${errorMsg}`));
      setLiveRegionMessage(
        "Device reset failed. Please try unplugging and replugging the device.",
      );
    } finally {
      setIsResetting(false);
    }
  }, [device, isResetting]);

  // Debug: log when an error occurs that should expose reset UI
  useEffect(() => {
    if (deviceError && deviceError.message.includes("Device not responding")) {
      console.warn(
        "Visualizer: deviceError requires reset UI; handler present?",
        typeof handleResetDevice === "function",
        "isResetting:",
        isResetting,
      );
    }
  }, [deviceError, handleResetDevice, isResetting]);

  // Recording stop handler (defined early because it's used in handleSampleChunk)
  const handleStopRecording = useCallback(() => {
    if (!iqRecorderRef.current || recordingState !== "recording") {
      return;
    }

    iqRecorderRef.current.stop();
    const recording = iqRecorderRef.current.getRecording();
    setRecordingState("idle");
    setRecordingDuration(recording.metadata.duration);
    setRecordingSampleCount(recording.metadata.sampleCount);
    setLiveRegionMessage(
      `Recording stopped. ${recording.metadata.sampleCount} samples captured`,
    );
  }, [recordingState]);

  const cancelScheduledUpdate = useCallback((): void => {
    if (
      typeof cancelAnimationFrame === "function" &&
      rafIdRef.current !== null
    ) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const clearVisualizationState = useCallback((): void => {
    sampleBufferRef.current = [];
    latestChunkRef.current = [];
    lastUpdateRef.current = 0;
    frameCountRef.current = 0;
    fpsLastUpdateRef.current = 0;
    cancelScheduledUpdate();
    setSamples([]);
    setLatestSamples([]);
    setCurrentFPS(0);
  }, [cancelScheduledUpdate]);

  const scheduleVisualizationUpdate = useCallback((): void => {
    if (typeof requestAnimationFrame !== "function") {
      setSamples([...sampleBufferRef.current]);
      setLatestSamples([...latestChunkRef.current]);
      return;
    }

    if (rafIdRef.current !== null) {
      return;
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setSamples([...sampleBufferRef.current]);
      setLatestSamples([...latestChunkRef.current]);

      // Track FPS
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - fpsLastUpdateRef.current;

      // Update FPS counter every second
      if (elapsed >= 1000) {
        const fps = (frameCountRef.current / elapsed) * 1000;
        setCurrentFPS(Math.round(fps));
        frameCountRef.current = 0;
        fpsLastUpdateRef.current = now;
      }
    });
  }, []);

  const handleSampleChunk = useCallback(
    (chunk: Sample[]): void => {
      if (!chunk || chunk.length === 0) {
        console.warn("Visualizer: Received empty sample chunk", {
          chunkType: typeof chunk,
          isNull: chunk === null,
          isUndefined: chunk === undefined,
        });
        return;
      }

      console.debug("Visualizer: Processing sample chunk", {
        sampleCount: chunk.length,
        firstSample: chunk[0] ? { I: chunk[0].I, Q: chunk[0].Q } : null,
        bufferState: {
          currentSize: sampleBufferRef.current.length,
          maxSize: MAX_BUFFER_SAMPLES,
        },
      });

      const markName = `pipeline-chunk-start-${
        typeof performance !== "undefined" ? performance.now() : Date.now()
      }`;
      performanceMonitor.mark(markName);

      // Record samples if recording is active
      if (iqRecorderRef.current && recordingState === "recording") {
        const iqSamples: IQSample[] = chunk.map((s) => ({
          I: s.I,
          Q: s.Q,
        }));
        const stillRecording = iqRecorderRef.current.addSamples(iqSamples);

        // Update recording stats
        setRecordingSampleCount(iqRecorderRef.current.getSampleCount());
        setRecordingDuration(iqRecorderRef.current.getDuration());

        // Auto-stop if buffer limit reached
        if (!stillRecording) {
          handleStopRecording();
          setLiveRegionMessage("Recording stopped: buffer limit reached");
        }
      }

      const combined = sampleBufferRef.current.length
        ? sampleBufferRef.current.concat(chunk)
        : chunk.slice();
      const trimmed =
        combined.length > MAX_BUFFER_SAMPLES
          ? combined.slice(combined.length - MAX_BUFFER_SAMPLES)
          : combined;
      sampleBufferRef.current = trimmed;
      latestChunkRef.current = chunk.slice();

      // Process audio if enabled
      processAudioChunk(chunk).catch((error) => {
        console.error("Audio processing error:", error);
      });

      // Update frequency scanner with amplitude data
      if (scanner.state === "scanning") {
        const amplitudes = chunk.map((s) => Math.sqrt(s.I * s.I + s.Q * s.Q));
        scanner.updateSamples(amplitudes);
      }

      performanceMonitor.measure("pipeline-processing", markName);

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
        lastUpdateRef.current = now;
        console.debug("Visualizer: Scheduling visualization update", {
          timeSinceLastUpdate: (now - lastUpdateRef.current).toFixed(2),
          bufferSize: sampleBufferRef.current.length,
        });
        scheduleVisualizationUpdate();
      }
    },
    [
      scheduleVisualizationUpdate,
      processAudioChunk,
      scanner,
      recordingState,
      handleStopRecording,
    ],
  );

  const beginDeviceStreaming = useCallback(
    async (activeDevice: ISDRDevice): Promise<void> => {
      clearVisualizationState();
      setListening(true);
      setDeviceError(null); // Clear previous errors
      setLiveRegionMessage("Started receiving radio signals");

      // Ensure device is configured with sample rate before starting
      console.warn("Visualizer: Configuring device for streaming", {
        targetSampleRate: 2048000,
        capabilities: activeDevice.getCapabilities(),
      });
      try {
        await activeDevice.setSampleRate(2048000); // 2.048 MSPS for real-time audio
        console.warn("Visualizer: Device configured successfully", {
          sampleRate: 2048000,
          readyToStream: true,
        });
      } catch (err) {
        console.error(
          "Visualizer: Failed to configure device sample rate",
          err,
          {
            requestedSampleRate: 2048000,
            supportedRates: activeDevice.getCapabilities().supportedSampleRates,
          },
        );
        const error = err instanceof Error ? err : new Error(String(err));
        setDeviceError(error);
      }

      const receivePromise = activeDevice
        .receive((data) => {
          console.debug("Visualizer: Received raw data from device", {
            byteLength: data?.byteLength || 0,
            hasData: Boolean(data),
          });
          const parsed = activeDevice.parseSamples(data) as Sample[];
          console.debug("Visualizer: Parsed samples from raw data", {
            sampleCount: parsed?.length || 0,
            bytesPerSample:
              data?.byteLength && parsed?.length
                ? (data.byteLength / parsed.length).toFixed(2)
                : "N/A",
          });
          handleSampleChunk(parsed);
        })
        .catch((err) => {
          console.error("Visualizer: Device streaming failed", err, {
            errorType: err instanceof Error ? err.name : typeof err,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          const error = err instanceof Error ? err : new Error(String(err));
          setDeviceError(error);
          setLiveRegionMessage("Failed to receive radio signals");
          throw err;
        })
        .finally(() => {
          setListening(false);
        });

      receivePromiseRef.current = receivePromise;

      try {
        await receivePromise;
      } catch {
        // Error already handled in catch above
      } finally {
        receivePromiseRef.current = null;
      }
    },
    [clearVisualizationState, handleSampleChunk],
  );

  // Recording handlers (continued - handleStopRecording defined earlier)
  const handleStartRecording = useCallback(() => {
    if (!device || recordingState !== "idle") {
      return;
    }

    // Create recorder with current parameters
    iqRecorderRef.current = new IQRecorder(
      2048000, // Sample rate
      frequency,
      10_000_000, // Max 10M samples (~5 seconds at 2 MSPS)
      signalType,
      "HackRF One",
    );

    iqRecorderRef.current.start();
    setRecordingState("recording");
    setRecordingDuration(0);
    setRecordingSampleCount(0);
    setLiveRegionMessage("Recording started");
  }, [device, recordingState, frequency, signalType]);

  const handleSaveRecording = useCallback(
    (filename: string, format: "binary" | "json") => {
      if (!iqRecorderRef.current) {
        return;
      }

      const recording = iqRecorderRef.current.getRecording();
      downloadRecording(recording, filename, format);
      setLiveRegionMessage(`Recording saved as ${filename}`);
    },
    [],
  );

  const handleLoadRecording = useCallback(
    (recording: IQRecording) => {
      // Stop any active streaming
      if (listening && device) {
        void device.stopRx();
        setListening(false);
      }

      // Stop any existing playback
      if (iqPlaybackRef.current) {
        iqPlaybackRef.current.cleanup();
        iqPlaybackRef.current = null;
      }

      // Update frequency and signal type from recording metadata
      setFrequency(recording.metadata.frequency);
      if (recording.metadata.signalType) {
        setSignalType(recording.metadata.signalType as SignalType);
      }

      // Create playback controller
      iqPlaybackRef.current = new IQPlayback(
        recording,
        (chunk: IQSample[]) => {
          // Convert IQSample to Sample format
          const samples: Sample[] = chunk.map((s) => ({
            I: s.I,
            Q: s.Q,
          }));
          handleSampleChunk(samples);
        },
        32768, // Samples per chunk
      );

      setRecordingState("playback");
      setRecordingDuration(recording.metadata.duration);
      setRecordingSampleCount(recording.metadata.sampleCount);
      setPlaybackProgress(0);
      setPlaybackTime(0);
      setIsPlaybackPlaying(false);
      setLiveRegionMessage(
        `Recording loaded: ${recording.metadata.sampleCount} samples`,
      );
    },
    [listening, device, handleSampleChunk],
  );

  const handleStartPlayback = useCallback(() => {
    if (!iqPlaybackRef.current || recordingState !== "playback") {
      return;
    }

    iqPlaybackRef.current.start();
    setIsPlaybackPlaying(true);

    // Update playback progress every 100ms
    playbackIntervalRef.current = window.setInterval(() => {
      if (iqPlaybackRef.current) {
        setPlaybackProgress(iqPlaybackRef.current.getProgress());
        setPlaybackTime(iqPlaybackRef.current.getCurrentTime());

        if (
          !iqPlaybackRef.current.getIsPlaying() &&
          iqPlaybackRef.current.getProgress() >= 1
        ) {
          // Playback complete
          setIsPlaybackPlaying(false);
          if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
          }
        }
      }
    }, 100);

    setLiveRegionMessage("Playback started");
  }, [recordingState]);

  const handlePausePlayback = useCallback(() => {
    if (!iqPlaybackRef.current || recordingState !== "playback") {
      return;
    }

    iqPlaybackRef.current.pause();
    setIsPlaybackPlaying(false);

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    setLiveRegionMessage("Playback paused");
  }, [recordingState]);

  const handleStopPlayback = useCallback(() => {
    if (!iqPlaybackRef.current) {
      return;
    }

    iqPlaybackRef.current.stop();
    setIsPlaybackPlaying(false);

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    // Clean up playback and return to idle
    iqPlaybackRef.current.cleanup();
    iqPlaybackRef.current = null;
    setRecordingState("idle");
    clearVisualizationState();
    setLiveRegionMessage("Stopped playback, returned to live mode");
  }, [clearVisualizationState]);

  const handleSeekPlayback = useCallback(
    (position: number) => {
      if (!iqPlaybackRef.current || recordingState !== "playback") {
        return;
      }

      iqPlaybackRef.current.seek(position);
      setPlaybackProgress(position);
      setPlaybackTime(iqPlaybackRef.current.getCurrentTime());
    },
    [recordingState],
  );

  // Live region for screen reader announcements
  const [liveRegionMessage, setLiveRegionMessage] = useState("");

  // P25 Trunked Radio State
  const [controlChannel, setControlChannel] = useState(770.95625e6);
  const [nac, setNac] = useState("$293");
  const [systemId, setSystemId] = useState("$001");
  const [wacn, setWacn] = useState("$BEE00");
  const [talkgroups, setTalkgroups] = useState<Talkgroup[]>([
    {
      id: "101",
      name: "Fire Dispatch",
      category: "Fire",
      priority: 9,
      enabled: true,
    },
    {
      id: "201",
      name: "Police Dispatch",
      category: "Police",
      priority: 9,
      enabled: true,
    },
    {
      id: "301",
      name: "EMS Main",
      category: "EMS",
      priority: 8,
      enabled: true,
    },
    {
      id: "102",
      name: "Fire Tactical",
      category: "Fire",
      priority: 7,
      enabled: false,
    },
  ]);
  const [currentTalkgroup, _setCurrentTalkgroup] = useState<string | null>(
    null,
  );
  const [currentTalkgroupName, _setCurrentTalkgroupName] = useState<
    string | null
  >(null);
  const [signalPhase, _setSignalPhase] = useState<"Phase 1" | "Phase 2" | null>(
    null,
  );
  const [tdmaSlot, _setTdmaSlot] = useState<number | null>(null);
  const [signalStrength, _setSignalStrength] = useState(0);
  const [isEncrypted, _setIsEncrypted] = useState(false);

  const handleSetFrequency = async (newFrequency: number): Promise<void> => {
    setFrequency(newFrequency);
    if (device) {
      await device.setFrequency(newFrequency);
      // Announce frequency change to screen readers
      const displayFreq =
        signalType === "FM"
          ? `${(newFrequency / 1e6).toFixed(1)} MHz`
          : `${(newFrequency / 1e3).toFixed(0)} kHz`;
      setLiveRegionMessage(`Frequency changed to ${displayFreq}`);
    }
  };

  const handleSetBandwidth = async (newBandwidth: number): Promise<void> => {
    setBandwidth(newBandwidth);
    if (device?.setBandwidth) {
      await device.setBandwidth(newBandwidth);
      setLiveRegionMessage(`Bandwidth filter set to ${newBandwidth / 1e6} MHz`);
    }
  };

  const handleSignalTypeChange = (type: SignalType): void => {
    setSignalType(type);
    setLiveRegionMessage(`Signal type changed to ${type}`);

    // Clear RDS data when switching away from FM
    if (type !== "FM") {
      setRdsData(null);
      setRdsStats(null);
    }

    // Set default frequency for each type
    if (type === "FM" && frequency < 88.1e6) {
      handleSetFrequency(100.3e6).catch(console.error);
    } else if (type === "AM" && frequency > 1.7e6) {
      handleSetFrequency(1010e3).catch(console.error);
    } else if (type === "P25") {
      handleSetFrequency(controlChannel).catch(console.error);
    }
  };

  const handleP25SystemSelect = (system: {
    controlChannel: number;
    nac: string;
    systemId: string;
    wacn: string;
  }): void => {
    setControlChannel(system.controlChannel);
    setNac(system.nac);
    setSystemId(system.systemId);
    setWacn(system.wacn);
    if (signalType === "P25") {
      handleSetFrequency(system.controlChannel).catch(console.error);
    }
  };

  const handleTalkgroupToggle = (id: string): void => {
    setTalkgroups((prev) =>
      prev.map((tg) => (tg.id === id ? { ...tg, enabled: !tg.enabled } : tg)),
    );
  };

  const handleAddTalkgroup = (
    newTalkgroup: Omit<Talkgroup, "enabled">,
  ): void => {
    setTalkgroups((prev) => [...prev, { ...newTalkgroup, enabled: true }]);
  };

  useEffect((): void => {
    if (!device) {
      return;
    }
    // Configure device when it becomes available
    const configureDevice = async (): Promise<void> => {
      // Set sample rate first (required for HackRF to stream data)
      await device.setSampleRate(2048000); // 2.048 MSPS for real-time audio
      await device.setFrequency(frequency);
      if (device.setBandwidth) {
        await device.setBandwidth(bandwidth);
      }
      await device.setAmpEnable(false);
    };
    configureDevice().catch(console.error);
  }, [device, frequency, bandwidth]);

  useEffect((): (() => void) => {
    return () => {
      cancelScheduledUpdate();
    };
  }, [cancelScheduledUpdate]);

  useEffect((): void => {
    if (!device || !shouldStartOnConnectRef.current) {
      return;
    }
    shouldStartOnConnectRef.current = false;
    void beginDeviceStreaming(device);
  }, [device, beginDeviceStreaming]);

  const startListening = useCallback(async (): Promise<void> => {
    if (listening) {
      return;
    }

    if (!device) {
      if (isInitializing) {
        return;
      }
      shouldStartOnConnectRef.current = true;
      setIsInitializing(true);
      setLiveRegionMessage("Connecting to SDR device...");
      try {
        await initialize();
        setLiveRegionMessage("SDR device connected");
      } catch (err) {
        console.error(err);
        shouldStartOnConnectRef.current = false;
        setLiveRegionMessage(
          "Failed to connect to device. Please check device connection and browser permissions.",
        );
      } finally {
        setIsInitializing(false);
      }
      return;
    }

    shouldStartOnConnectRef.current = false;
    void beginDeviceStreaming(device);
  }, [beginDeviceStreaming, device, initialize, isInitializing, listening]);

  const stopListening = useCallback(async (): Promise<void> => {
    if (device?.isReceiving()) {
      try {
        await device.stopRx();
      } catch (err) {
        console.error(err);
      }
    }

    if (receivePromiseRef.current) {
      try {
        await receivePromiseRef.current;
      } catch {
        // Errors already handled in beginDeviceStreaming
      }
      receivePromiseRef.current = null;
    }

    cancelScheduledUpdate();
    setListening(false);
    setLiveRegionMessage("Stopped receiving radio signals");
  }, [cancelScheduledUpdate, device]);

  return (
    <div className="container">
      {/* Skip link for keyboard navigation */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
      >
        {liveRegionMessage}
      </div>

      <header className="header" role="banner">
        <h1>rad.io</h1>
        <p>Software-Defined Radio Visualizer - Auto-Connect Enabled</p>
      </header>

      <main id="main-content" role="main">
        <DeviceControlBar
          device={device}
          listening={listening}
          isInitializing={isInitializing}
          isCheckingPaired={isCheckingPaired}
          deviceError={deviceError}
          frequency={frequency}
          onConnect={initialize}
          onStartReception={startListening}
          onStopReception={stopListening}
          onResetDevice={handleResetDevice}
          isResetting={isResetting}
        />

        <Card title="Radio Controls" subtitle="Configure your SDR receiver">
          <div className="controls-panel">
            <SignalTypeSelector
              signalType={signalType}
              onSignalTypeChange={handleSignalTypeChange}
            />
            {signalType !== "P25" ? (
              <>
                <RadioControls
                  frequency={frequency}
                  signalType={signalType}
                  setFrequency={handleSetFrequency}
                />
                {device?.getCapabilities().supportedBandwidths ? (
                  <BandwidthSelector
                    bandwidth={bandwidth}
                    setBandwidth={handleSetBandwidth}
                    supportedBandwidths={
                      device.getCapabilities().supportedBandwidths
                    }
                  />
                ) : null}
              </>
            ) : null}
          </div>
          {signalType === "P25" ? (
            <>
              <TrunkedRadioControls
                controlChannel={controlChannel}
                nac={nac}
                systemId={systemId}
                wacn={wacn}
                onControlChannelChange={(freq) => {
                  setControlChannel(freq);
                  handleSetFrequency(freq).catch(console.error);
                }}
                onNacChange={setNac}
                onSystemIdChange={setSystemId}
                onWacnChange={setWacn}
              />
              <P25SystemPresets
                currentControlChannel={controlChannel}
                onSystemSelect={handleP25SystemSelect}
              />
            </>
          ) : (
            <PresetStations
              signalType={signalType}
              currentFrequency={frequency}
              onStationSelect={handleSetFrequency}
            />
          )}
        </Card>

        <Card
          title="Audio Playback"
          subtitle="Real-time audio demodulation and output"
        >
          <AudioControls
            isPlaying={isAudioPlaying}
            volume={audioVolume}
            isMuted={isAudioMuted}
            signalType={signalType}
            isAvailable={listening}
            onTogglePlay={handleToggleAudio}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
          />
        </Card>

        {signalType === "FM" && isAudioPlaying && (
          <Card
            title="RDS - Radio Data System"
            subtitle="Real-time FM station information and metadata"
            collapsible={true}
            defaultExpanded={true}
          >
            <RDSDisplay rdsData={rdsData} stats={rdsStats} />
          </Card>
        )}

        <RecordingControls
          recordingState={recordingState}
          canRecord={
            device !== undefined &&
            device.isOpen() &&
            listening &&
            recordingState === "idle"
          }
          canPlayback={recordingState === "playback"}
          isPlaying={isPlaybackPlaying}
          duration={recordingDuration}
          playbackProgress={playbackProgress}
          playbackTime={playbackTime}
          sampleCount={recordingSampleCount}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onSaveRecording={handleSaveRecording}
          onLoadRecording={handleLoadRecording}
          onStartPlayback={handleStartPlayback}
          onPausePlayback={handlePausePlayback}
          onStopPlayback={handleStopPlayback}
          onSeek={handleSeekPlayback}
        />

        {signalType !== "P25" && (
          <FrequencyScanner
            state={scanner.state}
            config={scanner.config}
            currentFrequency={scanner.currentFrequency}
            activeSignals={scanner.activeSignals}
            progress={scanner.progress}
            onStartScan={scanner.startScan}
            onPauseScan={scanner.pauseScan}
            onResumeScan={scanner.resumeScan}
            onStopScan={scanner.stopScan}
            onConfigChange={scanner.updateConfig}
            onClearSignals={scanner.clearSignals}
            deviceAvailable={device !== undefined && device.isOpen()}
          />
        )}

        {signalType === "P25" && (
          <>
            <Card
              title="Talkgroup Status"
              subtitle="Current P25 trunked radio activity"
            >
              <TalkgroupStatus
                currentTalkgroup={currentTalkgroup}
                currentTalkgroupName={currentTalkgroupName}
                signalPhase={signalPhase}
                tdmaSlot={tdmaSlot}
                signalStrength={signalStrength}
                isEncrypted={isEncrypted}
              />
            </Card>

            <Card
              title="Talkgroup Scanner"
              subtitle="Configure and monitor P25 talkgroups"
            >
              <TalkgroupScanner
                talkgroups={talkgroups}
                onTalkgroupToggle={handleTalkgroupToggle}
                onAddTalkgroup={handleAddTalkgroup}
              />
            </Card>
          </>
        )}

        <InteractiveDSPPipeline device={device} samples={samples} />

        <Card
          title="Signal Strength Meter"
          subtitle="Real-time signal level monitoring for antenna alignment and quality assessment"
        >
          <SignalStrengthMeterChart samples={latestSamples} />
        </Card>

        <PerformanceMetrics currentFPS={currentFPS} />

        <div
          className="visualizations"
          role="region"
          aria-label="Signal visualizations"
        >
          <Card
            title="IQ Constellation Diagram"
            subtitle="Visual representation of the I (in-phase) and Q (quadrature) components"
            collapsible={true}
            defaultExpanded={true}
          >
            <SampleChart samples={samples} />
          </Card>

          <Card
            title="Amplitude Waveform"
            subtitle="Time-domain signal amplitude envelope"
          >
            <WaveformChart samples={samples} />
          </Card>

          <div style={{ position: "relative" }}>
            <Card
              title={
                spectrogramMode === "waterfall"
                  ? "Waterfall Display"
                  : "Spectrogram"
              }
              subtitle={
                spectrogramMode === "waterfall"
                  ? "Scrolling frequency spectrum over time"
                  : "Frequency spectrum over time showing signal strength"
              }
            >
              <div style={{ position: "relative" }}>
                <button
                  onClick={() =>
                    setSpectrogramMode((prev) =>
                      prev === "spectrogram" ? "waterfall" : "spectrogram",
                    )
                  }
                  className="btn"
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    zIndex: 10,
                  }}
                  aria-label={`Switch to ${spectrogramMode === "waterfall" ? "spectrogram" : "waterfall"} mode`}
                >
                  {spectrogramMode === "waterfall"
                    ? "📊 Static"
                    : "💧 Waterfall"}
                </button>
                <FFTChart samples={samples} mode={spectrogramMode} />
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Visualizer;
