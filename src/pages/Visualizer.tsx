import { useEffect, useState } from "react";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import SignalTypeSelector, {
  SignalType,
} from "../components/SignalTypeSelector";
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
import "../styles/main.css";

function Visualizer() {
  const { device, initialize, cleanup } = useHackRFDevice();
  const [listening, setListening] = useState(false);
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const [frequency, setFrequency] = useState(100.3e6);

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

  const handleSetFrequency = async (newFrequency: number) => {
    setFrequency(newFrequency);
    if (device) {
      await device.setFrequency(newFrequency);
    }
  };

  const handleSignalTypeChange = (type: SignalType) => {
    setSignalType(type);
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
  }) => {
    setControlChannel(system.controlChannel);
    setNac(system.nac);
    setSystemId(system.systemId);
    setWacn(system.wacn);
    if (signalType === "P25") {
      handleSetFrequency(system.controlChannel).catch(console.error);
    }
  };

  const handleTalkgroupToggle = (id: string) => {
    setTalkgroups((prev) =>
      prev.map((tg) => (tg.id === id ? { ...tg, enabled: !tg.enabled } : tg)),
    );
  };

  const handleAddTalkgroup = (newTalkgroup: Omit<Talkgroup, "enabled">) => {
    setTalkgroups((prev) => [...prev, { ...newTalkgroup, enabled: true }]);
  };

  useEffect(() => {
    if (!device) {
      return;
    }
    // Configure device when it becomes available
    const configureDevice = async () => {
      await device.setFrequency(frequency);
      await device.setAmpEnable(false);
    };
    configureDevice().catch(console.error);
  }, [device, frequency]);

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

      return () => {
        clearInterval(interval);
        timeoutIds.forEach((id) => clearTimeout(id));
      };
    }
  }, [listening, signalType, talkgroups]);

  const startListening = async () => {
    try {
      if (!device) {
        await initialize();
      } else {
        setListening(true);
        device
          .receive(() => {
            // IQ Sample received
          })
          .catch(console.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const stopListening = async () => {
    if (device) {
      await device.stopRx();
      setListening(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>rad.io</h1>
        <p>Software-Defined Radio Visualizer</p>
      </header>

      <div className="action-bar">
        <div className="action-bar-left">
          <button
            className="btn btn-primary"
            onClick={startListening}
            disabled={!device || listening}
            title={
              !device
                ? "Click to connect your SDR device via WebUSB. Ensure device is plugged in and browser supports WebUSB."
                : listening
                  ? "Device is currently receiving. Click 'Stop Reception' first."
                  : "Start receiving IQ samples from the SDR device. Visualizations will update with live data."
            }
            aria-label={
              device
                ? "Start receiving radio signals"
                : "Connect SDR device via WebUSB"
            }
          >
            {device ? "Start Reception" : "Connect Device"}
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
            title={
              device
                ? listening
                  ? "Device is connected and actively receiving IQ samples"
                  : "Device is connected but not receiving. Click 'Start Reception' to begin."
                : "No device connected. Click 'Connect Device' to get started."
            }
          >
            <span className={`status-dot ${device ? "active" : "inactive"}`} />
            {device ? (listening ? "Receiving" : "Connected") : "Not Connected"}
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
            <RadioControls
              frequency={frequency}
              signalType={signalType}
              setFrequency={handleSetFrequency}
            />
          ) : null}
        </div>
        {signalType === "P25" ? (
          <>
            <TrunkedRadioControls
              controlChannel={controlChannel}
              nac={nac}
              systemId={systemId}
              wacn={wacn}
              onControlChannelChange={setControlChannel}
              onControlChannelBlur={() => {
                handleSetFrequency(controlChannel).catch(console.error);
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

      <div className="visualizations">
        <Card
          title="IQ Constellation Diagram"
          subtitle="Visual representation of the I (in-phase) and Q (quadrature) components"
        >
          <SampleChart />
        </Card>

        <Card
          title="Amplitude Waveform"
          subtitle="Time-domain signal amplitude envelope"
        >
          <WaveformChart />
        </Card>

        <Card
          title="Spectrogram"
          subtitle="Frequency spectrum over time showing signal strength"
        >
          <FFTChart />
        </Card>
      </div>
    </div>
  );
}

export default Visualizer;
