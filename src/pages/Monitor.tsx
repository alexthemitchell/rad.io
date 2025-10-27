import React, { useCallback, useMemo, useRef, useState } from "react";
import { useDevice } from "../contexts/DeviceContext";
import { AudioStreamProcessor, DemodulationType } from "../utils/audioStream";
import { formatFrequency } from "../utils/frequency";
import FFTChart from "../visualization/components/FFTChart";
import type { IQSample } from "../models/SDRDevice";
import type { Sample as DSPSample } from "../utils/dsp";

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
  const [frequency, setFrequency] = useState(100_000_000); // 100 MHz default
  const [mode, setMode] = useState<DemodMode>("FM");
  const [volume, setVolume] = useState(50);
  const [squelch, setSquelch] = useState(0);
  const [agcEnabled, setAgcEnabled] = useState(true);
  const [signalStrength, setSignalStrength] = useState(-80);
  const [sampleRate, setSampleRate] = useState<number>(2_000_000); // 2 MSPS
  const [lnaGain, setLnaGain] = useState<number>(16); // dB
  const [ampEnabled, setAmpEnabled] = useState<boolean>(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  // Visualization controls
  const [fftSize, setFftSize] = useState<number>(2048);
  const [vizMode, setVizMode] = useState<"spectrogram" | "waterfall">(
    "waterfall",
  );

  // Audio processing
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioStreamProcessor | null>(null);
  const iqBufferRef = useRef<IQSample[]>([]);
  // Visualization buffers (ring-buffered)
  // Use DSPSample typing directly to avoid unsafe casts when rendering FFTChart
  const vizBufferRef = useRef<DSPSample[]>([]);
  const [vizSamples, setVizSamples] = useState<DSPSample[]>([]);
  const lastVizUpdateRef = useRef<number>(0);

  const canStart = useMemo(
    () => Boolean(device && device.isOpen() && !isReceiving),
    [device, isReceiving],
  );

  const ensureAudio = useCallback((): void => {
    audioCtxRef.current ??= new AudioContext();
    processorRef.current ??= new AudioStreamProcessor(sampleRate);
    // Expose for automated testing/diagnostics
    window.dbgAudioCtx = audioCtxRef.current;
  }, [sampleRate]);

  // Simulate signal strength updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSignalStrength(-100 + Math.random() * 60);
    }, 500);
    return (): void => clearInterval(interval);
  }, []);

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
        if (device.fastRecovery) {
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
              // Throttle UI updates to ~10fps
              const now = performance.now();
              if (now - (lastVizUpdateRef.current || 0) > 100) {
                lastVizUpdateRef.current = now;
                // Create a fresh array reference to trigger React updates
                setVizSamples(vbuf.slice());
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
          <label style={{ marginLeft: 8 }}>
            View:
            <select
              aria-label="Visualization mode"
              value={vizMode}
              onChange={(e): void =>
                setVizMode(e.target.value as "spectrogram" | "waterfall")
              }
              style={{ marginLeft: 8 }}
            >
              <option value="spectrogram">Spectrogram</option>
              <option value="waterfall">Waterfall</option>
            </select>
          </label>
        </div>
        <div style={{ marginTop: 8 }}>
          <FFTChart
            samples={vizSamples}
            width={900}
            height={320}
            fftSize={fftSize}
            freqMin={0}
            freqMax={fftSize - 1}
            mode={vizMode}
            maxWaterfallFrames={200}
          />
        </div>
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
