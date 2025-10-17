import { useEffect, useState, useCallback, useRef } from "react";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import SignalTypeSelector, {
  SignalType,
} from "../components/SignalTypeSelector";
import BandwidthSelector from "../components/BandwidthSelector";
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
import { convertToSamples, Sample } from "../utils/dsp";
import {
  decodeP25Phase2,
  P25DecodedData,
  DEFAULT_P25_CONFIG,
} from "../utils/p25decoder";
import { testSamples } from "../hooks/__test__/testSamples";
import { performanceMonitor } from "../utils/performanceMonitor";
import { ISDRDevice } from "../models/SDRDevice";
import "../styles/main.css";

const MAX_BUFFER_SAMPLES = 32768;
const UPDATE_INTERVAL_MS = 100;
const DEMO_CHUNK_SIZE = 2048;
const DEMO_INTERVAL_MS = 75;

function Visualizer(): React.JSX.Element {
  const { device, initialize, cleanup } = useHackRFDevice();
  const [listening, setListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const [frequency, setFrequency] = useState(100.3e6);
  const [bandwidth, setBandwidth] = useState(20e6); // Default 20 MHz bandwidth
  const [samples, setSamples] = useState<Sample[]>([]);
  const [latestSamples, setLatestSamples] = useState<Sample[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [p25Data, setP25Data] = useState<P25DecodedData | null>(null);

  const sampleBufferRef = useRef<Sample[]>([]);
  const latestChunkRef = useRef<Sample[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const simulationTimerRef = useRef<number | null>(null);
  const demoSamplesRef = useRef<Sample[] | null>(null);
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
        return;
      }

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
        scheduleVisualizationUpdate();
      }
    },
    [scheduleVisualizationUpdate],
  );

  const stopDemoStream = useCallback((): void => {
    if (simulationTimerRef.current !== null) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
  }, []);

  const startDemoStream = useCallback((): void => {
    if (simulationTimerRef.current !== null) {
      return;
    }

    if (!demoSamplesRef.current) {
      demoSamplesRef.current = convertToSamples(
        testSamples as [number, number][],
      );
    }

    const demoData = demoSamplesRef.current;
    if (!demoData || demoData.length === 0) {
      return;
    }

    let offset = 0;
    simulationTimerRef.current = window.setInterval(() => {
      const end = offset + DEMO_CHUNK_SIZE;
      const chunk =
        end <= demoData.length
          ? demoData.slice(offset, end)
          : demoData
              .slice(offset)
              .concat(demoData.slice(0, end % demoData.length));
      handleSampleChunk(chunk);
      offset = (offset + DEMO_CHUNK_SIZE) % demoData.length;
    }, DEMO_INTERVAL_MS);
  }, [handleSampleChunk]);

  const beginDeviceStreaming = useCallback(
    async (activeDevice: ISDRDevice): Promise<void> => {
      clearVisualizationState();
      stopDemoStream();
      setListening(true);
      setLiveRegionMessage("Started receiving radio signals");

      const receivePromise = activeDevice
        .receive((data) => {
          const parsed = activeDevice.parseSamples(data) as Sample[];
          handleSampleChunk(parsed);
        })
        .catch((err) => {
          console.error(err);
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
    [clearVisualizationState, handleSampleChunk, stopDemoStream],
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
      stopDemoStream();
      cancelScheduledUpdate();
    };
  }, [cancelScheduledUpdate, stopDemoStream]);

  useEffect((): void => {
    if (!device || !shouldStartOnConnectRef.current) {
      return;
    }
    shouldStartOnConnectRef.current = false;
    void beginDeviceStreaming(device);
  }, [device, beginDeviceStreaming]);

  // Decode P25 Phase 2 data from IQ samples
  useEffect(() => {
    if (listening && signalType === "P25" && samples.length > 0) {
      try {
        // Decode P25 data from current sample buffer
        const decoded = decodeP25Phase2(samples, DEFAULT_P25_CONFIG);
        setP25Data(decoded);

        // Update UI with decoded information
        if (decoded.frames.length > 0) {
          const latestFrame = decoded.frames[decoded.frames.length - 1];
          if (latestFrame) {
            setSignalPhase("Phase 2");
            setTdmaSlot(latestFrame.slot);
            setSignalStrength(latestFrame.signalQuality);
            setIsEncrypted(decoded.isEncrypted);

            // Update talkgroup if available
            if (decoded.talkgroupId !== undefined) {
              setCurrentTalkgroup(decoded.talkgroupId.toString());
              const tg = talkgroups.find(
                (t) => t.id === decoded.talkgroupId?.toString(),
              );
              if (tg) {
                setCurrentTalkgroupName(tg.name);
              }
            }
          }
        }
      } catch (error) {
        console.error("P25 decoding error:", error);
      }
    }
  }, [listening, signalType, samples, talkgroups]);

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
          "Failed to connect to device. Starting demo mode with sample data.",
        );
        clearVisualizationState();
        setListening(true);
        startDemoStream();
      } finally {
        setIsInitializing(false);
      }
      return;
    }

    shouldStartOnConnectRef.current = false;
    void beginDeviceStreaming(device);
  }, [
    beginDeviceStreaming,
    clearVisualizationState,
    device,
    initialize,
    isInitializing,
    listening,
    startDemoStream,
  ]);

  const stopListening = useCallback(async (): Promise<void> => {
    stopDemoStream();

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
  }, [cancelScheduledUpdate, device, stopDemoStream]);

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
        <p>Software-Defined Radio Visualizer</p>
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
              disabled={listening || isInitializing}
              title={
                listening
                  ? "Device is currently receiving. Click 'Stop Reception' first."
                  : isInitializing
                    ? "Connecting to your SDR device. Please grant WebUSB access if prompted."
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

        <PerformanceMetrics />

        <div
          className="visualizations"
          role="region"
          aria-label="Signal visualizations"
        >
          <Card
            title="IQ Constellation Diagram"
            subtitle="Visual representation of the I (in-phase) and Q (quadrature) components"
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
