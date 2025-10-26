import { useEffect, useState } from "react";
import AudioControls from "../components/AudioControls";
import BandwidthSelector from "../components/BandwidthSelector";
import Card from "../components/Card";
import DeviceControlBar from "../components/DeviceControlBar";
import RadioControls from "../components/RadioControls";
import SignalTypeSelector, {
  type SignalType,
} from "../components/SignalTypeSelector";
import Spectrogram from "../components/Spectrogram";
import StatusBar, { RenderTier } from "../components/StatusBar";
import { useHackRFDevice } from "../hooks";
import { useLiveRegion } from "../hooks/useLiveRegion";
import { renderTierManager } from "../lib/render/RenderTierManager";
import { performanceMonitor } from "../utils/performanceMonitor";

export default function LiveMonitor(): React.JSX.Element {
  // Accessibility: skip link and live region
  const { announce, liveRegion: LiveRegion } = useLiveRegion();
  const { device, initialize, isCheckingPaired } = useHackRFDevice();
  const [listening, setListening] = useState(false);
  const [isInitializing] = useState(false);
  const [deviceError] = useState<Error | null>(null);
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
  useEffect((): (() => void) => renderTierManager.subscribe(setRenderTier), []);
  // Poll FPS
  useEffect((): (() => void) => {
    const id = setInterval(() => setFps(performanceMonitor.getFPS()), 1000);
    return (): void => clearInterval(id);
  }, []);
  // Poll Storage API
  useEffect((): (() => void) => {
    let cancelled = false;
    const update = async (): Promise<void> => {
      try {
        const est = await navigator.storage.estimate();
        if (!cancelled) {
          setStorageUsed(est.usage ?? 0);
          setStorageQuota(est.quota ?? 0);
        }
      } catch {}
    };
    void update();
    const id = setInterval(() => {
      void update();
    }, 5000);
    return (): void => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  // Buffer health (simplified)
  useEffect((): (() => void) => {
    const id = setInterval(() => setBufferHealth(100), 1000);
    return (): void => clearInterval(id);
  }, []);

  // Device control handlers
  const handleSetFrequency = async (newFrequency: number): Promise<void> => {
    setFrequency(newFrequency);
    if (device) {
      await device.setFrequency(newFrequency);
      announce(`Frequency changed to ${(newFrequency / 1e6).toFixed(1)} MHz`);
    }
  };
  const handleSetBandwidth = async (newBandwidth: number): Promise<void> => {
    setBandwidth(newBandwidth);
    if (device?.setBandwidth) {
      await device.setBandwidth(newBandwidth);
      announce(`Bandwidth set to ${(newBandwidth / 1e6).toFixed(2)} MHz`);
    }
  };
  const handleSignalTypeChange = (type: SignalType): void => {
    setSignalType(type);
    announce(`Signal type changed to ${type}`);
  };
  // Audio controls
  const handleVolumeChange = (volume: number): void => setAudioVolume(volume);
  const handleToggleMute = (): void => setIsAudioMuted((prev) => !prev);

  // Device connection
  const startListening = (): void => {
    setListening(true);
    announce("Started receiving radio signals");
  };
  const stopListening = (): void => {
    setListening(false);
    announce("Stopped receiving radio signals");
  };

  // Wrap to match expected Promise-returning handlers
  const handleStartReception = async (): Promise<void> => {
    startListening();
    await Promise.resolve();
  };
  const handleStopReception = async (): Promise<void> => {
    stopListening();
    await Promise.resolve();
  };

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
          onStartReception={handleStartReception}
          onStopReception={handleStopReception}
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
                supportedBandwidths={
                  device.getCapabilities().supportedBandwidths
                }
              />
            )}
            <AudioControls
              isPlaying={listening}
              volume={audioVolume}
              isMuted={isAudioMuted}
              signalType={signalType}
              isAvailable={Boolean(device)}
              onTogglePlay={() => {
                if (listening) {
                  stopListening();
                } else {
                  startListening();
                }
              }}
              onVolumeChange={handleVolumeChange}
              onToggleMute={handleToggleMute}
            />
          </div>
        </Card>
        <Card title="Spectrogram" subtitle="Frequency spectrum over time">
          <Spectrogram fftData={[]} mode="waterfall" height={300} />
        </Card>
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
