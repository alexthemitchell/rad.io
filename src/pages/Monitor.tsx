import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AudioControls from "../components/AudioControls";
import RDSDisplay from "../components/RDSDisplay";
import RecordingControls from "../components/RecordingControls";
import SignalStrengthMeter from "../components/SignalStrengthMeter";
import StatusBar from "../components/StatusBar";
import { useDevice } from "../contexts/DeviceContext";
import { useFrequency } from "../contexts/FrequencyContext";
import { HardwareSDRSource } from "../drivers/HardwareSDRSource";
import {
  useFrequencyScanner,
  type ActiveSignal,
} from "../hooks/useFrequencyScanner";
import { notify } from "../lib/notifications";
import { renderTierManager } from "../lib/render/RenderTierManager";
import { AudioStreamProcessor, DemodulationType } from "../utils/audioStream";
import { type Sample as DSPSample } from "../utils/dsp";
import { formatFrequency } from "../utils/frequency";
import { performanceMonitor } from "../utils/performanceMonitor";
import {
  SpectrumExplorer,
  Spectrogram,
  createVisualizationSetup,
  type VisualizationSetup,
} from "../visualization";
import type { IQSample } from "../models/SDRDevice";
import type { RenderTier } from "../types/rendering";

// Consolidated debug object to avoid polluting global namespace
declare global {
  interface Window {
    radDebug?: {
      audioCtx?: AudioContext;
      volume?: number;
      audioCtxTime?: number;
      lastAudioLength?: number;
      audioClipping?: boolean;
      lastAudioAt?: number;
      receiving?: boolean;
    };
  }
}

// Initialize debug object
if (typeof window !== "undefined") {
  window.radDebug = window.radDebug ?? {};
}

declare global {
  interface Window {
    dbgReceiving?: boolean;
    dbgAudioCtx?: AudioContext;
    dbgAudioCtxTime?: number;
    dbgLastAudioLength?: number;
    dbgLastAudioAt?: number;
    dbgAudioClipping?: boolean;
    dbgVolume?: number;
  }
}

export default function Monitor(): React.JSX.Element {
  const { device, isCheckingPaired } = useDevice();

  // UI state
  const { frequencyHz: frequency, setFrequencyHz: setFrequency } =
    useFrequency();
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const sampleRate = 2_000_000; // 2 MSPS
  const lnaGain = 16; // dB
  const ampEnabled = false;
  const [isReceiving, setIsReceiving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Visualization and processing setup
  const vizSetupRef = useRef<VisualizationSetup<HardwareSDRSource> | null>(
    null,
  );

  // Visualization controls
  const [fftSize, setFftSize] = useState<number>(2048);
  const [showWaterfall, setShowWaterfall] = useState<boolean>(false);
  const [vizMode, setVizMode] = useState<"fft" | "waterfall" | "spectrogram">(
    "fft",
  );
  const [colorMap, setColorMap] = useState<
    "viridis" | "inferno" | "turbo" | "gray"
  >("viridis");
  const [dbMin, setDbMin] = useState<number | undefined>(undefined);
  const [dbMax, setDbMax] = useState<number | undefined>(undefined);

  // Recording state
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "playback"
  >("idle");
  const [recordedSamples, setRecordedSamples] = useState<DSPSample[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingStartTimeRef = useRef<number>(0);

  // Frequency scanner integration
  const [foundSignals, setFoundSignals] = useState<ActiveSignal[]>([]);
  const scanner = useFrequencyScanner(device, (signal) => {
    setFoundSignals((prev) => {
      const idx = prev.findIndex((s) => s.frequency === signal.frequency);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = signal;
        return copy;
      }
      return prev.concat(signal);
    });
  });

  // Audio processing
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioStreamProcessor | null>(null);
  const iqBufferRef = useRef<IQSample[]>([]);

  // Visualization ring buffer
  // Visualization ring buffer (capped) and rAF-driven state updates to reduce churn
  const vizBufferRef = useRef<DSPSample[]>([]);
  const [vizSamples, setVizSamples] = useState<DSPSample[]>([]);
  const lastVizUpdateRef = useRef<number>(0);
  const vizUpdatePendingRef = useRef<boolean>(false);
  const HIGH_PERF_DEFAULT = true; // prefer lower churn by default
  const [highPerfMode, setHighPerfMode] = useState<boolean>(HIGH_PERF_DEFAULT);

  // Render tier for StatusBar
  const [renderTier, setRenderTier] = useState<RenderTier>(() =>
    renderTierManager.getTier(),
  );
  useEffect(() => renderTierManager.subscribe(setRenderTier), []);

  // StatusBar metrics
  const [fps, setFps] = useState<number>(0);
  const [storageUsed, setStorageUsed] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<number>(0);
  const [bufferHealth, setBufferHealth] = useState<number>(100);

  // Signal quality metrics
  const [signalQuality, setSignalQuality] = useState<{
    snr: number;
    peakPower: number;
    avgPower: number;
  }>({ snr: 0, peakPower: -100, avgPower: -100 });

  useEffect(() => {
    if (!device) {
      return;
    }

    const source = new HardwareSDRSource(device);
    const setup = createVisualizationSetup({
      source,
      preset: "RealtimeMonitoring",
      enableFFT: true,
      enableSpectrogram: true,
      fftSize,
      sampleRate,
    });
    vizSetupRef.current = setup;

    return (): void => {
      void setup.cleanup();
    };
  }, [device, fftSize, sampleRate]);

  // Update FPS every second
  useEffect(() => {
    const id = setInterval(() => setFps(performanceMonitor.getFPS()), 1000);
    return (): void => clearInterval(id);
  }, []);

  // Poll Storage API every 5 seconds
  useEffect(() => {
    let cancelled = false;
    async function poll(): Promise<void> {
      try {
        if (typeof navigator.storage.estimate === "function") {
          const est = await navigator.storage.estimate();
          if (!cancelled) {
            setStorageUsed(est.usage ?? 0);
            setStorageQuota(est.quota ?? 0);
          }
        }
      } catch {
        if (!cancelled) {
          setStorageUsed(0);
          setStorageQuota(0);
        }
      }
    }
    const id = setInterval((): void => {
      void poll();
    }, 5000);
    void poll();
    return (): void => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Compute buffer health every second based on visualization buffer fill
  useEffect(() => {
    const id = setInterval((): void => {
      const maxFrames = highPerfMode ? 16 : 64;
      const maxViz = fftSize * maxFrames;
      const pct = Math.max(
        0,
        Math.min(100, Math.round((vizBufferRef.current.length / maxViz) * 100)),
      );
      setBufferHealth(pct);

      // Calculate signal quality metrics
      if (vizSamples.length > 0) {
        let sumPower = 0;
        let peakPower = -Infinity;
        for (const sample of vizSamples) {
          const power = sample.I * sample.I + sample.Q * sample.Q;
          sumPower += power;
          if (power > peakPower) {
            peakPower = power;
          }
        }
        const avgPower = sumPower / vizSamples.length;
        const avgPowerDb = 10 * Math.log10(avgPower + 1e-10);
        const peakPowerDb = 10 * Math.log10(peakPower + 1e-10);

        // Simple SNR estimate: assume noise floor is -80dBm
        const noiseFloor = -80;
        const snr = Math.max(0, avgPowerDb - noiseFloor);

        setSignalQuality({
          snr: Math.round(snr * 10) / 10,
          peakPower: Math.round(peakPowerDb * 10) / 10,
          avgPower: Math.round(avgPowerDb * 10) / 10,
        });
      }
    }, 1000);
    return (): void => clearInterval(id);
  }, [fftSize, highPerfMode, vizSamples]);

  const ensureAudio = useCallback((): void => {
    audioCtxRef.current ??= new AudioContext();
    processorRef.current ??= new AudioStreamProcessor(sampleRate);
    window.radDebug = window.radDebug ?? {};
    window.radDebug.audioCtx = audioCtxRef.current;
  }, [sampleRate]);

  useEffect(() => {
    window.radDebug = window.radDebug ?? {};
    window.radDebug.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Recording duration timer
  useEffect((): (() => void) | undefined => {
    if (recordingState !== "recording") {
      return undefined;
    }
    const interval = setInterval((): void => {
      setRecordingDuration(Date.now() - recordingStartTimeRef.current);
    }, 100);
    return (): void => clearInterval(interval);
  }, [recordingState]);

  // Audio controls handlers
  const handleToggleAudio = useCallback(() => {
    setIsAudioPlaying((prev) => !prev);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(Math.round(newVolume * 100));
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Recording handlers
  const handleStartRecording = useCallback(() => {
    setRecordingState("recording");
    setRecordedSamples([]);
    recordingStartTimeRef.current = Date.now();
    setRecordingDuration(0);
    notify({
      message: "Recording started",
      sr: "polite",
      visual: true,
      tone: "info",
    });
  }, []);

  const handleStopRecording = useCallback(() => {
    setRecordingState("idle");
    const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
    notify({
      message: `Recording stopped. Captured ${recordedSamples.length.toLocaleString()} samples (${duration.toFixed(1)}s)`,
      sr: "polite",
      visual: true,
      tone: "success",
    });
  }, [recordedSamples.length]);

  const handleStartPlayback = useCallback(() => {
    if (recordedSamples.length === 0) {
      notify({
        message: "No recording to play back",
        sr: "assertive",
        visual: true,
        tone: "warning",
      });
      return;
    }
    setRecordingState("playback");
    notify({
      message: "Playing back recording",
      sr: "polite",
      visual: true,
      tone: "info",
    });
  }, [recordedSamples.length]);

  const handleStopPlayback = useCallback(() => {
    setRecordingState("idle");
  }, []);

  // (Optional) signal strength simulation removed in merged view

  // Derived overlay data for SpectrumExplorer
  const explorerSignals = useMemo(
    () =>
      foundSignals.map((s) => ({
        freqHz: s.frequency,
        strength: s.strength,
        label:
          s.label ??
          (s.rdsData?.ps
            ? `${s.rdsData.ps}${s.rdsData.rt ? ` • ${s.rdsData.rt.slice(0, 24)}` : ""}`
            : undefined),
      })),
    [foundSignals],
  );

  // Build spectrogram frames
  const spectroFrames = useMemo(() => {
    const processor = vizSetupRef.current?.spectrogramProcessor;
    if (!processor || vizSamples.length < fftSize) {
      return [];
    }
    const output = processor.process(vizSamples);
    return output.data;
  }, [vizSamples, fftSize]);

  const tuneDevice = useCallback(async (): Promise<void> => {
    if (!device) {
      setStatusMsg("No device connected. Open the Devices panel to connect.");
      return;
    }
    try {
      if (!device.isOpen()) {
        await device.open();
      }
      await device.setSampleRate(sampleRate);
      await device.setLNAGain(lnaGain);
      await device.setAmpEnable(ampEnabled);
      if (device.setBandwidth) {
        await device.setBandwidth(2_500_000);
      }
      await device.setFrequency(frequency);
      setStatusMsg(
        `Tuned to ${formatFrequency(frequency)} @ ${(sampleRate / 1e6).toFixed(
          2,
        )} MSPS`,
      );
    } catch (err) {
      console.error("Tune failed", err);
      try {
        if (typeof device.fastRecovery === "function") {
          setStatusMsg("Recovering device after transfer error…");
          await device.fastRecovery();
        } else {
          await device.open();
        }
        await device.setSampleRate(sampleRate);
        await device.setLNAGain(lnaGain);
        await device.setAmpEnable(ampEnabled);
        if (device.setBandwidth) {
          await device.setBandwidth(2_500_000);
        }
        await device.setFrequency(frequency);
        setStatusMsg(
          `Tuned to ${formatFrequency(frequency)} @ ${(
            sampleRate / 1e6
          ).toFixed(2)} MSPS`,
        );
        return;
      } catch (retryErr) {
        console.error("Tune retry after recovery failed", retryErr);
      }
      setStatusMsg(
        err instanceof Error ? `Tune failed: ${err.message}` : "Tune failed",
      );
      throw err;
    }
  }, [ampEnabled, device, frequency, lnaGain, sampleRate]);

  const handleStart = useCallback(async (): Promise<void> => {
    const setup = vizSetupRef.current;
    if (!device || !setup) {
      setStatusMsg("No device connected or setup not initialized");
      return;
    }
    try {
      scanner.stopScan();
      ensureAudio();
      await tuneDevice();
      iqBufferRef.current = [];
      setIsReceiving(true);

      await setup.source.startStreaming((samples: DSPSample[]) => {
        try {
          // Capture samples for recording
          if (recordingState === "recording") {
            setRecordedSamples((prev) => [...prev, ...samples]);
          }

          const buffer = iqBufferRef.current;
          buffer.push(...samples.map((s) => ({ I: s.I, Q: s.Q })));

          // Feed visualization ring buffer and trim
          const vbuf = vizBufferRef.current;
          vbuf.push(...samples);
          // Cap visualization buffer aggressively in high performance mode to reduce GC pressure
          const maxVizFrames = highPerfMode ? 16 : 64;
          const maxVizSamples = fftSize * maxVizFrames;
          if (vbuf.length > maxVizSamples) {
            vizBufferRef.current = vbuf.slice(-maxVizSamples);
          }

          // Throttle UI updates and avoid copying entire buffers
          // Use rAF scheduling and only clone the tail needed by visualizers
          const requestTailUpdate = (): void => {
            vizUpdatePendingRef.current = false;
            const mark = "viz-push-start";
            performanceMonitor.mark(mark);
            // Tail window: a small multiple of fftSize is enough for SpectrumExplorer incremental feed
            const tailSamples = fftSize * (highPerfMode ? 4 : 12);
            const start = Math.max(0, vbuf.length - tailSamples);
            // Create a shallow copy of only the needed window
            setVizSamples(vbuf.slice(start));
            performanceMonitor.measure("viz-push", mark);
            lastVizUpdateRef.current = performance.now();
          };

          const now = performance.now();
          const minFrameMs = highPerfMode ? 33 /* ~30fps */ : 16; /* ~60fps */
          if (
            !vizUpdatePendingRef.current &&
            now - lastVizUpdateRef.current > minFrameMs
          ) {
            vizUpdatePendingRef.current = true;
            // Schedule on next animation tick for smoother pacing
            if (
              typeof window !== "undefined" &&
              typeof window.requestAnimationFrame === "function"
            ) {
              window.requestAnimationFrame(() => requestTailUpdate());
            } else {
              // Fallback if rAF unavailable (e.g., hidden tabs/tests)
              setTimeout(requestTailUpdate, 0);
            }
          }

          // Audio chunk ~25ms at 2 MSPS
          const MIN_IQ_SAMPLES = 50_000;
          if (buffer.length >= MIN_IQ_SAMPLES) {
            const chunk = buffer.splice(0, MIN_IQ_SAMPLES);
            const proc = processorRef.current;
            const ctx = audioCtxRef.current;
            if (proc && ctx) {
              const demod = DemodulationType.FM;
              const { audioBuffer } = proc.extractAudio(chunk, demod, {
                sampleRate: 48_000,
                channels: 1,
              });
              if (ctx.state === "suspended") {
                void ctx.resume();
              }
              const src = ctx.createBufferSource();
              src.buffer = audioBuffer;
              const gainNode = ctx.createGain();
              gainNode.gain.value = isMuted ? 0 : volume / 100;
              src.connect(gainNode).connect(ctx.destination);
              src.start();
              window.radDebug = window.radDebug ?? {};
              window.radDebug.audioCtxTime = ctx.currentTime;
              window.radDebug.lastAudioLength = audioBuffer.length;
              try {
                const data = audioBuffer.getChannelData(0);
                let maxAbs = 0;
                for (const sample of data) {
                  const v = Math.abs(sample);
                  if (v > maxAbs) {
                    maxAbs = v;
                  }
                }
                window.radDebug.audioClipping = maxAbs >= 0.98;
              } catch {
                // ignore
              }
              window.radDebug.lastAudioAt = performance.now();
            }
          }
        } catch (e) {
          console.error("Error in receive callback", e);
        }
      });

      setStatusMsg("Receiving started");
      window.radDebug = window.radDebug ?? {};
      window.radDebug.receiving = true;
    } catch (err) {
      console.error("Start failed", err);
      setIsReceiving(false);
      setStatusMsg(
        err instanceof Error ? `Start failed: ${err.message}` : "Start failed",
      );
    }
  }, [
    device,
    ensureAudio,
    fftSize,
    highPerfMode,
    tuneDevice,
    volume,
    scanner,
    recordingState,
    isMuted,
  ]);

  const handleStop = useCallback(async (): Promise<void> => {
    try {
      if (vizSetupRef.current?.source.isStreaming()) {
        await vizSetupRef.current.source.stopStreaming();
      }
    } finally {
      setIsReceiving(false);
      setStatusMsg("Reception stopped");
      window.radDebug = window.radDebug ?? {};
      window.radDebug.receiving = false;
      vizBufferRef.current = [];
      setVizSamples([]);
    }
  }, []);

  // Auto-start reception if a previously paired device is already connected/opened.
  // We only do this once per session to avoid surprising re-starts after a manual stop.
  useEffect(() => {
    if (isCheckingPaired) {
      return;
    }
    if (!device) {
      return;
    }
    try {
      const open = device.isOpen();
      if (open && !isReceiving && scanner.state === "idle") {
        // Fire and forget; errors will be reflected into status message by handleStart.
        void handleStart();
      }
    } catch {
      // ignore
    }
  }, [device, isReceiving, handleStart, isCheckingPaired, scanner.state]);

  // Ensure RX is stopped when leaving the page
  useEffect(() => {
    return (): void => {
      try {
        if (vizSetupRef.current?.source.isStreaming()) {
          void vizSetupRef.current.source
            .stopStreaming()
            .catch((e: unknown) => {
              console.warn("Stop on unmount failed", e);
            });
        }
      } catch (e) {
        console.warn("Error during unmount cleanup", e);
      }
    };
  }, []);

  return (
    <main
      className="page-container"
      role="main"
      aria-labelledby="monitor-heading"
      id="main-content"
      tabIndex={-1}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 id="monitor-heading" style={{ margin: 0 }}>
          Monitor - Live Signal Reception
        </h2>
        <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
          <span title="Keyboard shortcuts: F to freeze, E to export CSV">
            ⌨️ Shortcuts available
          </span>
        </div>
      </div>
      <p role="status" aria-live="polite" style={{ marginBottom: 8 }}>
        {statusMsg}
      </p>

      <section
        aria-label="Spectrum Visualization"
        style={{
          backgroundColor: "var(--rad-bg-secondary, #1a1a1a)",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Spectrum & Waterfall</h3>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <label>
            Visualization mode:
            <select
              aria-label="Visualization mode"
              value={vizMode}
              onChange={(e) =>
                setVizMode(
                  e.target.value as "fft" | "waterfall" | "spectrogram",
                )
              }
              style={{ marginLeft: 8 }}
            >
              <option value="fft">FFT</option>
              <option value="waterfall">Waterfall</option>
              <option value="spectrogram">Spectrogram</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={highPerfMode}
              onChange={(e) => setHighPerfMode(e.target.checked)}
              aria-label="High performance mode (lower latency, less history)"
              style={{ marginLeft: 8, marginRight: 4 }}
            />
            High performance mode
          </label>
          <label>
            FFT Size:
            <select
              aria-label="FFT size"
              value={fftSize}
              onChange={(e) => setFftSize(parseInt(e.target.value, 10))}
              style={{ marginLeft: 8 }}
            >
              {[1024, 2048, 4096, 8192].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {vizMode === "fft" && (
            <label>
              <input
                type="checkbox"
                checked={showWaterfall}
                onChange={(e) => setShowWaterfall(e.target.checked)}
                aria-label="Toggle waterfall visualization"
                style={{ marginLeft: 8, marginRight: 4 }}
              />
              Show Waterfall (improves performance when off)
            </label>
          )}
          <div
            role="group"
            aria-label="Frequency scanner controls"
            style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
          >
            <button
              onClick={() => {
                if (isReceiving) {
                  void handleStop();
                }
                void scanner.startScan();
                setStatusMsg("Scanning for active signals…");
              }}
              disabled={scanner.state === "scanning"}
              aria-label="Start frequency scan"
              title="Start scanning the current band (stops live reception while running)"
            >
              🔎 Start Scan
            </button>
            <button
              onClick={() => scanner.pauseScan()}
              disabled={scanner.state !== "scanning"}
              aria-label="Pause scan"
            >
              ⏸ Pause
            </button>
            <button
              onClick={() => scanner.resumeScan()}
              disabled={scanner.state !== "paused"}
              aria-label="Resume scan"
            >
              ▶ Resume
            </button>
            <button
              onClick={() => {
                scanner.stopScan();
                setStatusMsg("Scan stopped");
              }}
              disabled={scanner.state === "idle"}
              aria-label="Stop scan"
            >
              ■ Stop
            </button>
            <label style={{ marginLeft: 8 }}>
              <input
                type="checkbox"
                checked={scanner.config.enableRDS ?? true}
                onChange={(e) =>
                  scanner.updateConfig({ enableRDS: e.target.checked })
                }
              />
              RDS
            </label>
            <span aria-live="polite" style={{ opacity: 0.8 }}>
              {scanner.state !== "idle"
                ? `Progress: ${Math.round(scanner.progress)}%`
                : ""}
            </span>
          </div>
        </div>
        {vizMode === "fft" ? (
          <div style={{ marginTop: 8 }}>
            <SpectrumExplorer
              samples={vizSamples}
              sampleRate={sampleRate}
              centerFrequency={frequency}
              fftSize={fftSize}
              frames={200}
              showWaterfall={showWaterfall}
              signals={explorerSignals}
              onTune={(fHz) => {
                const snapped = Math.round(fHz / 1_000) * 1_000;
                setFrequency(snapped);
                if (device) {
                  void device
                    .setFrequency(snapped)
                    .then(() =>
                      setStatusMsg(
                        `Tuned to ${formatFrequency(snapped)} @ ${(
                          sampleRate / 1e6
                        ).toFixed(2)} MSPS`,
                      ),
                    )
                    .catch(() => void tuneDevice());
                }
              }}
            />
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <Spectrogram
              fftData={spectroFrames}
              width={900}
              height={320}
              freqMin={0}
              freqMax={fftSize - 1}
              mode={vizMode === "waterfall" ? "waterfall" : "spectrogram"}
              colorMap={colorMap}
              dbMin={dbMin}
              dbMax={dbMax}
              maxWaterfallFrames={200}
            />
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <label>
                Colormap:
                <select
                  aria-label="Spectrogram colormap"
                  value={colorMap}
                  onChange={(e) =>
                    setColorMap(
                      e.target.value as
                        | "viridis"
                        | "inferno"
                        | "turbo"
                        | "gray",
                    )
                  }
                  style={{ marginLeft: 6 }}
                >
                  <option value="viridis">Viridis</option>
                  <option value="inferno">Inferno</option>
                  <option value="turbo">Turbo</option>
                  <option value="gray">Grayscale</option>
                </select>
              </label>
              <label>
                dB Floor:
                <input
                  type="number"
                  placeholder="auto"
                  value={dbMin ?? ""}
                  onChange={(e) =>
                    setDbMin(
                      e.target.value === ""
                        ? undefined
                        : parseFloat(e.target.value),
                    )
                  }
                  style={{ width: 80, marginLeft: 6 }}
                  aria-label="Manual dB floor (leave blank for auto)"
                />
              </label>
              <label>
                dB Ceil:
                <input
                  type="number"
                  placeholder="auto"
                  value={dbMax ?? ""}
                  onChange={(e) =>
                    setDbMax(
                      e.target.value === ""
                        ? undefined
                        : parseFloat(e.target.value),
                    )
                  }
                  style={{ width: 80, marginLeft: 6 }}
                  aria-label="Manual dB ceiling (leave blank for auto)"
                />
              </label>
            </div>
          </div>
        )}
        {foundSignals.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong>Found signals:</strong>
            <ul style={{ marginTop: 4 }}>
              {foundSignals
                .slice()
                .sort((a, b) => b.strength - a.strength)
                .map((s) => (
                  <li key={`${s.frequency}`}>
                    {(s.frequency / 1e6).toFixed(3)} MHz
                    {s.rdsData?.ps
                      ? ` — ${s.rdsData.ps}`
                      : s.label
                        ? ` — ${s.label}`
                        : ""}
                    <button
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        const snapped = Math.round(s.frequency / 1_000) * 1_000;
                        setFrequency(snapped);
                        scanner.pauseScan();
                        void tuneDevice();
                      }}
                      title="Tune to this frequency in Live Monitor"
                    >
                      Tune
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      {/* Professional audio controls with real-time VU meter */}
      <section
        aria-label="Audio Controls"
        style={{
          backgroundColor: "var(--rad-bg-secondary, #1a1a1a)",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Audio Controls</h3>
        <AudioControls
          isPlaying={isAudioPlaying && isReceiving}
          volume={volume / 100}
          isMuted={isMuted}
          signalType="FM"
          isAvailable={Boolean(device)}
          onTogglePlay={handleToggleAudio}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
        />
      </section>

      <section
        aria-label="Signal Information"
        style={{
          backgroundColor: "var(--rad-bg-secondary, #1a1a1a)",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Signal Information</h3>
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <div style={{ flex: "1 1 300px" }}>
            <SignalStrengthMeter samples={vizSamples} />
          </div>
          {foundSignals.length > 0 && foundSignals[0]?.rdsData && (
            <div style={{ flex: "1 1 300px" }}>
              <RDSDisplay rdsData={foundSignals[0].rdsData} stats={null} />
            </div>
          )}
        </div>

        {/* Professional signal measurements */}
        {vizSamples.length > 0 && (
          <div
            className="signal-measurements"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
              padding: "12px",
              backgroundColor: "var(--rad-bg-secondary, #1a1a1a)",
              borderRadius: "4px",
              fontFamily: "JetBrains Mono, monospace",
            }}
            role="region"
            aria-label="Signal measurements"
          >
            <div>
              <div style={{ fontSize: "0.85em", opacity: 0.7 }}>SNR</div>
              <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                {signalQuality.snr.toFixed(1)} dB
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.85em", opacity: 0.7 }}>Peak Power</div>
              <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                {signalQuality.peakPower.toFixed(1)} dB
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.85em", opacity: 0.7 }}>Avg Power</div>
              <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                {signalQuality.avgPower.toFixed(1)} dB
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.85em", opacity: 0.7 }}>
                Sample Rate
              </div>
              <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                {(sampleRate / 1e6).toFixed(2)} MSPS
              </div>
            </div>
          </div>
        )}
      </section>

      <section
        aria-label="Recording"
        style={{
          backgroundColor: "var(--rad-bg-secondary, #1a1a1a)",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Recording & Playback</h3>
        <RecordingControls
          recordingState={recordingState}
          canRecord={Boolean(device && isReceiving)}
          canPlayback={recordedSamples.length > 0}
          isPlaying={recordingState === "playback"}
          duration={recordingDuration / 1000}
          playbackProgress={0}
          playbackTime={0}
          sampleCount={recordedSamples.length}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onSaveRecording={(filename, format) => {
            notify({
              message: `Recording saved to ${filename} (${format})`,
              sr: "polite",
              visual: true,
              tone: "success",
            });
          }}
          onLoadRecording={(recording) => {
            setRecordedSamples(recording.samples);
            notify({
              message: `Loaded recording with ${recording.samples.length} samples`,
              sr: "polite",
              visual: true,
              tone: "success",
            });
          }}
          onStartPlayback={handleStartPlayback}
          onPausePlayback={handleStopPlayback}
          onStopPlayback={handleStopPlayback}
        />
      </section>

      {/* Quick reference card */}
      <details
        style={{
          backgroundColor: "var(--rad-bg-secondary, #1a1a1a)",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <summary
          style={{ cursor: "pointer", fontWeight: "bold", marginBottom: "8px" }}
        >
          ℹ️ Monitor Page Features & Controls
        </summary>
        <div style={{ fontSize: "0.9em", lineHeight: "1.6" }}>
          <p>
            <strong>Spectrum Explorer:</strong> Click to tune, drag to pan,
            scroll to zoom. Markers can be added by clicking &quot;Add
            Marker&quot;.
          </p>
          <p>
            <strong>Scanner:</strong> Automatically finds active signals with
            optional RDS decoding. Click &quot;Tune&quot; on found signals to
            listen.
          </p>
          <p>
            <strong>Signal Measurements:</strong> Real-time SNR, power levels,
            and sample rate. S-meter shows signal strength quality.
          </p>
          <p>
            <strong>Audio:</strong> Play/pause, volume control, and mute. Audio
            demodulation happens in real-time from IQ samples.
          </p>
          <p>
            <strong>Recording:</strong> Capture IQ samples for later analysis or
            playback. Recordings can be saved and loaded.
          </p>
          <p>
            <strong>Keyboard Shortcuts:</strong>
          </p>
          <ul>
            <li>
              <code>F</code> - Freeze/unfreeze visualization
            </li>
            <li>
              <code>E</code> - Export current buffer to CSV
            </li>
            <li>
              <code>↑/↓</code> - Adjust frequency
            </li>
            <li>
              <code>M</code> - Add marker at current frequency
            </li>
          </ul>
        </div>
      </details>

      {/* Bottom status bar */}
      <div style={{ marginTop: 12 }}>
        <StatusBar
          renderTier={renderTier}
          fps={fps}
          sampleRate={sampleRate}
          bufferHealth={bufferHealth}
          bufferDetails={{
            currentSamples: vizBufferRef.current.length,
            maxSamples: fftSize * (highPerfMode ? 16 : 64),
          }}
          storageUsed={storageUsed}
          storageQuota={storageQuota}
          deviceConnected={Boolean(device)}
          audioState={
            !audioCtxRef.current
              ? "unavailable"
              : audioCtxRef.current.state === "suspended"
                ? "suspended"
                : isReceiving
                  ? "playing"
                  : "idle"
          }
          audioVolume={volume}
          audioClipping={Boolean(window.radDebug?.audioClipping)}
        />
      </div>
    </main>
  );
}
