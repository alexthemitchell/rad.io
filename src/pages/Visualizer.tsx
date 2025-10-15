import { useEffect, useState } from "react";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import SignalTypeSelector, {
  SignalType,
} from "../components/SignalTypeSelector";
import PresetStations from "../components/PresetStations";
import RadioControls from "../components/RadioControls";
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
    }
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

  const startListening = async () => {
    try {
      if (!device) {
        await initialize();
      } else {
        setListening(true);
        device
          .receive((data) => {
            console.debug("IQ Sample received:", data.byteLength, "bytes");
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
          <RadioControls
            frequency={frequency}
            signalType={signalType}
            setFrequency={handleSetFrequency}
          />
        </div>
        <PresetStations
          signalType={signalType}
          currentFrequency={frequency}
          onStationSelect={handleSetFrequency}
        />
      </Card>

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
