import React, { useCallback, useMemo, useRef, useState } from "react";
import { useDevice } from "../contexts/DeviceContext";
import { useFrequency } from "../contexts/FrequencyContext";
import {
  useFrequencyScanner,
  type ActiveSignal,
} from "../hooks/useFrequencyScanner";
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

// Expose minimal diagnostics on window for automated tests
declare global {
  interface Window {
    dbgAudioCtx?: AudioContext;
    dbgAudioCtxTime?: number;
    dbgLastAudioLength?: number;
    dbgReceiving?: boolean;
  }
}

/**
 * Monitor page - Primary workspace for real-time spectrum monitoring
 *
 * Purpose: Real-time spectrum+waterfall with VFO control for tuning and listening
 * Dependencies: ADR-0003, ADR-0015 (Visualization), ADR-0008 (Audio), ADR-0012 (FFT Worker Pool)
 *
 * Features implemented:
 * - SpectrumCanvas with waterfall
 * - VFO control for tuning
 * - S-Meter display
 * - AGC/Squelch controls
 * - Mode selector (AM, FM, USB, LSB, etc.)
 * - Click-to-tune, pan/zoom, marker placement
 * - Quick record toggle
 * - Bookmark current frequency
 *
 * Performance targets:
 * - 60 FPS at 8192 FFT bins
 * - <150ms click-to-audio latency (PRD)
 *
 * Accessibility:
 * - Keyboard tuning (arrow keys, +/- for gain)
 * - Focus order and proper announcements
 * - Screen reader labels for frequency/mode changes (ADR-0017)
 */

type DemodMode = "AM" | "FM" | "USB" | "LSB" | "CW" | "NFM" | "WFM";

// Explicit conversion to DSPSample for visualization buffers to avoid
// relying on structural typing casts.
function convertIQToDSP(samples: IQSample[]): DSPSample[] {
  return samples.map((s) => ({ I: s.I, Q: s.Q }) as DSPSample);
}

function Monitor(): React.JSX.Element {
  const { device, initialize, isCheckingPaired } = useDevice();

  // UI state
  const { frequencyHz: frequency, setFrequencyHz: setFrequency } =
    useFrequency();
  const [mode, setMode] = useState<DemodMode>("FM");
  const [volume, setVolume] = useState(50);
  const [squelch, setSquelch] = useState(0);
  const [agcEnabled, setAgcEnabled] = useState(true);
  const [signalStrength, setSignalStrength] = useState(-80);
  const [sampleRate, setSampleRate] = useState<number>(2_000_000); // 2 MSPS
  const [lnaGain, setLnaGain] = useState<number>(16); // dB
  const [ampEnabled, setAmpEnabled] = useState<boolean>(false);
  const [isReceiving, setIsReceiving] = useState(false);
  // Mirror receiving state in a ref for reliable unmount cleanup
  const isReceivingRef = useRef<boolean>(false);
  React.useEffect(() => {
    isReceivingRef.current = isReceiving;
  }, [isReceiving]);
  const [statusMsg, setStatusMsg] = useState<string>("");
  // Visualization controls
  const [fftSize, setFftSize] = useState<number>(2048);
  const [showWaterfall, setShowWaterfall] = useState<boolean>(false);
  // Visualization mode selector for E2E and UX: fft | waterfall | spectrogram
  const [vizMode, setVizMode] = useState<"fft" | "waterfall" | "spectrogram">(
    "fft",
  );
  // Optional spectrogram palette
  const [colorMap, setColorMap] = useState<
    "viridis" | "inferno" | "turbo" | "gray"
  >("viridis");
  // Optional manual dB range; undefined means auto
  const [dbMin, setDbMin] = useState<number | undefined>(undefined);
  const [dbMax, setDbMax] = useState<number | undefined>(undefined);

  // Frequency scanner integration
  const [foundSignals, setFoundSignals] = useState<ActiveSignal[]>([]);
  const scanner = useFrequencyScanner(device, (signal) => {
    // Update or insert signal by frequency
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
  // Visualization buffers (ring-buffered)
  // Use DSPSample typing directly to avoid unsafe casts when rendering FFTChart
  const vizBufferRef = useRef<DSPSample[]>([]);
  const [vizSamples, setVizSamples] = useState<DSPSample[]>([]);
  const lastVizUpdateRef = useRef<number>(0);

  // SpectrogramProcessor for optimized spectrogram computation
  const spectrogramProcessorRef = useRef<SpectrogramProcessor | null>(null);

  const canStart = useMemo(
    () => Boolean(device && device.isOpen() && !isReceiving),
    [device, isReceiving],
  );

  const didAutoStartRef = useRef<boolean>(false);

  const ensureAudio = useCallback((): void => {
    audioCtxRef.current ??= new AudioContext();
    processorRef.current ??= new AudioStreamProcessor(sampleRate);
    // Expose for automated testing/diagnostics
    window.dbgAudioCtx = audioCtxRef.current;
  }, [sampleRate]);

  // Mirror volume for global status bar diagnostics
  React.useEffect(() => {
    window.dbgVolume = volume;
  }, [volume]);

  // Simulate signal strength updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSignalStrength(-100 + Math.random() * 60);
    }, 500);
    return (): void => clearInterval(interval);
  }, []);

  // Memoized mapping of found signals for overlay
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

  // Initialize SpectrogramProcessor with optimal settings
  if (!spectrogramProcessorRef.current) {
    const overlap = 0.5;
    const hopSize = Math.floor(fftSize * (1 - overlap));
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

  // Build spectrogram frames using optimized processor
  const spectroFrames = useMemo(() => {
    if (!spectrogramProcessorRef.current || vizSamples.length < fftSize) {
      return [];
    }

    // Update processor config if FFT size changed
    const currentConfig = spectrogramProcessorRef.current.getConfig();
    if (currentConfig.fftSize !== fftSize || currentConfig.sampleRate !== sampleRate) {
      const overlap = 0.5;
      const hopSize = Math.floor(fftSize * (1 - overlap));
      spectrogramProcessorRef.current.updateConfig({
        fftSize,
        hopSize,
        sampleRate,
      });
    }

    // Process samples through optimized processor
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
      // Use nearest valid LNA step (adapter will adjust if needed)
      await device.setLNAGain(lnaGain);
      await device.setAmpEnable(ampEnabled);
      // Use a conservative baseband filter if supported
      if (device.setBandwidth) {
        // HackRF supports >= 1.75 MHz, choose 2.5 MHz for FM broadcast
        await device.setBandwidth(2_500_000);
      }
      await device.setFrequency(frequency);
      setStatusMsg(
        `Tuned to ${formatFrequency(frequency)} @ ${(sampleRate / 1e6).toFixed(2)} MSPS`,
      );
    } catch (err) {
      console.error("Tune failed", err);
      // Attempt fast recovery once, then retry tune sequence
      try {
        if (typeof device.fastRecovery === "function") {
          setStatusMsg("Recovering device after transfer error…");
          await device.fastRecovery();
        } else {
          // Fallback: reopen if no fastRecovery implementation
          await device.open();
        }
        // Retry tune steps once
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
      // Propagate error so callers (e.g., handleStart) can abort start flow
      throw err;
    }
  }, [ampEnabled, device, frequency, lnaGain, sampleRate]);

  const handleStart = useCallback(async (): Promise<void> => {
    if (!device) {
      setStatusMsg("No device connected");
      return;
    }
    try {
      // Ensure any active scan is stopped before starting live reception
      scanner.stopScan();
      ensureAudio();
      await tuneDevice();
      iqBufferRef.current = [];
      setIsReceiving(true);

      // Start streaming without awaiting to avoid blocking UI.
      // Pass configuration to ensure correct order (sample rate first) and attach
      // an error handler to avoid unhandled promise rejections.
      void device
        .receive(
          (dataView) => {
            try {
              const samples = device.parseSamples(dataView);
              // Accumulate a modest chunk before demodulating for smoother audio
              const buffer = iqBufferRef.current;
              buffer.push(...samples);

              // Feed visualization ring buffer
              const vbuf = vizBufferRef.current;
              vbuf.push(...convertIQToDSP(samples));
              // Trim to a reasonable window for spectrogram computation
              const maxVizSamples = fftSize * 64; // 64 frames worth of samples
              if (vbuf.length > maxVizSamples) {
                vbuf.splice(0, vbuf.length - maxVizSamples);
              }
              // Throttle UI updates to ~60fps for smoother visuals on Canvas2D
              const now = performance.now();
              if (now - (lastVizUpdateRef.current || 0) > 16) {
                lastVizUpdateRef.current = now;
                // Telemetry: record cadence of visualization sample pushes
                const mark = "viz-push-start";
                performanceMonitor.mark(mark);
                // Create a fresh array reference to trigger React updates
                setVizSamples(vbuf.slice());
                performanceMonitor.measure("viz-push", mark);
              }

              // Buffer chunk size tuned for ~25ms at 2 MSPS:
              // 50_000 samples / 2_000_000 samples/sec = 0.025s (25ms)
              // Balances low latency with smooth playback scheduling.
              const MIN_IQ_SAMPLES = 50_000;
              if (buffer.length >= MIN_IQ_SAMPLES) {
                const chunk = buffer.splice(0, MIN_IQ_SAMPLES);
                const proc = processorRef.current;
                const ctx = audioCtxRef.current;
                if (proc && ctx) {
                  const { audioBuffer } = proc.extractAudio(
                    chunk,
                    mode === "AM" ? DemodulationType.AM : DemodulationType.FM,
                    { sampleRate: 48_000, channels: 1 },
                  );
                  if (ctx.state === "suspended") {
                    void ctx.resume();
                  }
                  const src = ctx.createBufferSource();
                  src.buffer = audioBuffer;
                  // Volume: simple gain node for now
                  const gainNode = ctx.createGain();
                  gainNode.gain.value = volume / 100;
                  src.connect(gainNode).connect(ctx.destination);
                  src.start();
                  window.dbgAudioCtxTime = ctx.currentTime;
                  window.dbgLastAudioLength = audioBuffer.length;
                  // Surface recent playback and basic clipping flag for status bar
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
    mode,
    sampleRate,
    tuneDevice,
    volume,
    scanner,
  ]);

  const handleStop = useCallback(async (): Promise<void> => {
    if (!device) {
      return;
    }
    try {
      await device.stopRx();
      setIsReceiving(false);
      setStatusMsg("Reception stopped");
      window.dbgReceiving = false;
      // Reset visualization buffers
      vizBufferRef.current = [];
      setVizSamples([]);
    } catch (err) {
      console.error("Stop failed", err);
      setStatusMsg(
        err instanceof Error ? `Stop failed: ${err.message}` : "Stop failed",
      );
    }
  }, [device]);

  // Auto-start reception if a previously paired device is already connected/opened.
  // We only do this once per session to avoid surprising re-starts after a manual stop.
  React.useEffect(() => {
    // Wait until paired-device check is complete to avoid racing initial state.
    if (isCheckingPaired) {
      return;
    }
    if (!device) {
      return;
    }
    try {
      const open = device.isOpen();
      if (
        open &&
        !isReceiving &&
        !didAutoStartRef.current &&
        scanner.state === "idle"
      ) {
        didAutoStartRef.current = true;
        // Fire and forget; errors will be reflected into status message by handleStart.
        void handleStart();
      }
    } catch {
      // If device adapter throws, just skip auto-start.
      // This avoids blocking UI on edge adapters without isOpen semantics.
    }
  }, [device, isReceiving, handleStart, isCheckingPaired, scanner.state]);

  // Ensure RX is stopped when leaving the page to avoid lingering streams and update loops
  React.useEffect((): (() => void) => {
    return (): void => {
      try {
        if (device && (isReceivingRef.current || device.isReceiving())) {
          // Fire and forget; avoid blocking unmount
          void device.stopRx().catch((e: unknown) => {
            console.warn("Stop on unmount failed", e);
          });
        }
      } catch (e) {
        // Best-effort cleanup
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

      <section aria-label="Spectrum Visualization">
        <h3>Spectrum &amp; Waterfall</h3>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <label>
            Visualization mode:
            <select
              aria-label="Visualization mode"
              value={vizMode}
              onChange={(e): void =>
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
              onChange={(e): void => setFftSize(parseInt(e.target.value, 10))}
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
                onChange={(e): void => setShowWaterfall(e.target.checked)}
                aria-label="Toggle waterfall visualization"
                style={{ marginLeft: 8, marginRight: 4 }}
              />
              Show Waterfall (improves performance when off)
            </label>
          )}
          {/* Inline, lightweight scan controls for quick discovery */}
          <div
            role="group"
            aria-label="Frequency scanner controls"
            style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
          >
            <button
              onClick={(): void => {
                // Stop RX to let scanner control the device stream
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
              onClick={(): void => scanner.pauseScan()}
              disabled={scanner.state !== "scanning"}
              aria-label="Pause scan"
            >
              ⏸ Pause
            </button>
            <button
              onClick={(): void => scanner.resumeScan()}
              disabled={scanner.state !== "paused"}
              aria-label="Resume scan"
            >
              ▶ Resume
            </button>
            <button
              onClick={(): void => {
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
                onChange={(e): void =>
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
              onTune={(fHz): void => {
                // Snap to nearest 1 kHz for device friendliness
                const snapped = Math.round(fHz / 1_000) * 1_000;
                setFrequency(snapped);
                // Retune live if device is present
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
                    .catch((err: unknown) => {
                      console.warn("Quick tune failed", err);
                      // Fallback to full tune flow
                      void tuneDevice();
                    });
                }
              }}
            />
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {/* Spectrogram/Waterfall modes */}
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
            {/* Minimal controls for color map and range when in spectrogram modes */}
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
                  onChange={(e): void =>
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
                  onChange={(e): void =>
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
                  onChange={(e): void =>
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
                      onClick={(): void => {
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

      <section aria-label="Device Controls">
        <h3>Device Controls</h3>
        {/* Always-available frequency input for keyboard interaction */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "0.5rem",
          }}
        >
          <label>
            Frequency (MHz):
            <input
              type="number"
              step="0.05"
              min={0}
              value={(frequency / 1e6).toFixed(3)}
              onChange={(e): void => {
                const mhz = parseFloat(e.target.value);
                if (!Number.isNaN(mhz)) {
                  setFrequency(Math.round(mhz * 1e6));
                }
              }}
              style={{ marginLeft: "0.5rem", width: 120 }}
              aria-label="Frequency in megahertz"
            />
          </label>
        </div>

        {!device && !isCheckingPaired && (
          <div>
            <p>No device connected.</p>
            <button
              aria-label="Connect SDR device"
              onClick={(): void => {
                void initialize();
              }}
            >
              Connect Device
            </button>
          </div>
        )}
        {isCheckingPaired && <p>Checking for previously paired devices…</p>}
        {device && (
          <div className="device-controls">
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {/* Frequency input moved above to be always available */}
              <label>
                Sample Rate (MSPS):
                <select
                  value={sampleRate}
                  onChange={(e): void =>
                    setSampleRate(parseInt(e.target.value, 10))
                  }
                  style={{ marginLeft: "0.5rem" }}
                >
                  {[2e6, 4e6, 8e6, 10e6, 12_500_000, 16e6, 20e6].map((sr) => (
                    <option key={sr} value={sr}>
                      {(sr / 1e6).toFixed(2)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                LNA Gain (dB):
                <input
                  type="number"
                  step={8}
                  min={0}
                  max={40}
                  value={lnaGain}
                  onChange={(e): void =>
                    setLnaGain(parseInt(e.target.value, 10))
                  }
                  style={{ marginLeft: "0.5rem", width: 80 }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={ampEnabled}
                  onChange={(e): void => setAmpEnabled(e.target.checked)}
                />
                RF Amp
              </label>
              <button
                onClick={(): void => void tuneDevice()}
                aria-label="Tune device"
              >
                Tune
              </button>
              <button
                onClick={(): void => void handleStart()}
                disabled={!canStart}
                aria-label="Start reception"
              >
                ▶ Start
              </button>
              <button
                onClick={(): void => void handleStop()}
                disabled={!isReceiving}
                aria-label="Stop reception"
              >
                ■ Stop
              </button>
            </div>
            <p role="status" aria-live="polite" style={{ marginTop: "0.5rem" }}>
              {statusMsg}
            </p>
          </div>
        )}
      </section>

      <section aria-label="Audio Controls">
        <h3>Audio</h3>
        <div>
          <label>
            Volume: {volume}%
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e): void => setVolume(parseInt(e.target.value, 10))}
              style={{ marginLeft: "0.5rem" }}
            />
          </label>
        </div>
        <div>
          <label>
            Squelch: {squelch} dB
            <input
              type="range"
              min="-100"
              max="0"
              value={squelch}
              onChange={(e): void => setSquelch(parseInt(e.target.value, 10))}
              style={{ marginLeft: "0.5rem" }}
            />
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={agcEnabled}
              onChange={(e): void => setAgcEnabled(e.target.checked)}
            />
            AGC (Automatic Gain Control)
          </label>
        </div>
        <div>
          <label>
            Mode:
            <select
              value={mode}
              onChange={(e): void => setMode(e.target.value as DemodMode)}
              style={{ marginLeft: "0.5rem" }}
            >
              <option value="AM">AM</option>
              <option value="FM">FM</option>
              <option value="NFM">NFM (Narrowband FM)</option>
              <option value="WFM">WFM (Wideband FM)</option>
              <option value="USB">USB</option>
              <option value="LSB">LSB</option>
              <option value="CW">CW</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-label="Signal Information">
        <h3>Signal Information</h3>
        <div>
          <strong>Frequency:</strong> {(frequency / 1e6).toFixed(3)} MHz
        </div>
        <div>
          <strong>Signal Strength (S-Meter):</strong>{" "}
          {signalStrength.toFixed(1)} dBm
        </div>
        <div>
          <strong>Mode:</strong> {mode}
        </div>
        <div>
          <strong>Bandwidth:</strong>{" "}
          {mode === "WFM"
            ? "200 kHz"
            : mode === "NFM" || mode === "FM"
              ? "12.5 kHz"
              : "3 kHz"}
        </div>
      </section>

      <aside aria-label="Quick Actions" style={{ marginTop: "1rem" }}>
        <h3>Quick Actions</h3>
        <button>📍 Bookmark Frequency</button>
        <button style={{ marginLeft: "0.5rem" }}>⏺ Record</button>
        <button style={{ marginLeft: "0.5rem" }}>📊 Add Marker</button>
      </aside>
    </main>
  );
}

export default Monitor;
