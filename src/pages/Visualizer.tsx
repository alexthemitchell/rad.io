import { useEffect, useState, useCallback, useRef } from "react";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import SignalTypeSelector, {
  SignalType,
} from "../components/SignalTypeSelector";
import BandwidthSelector from "../components/BandwidthSelector";
import DeviceDiagnostics from "../components/DeviceDiagnostics";
import PresetStations from "../components/PresetStations";
import RadioControls from "../components/RadioControls";
import TrunkedRadioControls from "../components/TrunkedRadioControls";
import TalkgroupScanner, { Talkgroup } from "../components/TalkgroupScanner";
import TalkgroupStatus from "../components/TalkgroupStatus";
import P25SystemPresets from "../components/P25SystemPresets";
import DSPPipeline from "../components/DSPPipeline";
import Card from "../components/Card";
import SampleChart from "../components/SampleChart";
import FFTChart from "../components/FFTChart";
import WaveformChart from "../components/WaveformChart";
import SignalStrengthMeterChart from "../components/SignalStrengthMeterChart";
import PerformanceMetrics from "../components/PerformanceMetrics";
import { Sample } from "../utils/dsp";
import { performanceMonitor } from "../utils/performanceMonitor";
import { ISDRDevice } from "../models/SDRDevice";
import "../styles/main.css";

const MAX_BUFFER_SAMPLES = 32768;
const UPDATE_INTERVAL_MS = 33; // Target 30 FPS (1000ms / 30fps ≈ 33ms)

function Visualizer(): React.JSX.Element {
  const { device, initialize, cleanup, isCheckingPaired } = useHackRFDevice();
  const [listening, setListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const [frequency, setFrequency] = useState(100.3e6);
  const [bandwidth, setBandwidth] = useState(20e6); // Default 20 MHz bandwidth
  const [samples, setSamples] = useState<Sample[]>([]);
  const [latestSamples, setLatestSamples] = useState<Sample[]>([]);
  const [currentFPS, setCurrentFPS] = useState<number>(0);
  const [deviceError, setDeviceError] = useState<Error | null>(null);

  const sampleBufferRef = useRef<Sample[]>([]);
  const latestChunkRef = useRef<Sample[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsLastUpdateRef = useRef<number>(0);
  const receivePromiseRef = useRef<Promise<void> | null>(null);
  const shouldStartOnConnectRef = useRef(false);

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
        console.warn("handleSampleChunk: received empty chunk");
        return;
      }

      console.warn(`handleSampleChunk: received ${chunk.length} samples`);

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

      performanceMonitor.measure("pipeline-processing", markName);

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
        lastUpdateRef.current = now;
        console.warn("Scheduling visualization update");
        scheduleVisualizationUpdate();
      }
    },
    [scheduleVisualizationUpdate],
  );

  const beginDeviceStreaming = useCallback(
    async (activeDevice: ISDRDevice): Promise<void> => {
      clearVisualizationState();
      setListening(true);
      setDeviceError(null); // Clear previous errors
      setLiveRegionMessage("Started receiving radio signals");

      // Ensure device is configured with sample rate before starting
      console.warn("beginDeviceStreaming: Configuring device before streaming");
      try {
        await activeDevice.setSampleRate(20000000); // 20 MSPS default
        console.warn("beginDeviceStreaming: Sample rate set to 20 MSPS");
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
  const [currentTalkgroup, setCurrentTalkgroup] = useState<string | null>(null);
  const [currentTalkgroupName, setCurrentTalkgroupName] = useState<
    string | null
  >(null);
  const [signalPhase, setSignalPhase] = useState<"Phase 1" | "Phase 2" | null>(
    null,
  );
  const [tdmaSlot, setTdmaSlot] = useState<number | null>(null);
  const [signalStrength, setSignalStrength] = useState(0);
  const [isEncrypted, setIsEncrypted] = useState(false);

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
    if (device && device.setBandwidth) {
      await device.setBandwidth(newBandwidth);
      setLiveRegionMessage(`Bandwidth filter set to ${newBandwidth / 1e6} MHz`);
    }
  };

  const handleSignalTypeChange = (type: SignalType): void => {
    setSignalType(type);
    setLiveRegionMessage(`Signal type changed to ${type}`);
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
      await device.setSampleRate(20000000); // 20 MSPS default
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

  // Simulate P25 activity (in real implementation, this would decode actual P25 data)
  useEffect(() => {
    if (listening && signalType === "P25") {
      const timeoutIds: NodeJS.Timeout[] = [];
      const interval = setInterval(() => {
        // Simulate random talkgroup activity
        const enabledTalkgroups = talkgroups.filter((tg) => tg.enabled);
        if (enabledTalkgroups.length > 0 && Math.random() > 0.5) {
          const randomTg =
            enabledTalkgroups[
              Math.floor(Math.random() * enabledTalkgroups.length)
            ];
          if (randomTg) {
            setCurrentTalkgroup(randomTg.id);
            setCurrentTalkgroupName(randomTg.name);
            setSignalPhase(Math.random() > 0.5 ? "Phase 2" : "Phase 1");
            setTdmaSlot(Math.random() > 0.5 ? 1 : 2);
            setSignalStrength(Math.floor(Math.random() * 40 + 60));
            setIsEncrypted(Math.random() > 0.7);

            // Clear after a few seconds
            const timeoutId = setTimeout(() => {
              setCurrentTalkgroup(null);
              setCurrentTalkgroupName(null);
              setSignalPhase(null);
              setTdmaSlot(null);
              setSignalStrength(0);
              setIsEncrypted(false);
            }, 3000);
            timeoutIds.push(timeoutId);
          }
        }
      }, 5000);

      return (): void => {
        clearInterval(interval);
        timeoutIds.forEach((id) => clearTimeout(id));
      };
    }
  }, [listening, signalType, talkgroups]);

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
        <div
          className="action-bar"
          role="toolbar"
          aria-label="Device control actions"
        >
          <div className="action-bar-left">
            <button
              className="btn btn-primary"
              onClick={startListening}
              disabled={listening || isInitializing || isCheckingPaired}
              title={
                listening
                  ? "Device is currently receiving. Click 'Stop Reception' first."
                  : isInitializing
                    ? "Connecting to your SDR device. Please grant WebUSB access if prompted."
                    : isCheckingPaired
                      ? "Checking for previously paired devices..."
                      : device
                        ? "Start receiving IQ samples from the SDR device. Visualizations will update with live data."
                        : "Click to connect your SDR device via WebUSB. Ensure device is plugged in and browser supports WebUSB."
              }
              aria-label={
                device
                  ? "Start receiving radio signals"
                  : "Connect SDR device via WebUSB"
              }
            >
              {device
                ? "Start Reception"
                : isCheckingPaired
                  ? "Checking for Device..."
                  : isInitializing
                    ? "Connecting..."
                    : "Connect Device"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={stopListening}
              disabled={!listening}
              title={
                listening
                  ? "Stop receiving IQ samples and pause visualizations. Device remains connected."
                  : "Reception is not active. Click 'Start Reception' first."
              }
              aria-label="Stop receiving radio signals"
            >
              Stop Reception
            </button>
            <button
              className="btn btn-danger"
              onClick={cleanup}
              disabled={listening}
              title={
                listening
                  ? "Stop reception before disconnecting the device."
                  : "Disconnect and release the SDR device. You'll need to reconnect to use it again."
              }
              aria-label="Disconnect SDR device"
            >
              Disconnect
            </button>
          </div>
          <div className="action-bar-right">
            <div
              className="status-indicator"
              role="status"
              aria-live="polite"
              title={
                device
                  ? listening
                    ? "Device is connected and actively receiving IQ samples"
                    : "Device is connected but not receiving. Click 'Start Reception' to begin."
                  : "No device connected. Click 'Connect Device' to get started."
              }
            >
              <span
                className={`status-dot ${device ? "active" : "inactive"}`}
              />
              {device
                ? listening
                  ? "Receiving"
                  : "Connected"
                : "Not Connected"}
            </div>
          </div>
        </div>

        <DeviceDiagnostics
          device={device}
          isListening={listening}
          frequency={frequency}
          error={deviceError}
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

        <DSPPipeline />

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

export default Visualizer;
