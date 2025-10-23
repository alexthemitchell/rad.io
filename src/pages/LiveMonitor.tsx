import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import { useLiveRegion } from "../hooks/useLiveRegion";
import SignalTypeSelector, {
  type SignalType,
} from "../components/SignalTypeSelector";
import BandwidthSelector from "../components/BandwidthSelector";
import DeviceControlBar from "../components/DeviceControlBar";
import PresetStations from "../components/PresetStations";
import RadioControls from "../components/RadioControls";
import TrunkedRadioControls from "../components/TrunkedRadioControls";
import P25SystemPresets from "../components/P25SystemPresets";
import Card from "../components/Card";
import SampleChart from "../components/SampleChart";
import FFTChart from "../components/FFTChart";
import WaveformChart from "../components/WaveformChart";
import SignalStrengthMeterChart from "../components/SignalStrengthMeterChart";
import AudioControls from "../components/AudioControls";
import type { Sample } from "../utils/dsp";
import { performanceMonitor } from "../utils/performanceMonitor";
import type { ISDRDevice } from "../models/SDRDevice";
import {
  AudioStreamProcessor,
  DemodulationType,
  type AudioStreamResult,
} from "../utils/audioStream";

const MAX_BUFFER_SAMPLES = 32768;
const UPDATE_INTERVAL_MS = 33; // Target 30 FPS
const AUDIO_BUFFER_SIZE = 131072;

function LiveMonitor(): React.JSX.Element {
  const location = useLocation();
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
  const [bandwidth, setBandwidth] = useState(20e6);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [latestSamples, setLatestSamples] = useState<Sample[]>([]);
  const [deviceError, setDeviceError] = useState<Error | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Handle navigation state (e.g., from Scanner)
  useEffect(() => {
    const state = location.state as {
      frequency?: number;
      signalType?: SignalType;
    } | null;
    if (state?.frequency) {
      setFrequency(state.frequency);
      if (state.signalType) {
        setSignalType(state.signalType);
      }
      // Tune to the frequency if device is available
      if (device) {
        device.setFrequency(state.frequency).catch(console.error);
      }
    }
  }, [location.state, device]);

  // Audio playback state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const sampleBufferRef = useRef<Sample[]>([]);
  const latestChunkRef = useRef<Sample[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const shouldStartOnConnectRef = useRef(false);

  // Audio processing refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<AudioStreamProcessor | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioSampleBufferRef = useRef<Sample[]>([]);

  // Live region for screen reader announcements
  const { announce, LiveRegion } = useLiveRegion();

  // P25 state
  const [controlChannel, setControlChannel] = useState(770.95625e6);
  const [nac, setNac] = useState("$293");
  const [systemId, setSystemId] = useState("$001");
  const [wacn, setWacn] = useState("$BEE00");

  // Initialize audio context
  useEffect(() => {
    const initialVolume = audioVolume;
    audioContextRef.current = new AudioContext();
    gainNodeRef.current = audioContextRef.current.createGain();
    gainNodeRef.current.connect(audioContextRef.current.destination);
    gainNodeRef.current.gain.value = initialVolume;
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

  const getDemodType = useCallback((type: SignalType): DemodulationType => {
    switch (type) {
      case "FM":
        return DemodulationType.FM;
      case "AM":
        return DemodulationType.AM;
      case "P25":
        return DemodulationType.FM;
      default:
        return DemodulationType.FM;
    }
  }, []);

  const playAudioBuffer = useCallback(
    (result: AudioStreamResult) => {
      const audioContext = audioContextRef.current;
      const gainNode = gainNodeRef.current;

      if (!audioContext || !gainNode || !isAudioPlaying) {
        return;
      }

      try {
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
        console.error("Audio playback error:", error);
      }
    },
    [isAudioPlaying],
  );

  const processAudioChunk = useCallback(
    async (chunk: Sample[]): Promise<void> => {
      if (!isAudioPlaying || !audioProcessorRef.current) {
        return;
      }

      audioSampleBufferRef.current = audioSampleBufferRef.current.concat(chunk);

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
              sampleRate: 48000,
              channels: 1,
              enableDeEmphasis: signalType === "FM",
            },
          );

          playAudioBuffer(result);
        } catch (error) {
          console.error("Audio processing error:", error);
        }
      }
    },
    [isAudioPlaying, signalType, getDemodType, playAudioBuffer],
  );

  const handleToggleAudio = useCallback(() => {
    setIsAudioPlaying((prev) => {
      const newState = !prev;
      if (newState) {
        try {
          void audioContextRef.current?.resume();
        } catch (e) {
          console.error("Failed to resume AudioContext:", e);
        }
      } else {
        audioSampleBufferRef.current = [];
        audioProcessorRef.current?.reset();
      }
      announce(newState ? "Audio playback started" : "Audio playback stopped");
      return newState;
    });
  }, [announce]);

  const handleVolumeChange = useCallback((volume: number) => {
    setAudioVolume(volume);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsAudioMuted((prev) => {
      const newState = !prev;
      announce(newState ? "Audio muted" : "Audio unmuted");
      return newState;
    });
  }, [announce]);

  // Device reset handler for timeout recovery
  const handleResetDevice = useCallback(async (): Promise<void> => {
    if (!device || isResetting) {
      return;
    }
    setIsResetting(true);
    announce("Resetting device...");
    try {
      await device.reset();
      setDeviceError(null);
      announce(
        "Device reset successful. You can try starting reception again.",
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setDeviceError(new Error(`Reset failed: ${msg}`));
      announce(
        "Device reset failed. Please try unplugging and replugging the device.",
      );
    } finally {
      setIsResetting(false);
    }
  }, [device, isResetting, announce]);

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
    cancelScheduledUpdate();
    setSamples([]);
    setLatestSamples([]);
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
    });
  }, []);

  const handleSampleChunk = useCallback(
    (chunk: Sample[]): void => {
      if (!chunk || chunk.length === 0) {
        console.warn("handleSampleChunk: received empty chunk");
        return;
      }

      console.debug(`handleSampleChunk: received ${chunk.length} samples`);

      const markName = `pipeline-chunk-start-${
        typeof performance !== "undefined" ? performance.now() : Date.now()
      }`;
      performanceMonitor.mark(markName);

      const combined = sampleBufferRef.current.length
        ? sampleBufferRef.current.concat(chunk)
        : chunk.slice();
      const trimmed =
        combined.length > MAX_BUFFER_SAMPLES
          ? combined.slice(combined.length - MAX_BUFFER_SAMPLES)
          : combined;
      sampleBufferRef.current = trimmed;
      latestChunkRef.current = chunk.slice();

      processAudioChunk(chunk).catch((error) => {
        console.error("Audio processing error:", error);
      });

      performanceMonitor.measure("pipeline-processing", markName);

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
        lastUpdateRef.current = now;
        console.debug("Scheduling visualization update");
        scheduleVisualizationUpdate();
      }
    },
    [scheduleVisualizationUpdate, processAudioChunk],
  );

  const beginDeviceStreaming = useCallback(
    async (activeDevice: ISDRDevice): Promise<void> => {
      clearVisualizationState();
      setListening(true);
      setDeviceError(null);
      announce("Started receiving radio signals");

      console.warn("beginDeviceStreaming: Configuring device before streaming");
      try {
        await activeDevice.setSampleRate(2048000);
        console.warn("beginDeviceStreaming: Sample rate set to 2.048 MSPS");
      } catch (err) {
        console.error("Failed to set sample rate:", err);
        const error = err instanceof Error ? err : new Error(String(err));
        setDeviceError(error);
      }

      const receivePromise = activeDevice
        .receive((data) => {
          console.warn("Received data, byteLength:", data?.byteLength || 0);
          const parsed = activeDevice.parseSamples(data) as Sample[];
          console.warn("Parsed samples count:", parsed?.length || 0);
          handleSampleChunk(parsed);
        })
        .catch((err) => {
          console.error(err);
          const error = err instanceof Error ? err : new Error(String(err));
          setDeviceError(error);
          announce("Failed to receive radio signals");
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
    [clearVisualizationState, handleSampleChunk, announce],
  );

  const handleSetFrequency = async (newFrequency: number): Promise<void> => {
    setFrequency(newFrequency);
    if (device) {
      await device.setFrequency(newFrequency);
      const displayFreq =
        signalType === "FM"
          ? `${(newFrequency / 1e6).toFixed(1)} MHz`
          : `${(newFrequency / 1e3).toFixed(0)} kHz`;
      announce(`Frequency changed to ${displayFreq}`);
    }
  };

  const handleSetBandwidth = async (newBandwidth: number): Promise<void> => {
    setBandwidth(newBandwidth);
    if (device && device.setBandwidth) {
      await device.setBandwidth(newBandwidth);
      announce(`Bandwidth filter set to ${newBandwidth / 1e6} MHz`);
    }
  };

  const handleSignalTypeChange = (type: SignalType): void => {
    setSignalType(type);
    announce(`Signal type changed to ${type}`);
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

  useEffect((): void => {
    if (!device) {
      return;
    }
    const configureDevice = async (): Promise<void> => {
      await device.setSampleRate(2048000);
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
      announce("Connecting to SDR device...");
      try {
        await initialize();
        announce("SDR device connected");
      } catch (err) {
        console.error(err);
        shouldStartOnConnectRef.current = false;
        announce(
          "Failed to connect to device. Please check device connection and browser permissions.",
        );
      } finally {
        setIsInitializing(false);
      }
      return;
    }

    shouldStartOnConnectRef.current = false;
    void beginDeviceStreaming(device);
  }, [
    beginDeviceStreaming,
    device,
    initialize,
    isInitializing,
    listening,
    announce,
  ]);

  const stopListening = useCallback(async (): Promise<void> => {
    if (device && device.isReceiving()) {
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
        // Errors already handled
      }
      receivePromiseRef.current = null;
    }

    cancelScheduledUpdate();
    setListening(false);
    announce("Stopped receiving radio signals");
  }, [cancelScheduledUpdate, device, announce]);

  return (
    <div className="container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <LiveRegion />

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
                {device && device.getCapabilities().supportedBandwidths ? (
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

        <Card
          title="Signal Strength Meter"
          subtitle="Real-time signal level monitoring for antenna alignment and quality assessment"
        >
          <SignalStrengthMeterChart samples={latestSamples} />
        </Card>

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

          <Card
            title="Spectrogram"
            subtitle="Frequency spectrum over time showing signal strength"
          >
            <FFTChart samples={samples} />
          </Card>
        </div>
      </main>
    </div>
  );
}

export default LiveMonitor;
