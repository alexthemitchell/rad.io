import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import AudioControls from "../components/AudioControls";
import BandwidthSelector from "../components/BandwidthSelector";
import Card from "../components/Card";
import DeviceControlBar from "../components/DeviceControlBar";
import FFTChart from "../components/FFTChart";
import P25SystemPresets from "../components/P25SystemPresets";
import PresetStations from "../components/PresetStations";
import RadioControls from "../components/RadioControls";
import SampleChart from "../components/SampleChart";
import SignalStrengthMeterChart from "../components/SignalStrengthMeterChart";
import SignalTypeSelector, {
  type SignalType,
} from "../components/SignalTypeSelector";
import StatusBar, { RenderTier } from "../components/StatusBar";
import TrunkedRadioControls from "../components/TrunkedRadioControls";
import WaveformChart from "../components/WaveformChart";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import { useLiveRegion } from "../hooks/useLiveRegion";
import { renderTierManager } from "../lib/render/RenderTierManager";
import { type ISDRDevice } from "../models/SDRDevice";
import {
  AudioStreamProcessor,
  DemodulationType,
  type AudioStreamResult,
} from "../utils/audioStream";
import { type Sample } from "../utils/dsp";
import { performanceMonitor } from "../utils/performanceMonitor";

const MAX_BUFFER_SAMPLES = 32768;
const UPDATE_INTERVAL_MS = 33; // Target 30 FPS
const AUDIO_BUFFER_SIZE = 131072;

function LiveMonitor(): React.JSX.Element {
  // Accessibility: skip link and live region
  const { announce, liveRegion: LiveRegion } = useLiveRegion();
  const { device, initialize, isCheckingPaired } = useHackRFDevice();
  const [listening, setListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [deviceError, setDeviceError] = useState<Error | null>(null);
  const [frequency, setFrequency] = useState(100.3e6);
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const [bandwidth, setBandwidth] = useState(20e6);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  // Status bar metrics
  const [renderTier, setRenderTier] = useState<RenderTier>(RenderTier.Unknown);
  const [fps, setFps] = useState<number>(0);
  const [bufferHealth, setBufferHealth] = useState<number>(100);
  const [storageUsed, setStorageUsed] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<number>(0);

  // Subscribe to render tier changes
  useEffect(() => renderTierManager.subscribe(setRenderTier), []);
  // Poll FPS
  useEffect(() => {
    const id = setInterval(() => setFps(performanceMonitor.getFPS()), 1000);
    return () => clearInterval(id);
  }, []);
  // Poll Storage API
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      try {
        const est = await navigator.storage.estimate();
        if (!cancelled) {
          setStorageUsed(est.usage ?? 0);
          setStorageQuota(est.quota ?? 0);
        }
      } catch {}
    };
    update();
    const id = setInterval(update, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  // Buffer health (simplified)
  useEffect(() => {
    const id = setInterval(() => setBufferHealth(100), 1000);
    return () => clearInterval(id);
  }, []);

  // Device control handlers
  const handleSetFrequency = async (newFrequency: number) => {
    setFrequency(newFrequency);
    if (device) {
      await device.setFrequency(newFrequency);
      announce(`Frequency changed to ${(newFrequency / 1e6).toFixed(1)} MHz`);
    }
  };
  const handleSetBandwidth = async (newBandwidth: number) => {
    setBandwidth(newBandwidth);
    if (device?.setBandwidth) {
      await device.setBandwidth(newBandwidth);
      announce(`Bandwidth set to ${(newBandwidth / 1e6).toFixed(2)} MHz`);
    }
  };
  const handleSignalTypeChange = (type: SignalType) => {
    setSignalType(type);
    announce(`Signal type changed to ${type}`);
  };
  // Audio controls
  const handleVolumeChange = (volume: number) => setAudioVolume(volume);
  const handleToggleMute = () => setIsAudioMuted((prev) => !prev);

  // Device connection
  const startListening = async () => {
    setListening(true);
    announce("Started receiving radio signals");
  };
  const stopListening = async () => {
    setListening(false);
    announce("Stopped receiving radio signals");
  };

  return (
    <div className="container">
      <a href="#main-content" className="skip-link">Skip to main content</a>
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
        />
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
            {device?.getCapabilities().supportedBandwidths && (
              <BandwidthSelector
                bandwidth={bandwidth}
                setBandwidth={handleSetBandwidth}
                supportedBandwidths={device.getCapabilities().supportedBandwidths}
              />
            )}
            <AudioControls
              volume={audioVolume}
              muted={isAudioMuted}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleToggleMute}
            />
          </div>
        </Card>
        <SpectrumWaterfall
          samples={[]}
          frequency={frequency}
          signalType={signalType}
        />
        <StatusBar
          renderTier={renderTier}
          fps={fps}
          bufferHealth={bufferHealth}
          storageUsed={storageUsed}
          storageQuota={storageQuota}
        />
      </main>
    </div>
  );
}
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
              onStationSelect={(freq) => {
                void handleSetFrequency(freq);
              }}
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

      <StatusBar
        renderTier={renderTier}
        fps={fps}
        sampleRate={sampleRateState}
        bufferHealth={bufferHealth}
        storageUsed={storageUsed}
        storageQuota={storageQuota}
        deviceConnected={Boolean(device)}
      />
    </div>
  );
}

export default LiveMonitor;
