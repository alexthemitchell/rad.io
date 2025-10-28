import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import StatusBar from "../components/StatusBar";
import { useDevice } from "../contexts/DeviceContext";
import { useFrequency } from "../contexts/FrequencyContext";
import {
  useFrequencyScanner,
  type ActiveSignal,
} from "../hooks/useFrequencyScanner";
import { renderTierManager } from "../lib/render/RenderTierManager";
import { AudioStreamProcessor, DemodulationType } from "../utils/audioStream";
import { type Sample as DSPSample } from "../utils/dsp";
import { formatFrequency } from "../utils/frequency";
import { performanceMonitor } from "../utils/performanceMonitor";
import {
  SpectrumExplorer,
  Spectrogram,
  SpectrogramProcessor,
} from "../visualization";
import type { IQSample } from "../models/SDRDevice";
import type { RenderTier } from "../types/rendering";

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

// Spectrogram overlap constant
const SPECTROGRAM_OVERLAP = 0.5;

export default function Monitor(): React.JSX.Element {
  const { device, isCheckingPaired } = useDevice();

  // UI state
  const { frequencyHz: frequency, setFrequencyHz: setFrequency } =
    useFrequency();
  const volume = 50;
  const sampleRate = 2_000_000; // 2 MSPS
  const lnaGain = 16; // dB
  const ampEnabled = false;
  const [isReceiving, setIsReceiving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

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
  const vizBufferRef = useRef<DSPSample[]>([]);
  const [vizSamples, setVizSamples] = useState<DSPSample[]>([]);
  const lastVizUpdateRef = useRef<number>(0);
  const spectrogramProcessorRef = useRef<SpectrogramProcessor | null>(null);

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
      const maxViz = fftSize * 64;
      const pct = Math.max(
        0,
        Math.min(100, Math.round((vizBufferRef.current.length / maxViz) * 100)),
      );
      setBufferHealth(pct);
    }, 1000);
    return (): void => clearInterval(id);
  }, [fftSize]);

  const ensureAudio = useCallback((): void => {
    audioCtxRef.current ??= new AudioContext();
    processorRef.current ??= new AudioStreamProcessor(sampleRate);
    window.dbgAudioCtx = audioCtxRef.current;
  }, [sampleRate]);

  useEffect(() => {
    window.dbgVolume = volume;
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

  // Initialize SpectrogramProcessor
  useEffect(() => {
    if (!spectrogramProcessorRef.current) {
      const hopSize = Math.floor(fftSize * (1 - SPECTROGRAM_OVERLAP));
      spectrogramProcessorRef.current = new SpectrogramProcessor({
        type: "spectrogram",
        fftSize,
        hopSize,
        windowFunction: "hann",
        useWasm: true,
        sampleRate,
        maxTimeSlices: 200,
      });
    }
  }, [fftSize, sampleRate]);

  // Build spectrogram frames
  const spectroFrames = useMemo(() => {
    if (!spectrogramProcessorRef.current || vizSamples.length < fftSize) {
      return [];
    }
    const currentConfig = spectrogramProcessorRef.current.getConfig();
    if (
      currentConfig.fftSize !== fftSize ||
      currentConfig.sampleRate !== sampleRate
    ) {
      const hopSize = Math.floor(fftSize * (1 - SPECTROGRAM_OVERLAP));
      spectrogramProcessorRef.current.updateConfig({
        fftSize,
        hopSize,
        sampleRate,
      });
    }
    const output = spectrogramProcessorRef.current.process(vizSamples);
    return output.data;
  }, [vizSamples, fftSize, sampleRate]);

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
        `Tuned to ${formatFrequency(frequency)} @ ${(sampleRate / 1e6).toFixed(2)} MSPS`,
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
          `Tuned to ${formatFrequency(frequency)} @ ${(sampleRate / 1e6).toFixed(2)} MSPS`,
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
    if (!device) {
      setStatusMsg("No device connected");
      return;
    }
    try {
      scanner.stopScan();
      ensureAudio();
      await tuneDevice();
      iqBufferRef.current = [];
      setIsReceiving(true);

      void device
        .receive(
          (dataView) => {
            try {
              const samples = device.parseSamples(dataView);
              const buffer = iqBufferRef.current;
              buffer.push(...samples);

              // Feed visualization ring buffer and trim
              const vbuf = vizBufferRef.current;
              vbuf.push(
                ...samples.map((s) => ({ I: s.I, Q: s.Q }) as DSPSample),
              );
              const maxVizSamples = fftSize * 64;
              if (vbuf.length > maxVizSamples) {
                vbuf.splice(0, vbuf.length - maxVizSamples);
              }

              // Throttle UI updates to ~60fps
              const now = performance.now();
              if (now - (lastVizUpdateRef.current || 0) > 16) {
                lastVizUpdateRef.current = now;
                const mark = "viz-push-start";
                performanceMonitor.mark(mark);
                setVizSamples(vbuf.slice());
                performanceMonitor.measure("viz-push", mark);
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
                  gainNode.gain.value = volume / 100;
                  src.connect(gainNode).connect(ctx.destination);
                  src.start();
                  window.dbgAudioCtxTime = ctx.currentTime;
                  window.dbgLastAudioLength = audioBuffer.length;
                  try {
                    const data = audioBuffer.getChannelData(0);
                    let maxAbs = 0;
                    for (const sample of data) {
                      const v = Math.abs(sample);
                      if (v > maxAbs) {
                        maxAbs = v;
                      }
                    }
                    window.dbgAudioClipping = maxAbs >= 0.98;
                  } catch {
                    // ignore
                  }
                  window.dbgLastAudioAt = performance.now();
                }
              }
            } catch (e) {
              console.error("Error in receive callback", e);
            }
          },
          {
            sampleRate,
            centerFrequency: frequency,
            bandwidth: 2_500_000,
            lnaGain,
            ampEnabled,
          },
        )
        .catch((err: unknown) => {
          console.error("Receive failed", err);
          setIsReceiving(false);
          setStatusMsg(
            err instanceof Error
              ? `Start failed: ${err.message}`
              : "Start failed",
          );
          window.dbgReceiving = false;
        });
      setStatusMsg("Receiving started");
      window.dbgReceiving = true;
    } catch (err) {
      console.error("Start failed", err);
      setIsReceiving(false);
      setStatusMsg(
        err instanceof Error ? `Start failed: ${err.message}` : "Start failed",
      );
    }
  }, [
    ampEnabled,
    device,
    ensureAudio,
    fftSize,
    frequency,
    lnaGain,
    sampleRate,
    tuneDevice,
    volume,
    scanner,
  ]);

  const handleStop = useCallback(async (): Promise<void> => {
    try {
      if (device?.isReceiving()) {
        await device.stopRx();
      }
    } finally {
      setIsReceiving(false);
      setStatusMsg("Reception stopped");
      window.dbgReceiving = false;
      vizBufferRef.current = [];
      setVizSamples([]);
    }
  }, [device]);

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
        if (device?.isReceiving()) {
          void device.stopRx().catch((e: unknown) => {
            console.warn("Stop on unmount failed", e);
          });
        }
      } catch (e) {
        console.warn("Error during unmount cleanup", e);
      }
    };
  }, [device]);

  return (
    <main
      className="page-container"
      role="main"
      aria-labelledby="monitor-heading"
      id="main-content"
      tabIndex={-1}
    >
      <h2 id="monitor-heading">Monitor - Live Signal Reception</h2>
      <p role="status" aria-live="polite" style={{ marginBottom: 8 }}>
        {statusMsg}
      </p>

      <section aria-label="Spectrum Visualization">
        <h3>Spectrum &amp; Waterfall</h3>
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

      {/* Minimal sections for tests and accessibility parity */}
      <section aria-label="Audio Controls">
        <h3>Audio Controls</h3>
        <p>
          Configure demodulation and audio output when a device is connected.
        </p>
      </section>

      <section aria-label="Signal Information">
        <h3>Signal Information</h3>
        <p>Live signal metadata and RDS/PS info will appear here.</p>
      </section>

      {/* Bottom status bar */}
      <div style={{ marginTop: 12 }}>
        <StatusBar
          renderTier={renderTier}
          fps={fps}
          sampleRate={sampleRate}
          bufferHealth={bufferHealth}
          bufferDetails={{
            currentSamples: vizBufferRef.current.length,
            maxSamples: fftSize * 64,
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
          audioClipping={Boolean(window.dbgAudioClipping)}
        />
      </div>
    </main>
  );
}
