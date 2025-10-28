import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDevice } from "../contexts/DeviceContext";
import { renderTierManager } from "../lib/render/RenderTierManager";
import { formatFrequency } from "../utils/frequency";
import Spectrogram from "../visualization/components/Spectrogram";
import type { IQSample } from "../models/SDRDevice";
import {
  calculateSpectrogramRow,
  type Sample as DSPSample,
} from "../utils/dsp";
import StatusBar from "../components/StatusBar";
import { RenderTier } from "../types/rendering";
import { performanceMonitor } from "../utils/performanceMonitor";

declare global {
  interface Window {
    dbgReceiving?: boolean;
  }
}

const MAX_SAMPLES = 65536;
const DEFAULT_SAMPLE_RATE = 2_048_000;
const DEFAULT_FFT_SIZE = 4096;
const MAX_FRAMES = 200;

export default function Monitor(): React.JSX.Element {
  const { device, initialize, isCheckingPaired } = useDevice();

  // Local frequency state (context removed in current repo state)
  const [frequencyHz, setFrequencyHz] = useState<number>(100_000_000); // 100 MHz default

  const [viewMode, setViewMode] = useState<"waterfall" | "spectrogram">(
    "waterfall",
  );
  const [isReceiving, setIsReceiving] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("Idle");
  const [fftSize] = useState<number>(DEFAULT_FFT_SIZE);

  const [renderTier, setRenderTier] = useState<RenderTier>(() =>
    renderTierManager.getTier(),
  );
  useEffect(
    () => renderTierManager.subscribe((tier) => setRenderTier(tier)),
    [],
  );

  // Status bar metrics
  const [fps, setFps] = useState<number>(0);
  const [storageUsed, setStorageUsed] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<number>(0);
  const [bufferHealth, setBufferHealth] = useState<number>(100);

  const samplesRef = useRef<DSPSample[]>([]);
  const [fftData, setFftData] = useState<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(DEFAULT_SAMPLE_RATE);
  const receivingRef = useRef<boolean>(false);

  useEffect(() => {
    window.dbgReceiving = isReceiving;
  }, [isReceiving]);

  useEffect(() => {
    return (): void => {
      void (async (): Promise<void> => {
        try {
          if (device?.isReceiving()) {
            await device.stopRx();
          }
        } finally {
          receivingRef.current = false;
          window.dbgReceiving = false;
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update FPS every second
  useEffect(() => {
    const id = setInterval(() => {
      setFps(performanceMonitor.getFPS());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Poll Storage API every 5 seconds
  useEffect(() => {
    let cancelled = false;
    async function poll(): Promise<void> {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (navigator?.storage?.estimate) {
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
    const id = setInterval(() => {
      void poll();
    }, 5000);
    // initial fetch
    void poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Compute buffer health every second based on local sample buffer fill
  useEffect(() => {
    const id = setInterval(() => {
      const pct = Math.max(
        0,
        Math.min(
          100,
          Math.round((samplesRef.current.length / MAX_SAMPLES) * 100),
        ),
      );
      setBufferHealth(pct);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const appendSamples = useCallback((iq: IQSample[]): void => {
    if (iq.length === 0) {
      return;
    }
    const need = Math.min(iq.length, MAX_SAMPLES);
    const start = Math.max(0, iq.length - need);
    const nextChunk = iq
      .slice(start, start + need)
      .map((s) => ({ I: s.I, Q: s.Q }));
    const prev = samplesRef.current;
    const combined =
      prev.length + nextChunk.length > MAX_SAMPLES
        ? prev
            .slice(prev.length + nextChunk.length - MAX_SAMPLES)
            .concat(nextChunk)
        : prev.concat(nextChunk);
    samplesRef.current = combined;

    // Opportunistically compute a single spectrogram row when we have enough samples
    if (combined.length >= DEFAULT_FFT_SIZE) {
      try {
        const row = calculateSpectrogramRow(
          combined.slice(combined.length - DEFAULT_FFT_SIZE),
          DEFAULT_FFT_SIZE,
        );
        setFftData((prevRows) => {
          const next =
            prevRows.length >= MAX_FRAMES
              ? prevRows.slice(prevRows.length - (MAX_FRAMES - 1)).concat([row])
              : prevRows.concat([row]);
          return next;
        });
      } catch (err) {
        console.warn("spectrogram row calc failed", err);
      }
    }
  }, []);

  const handleStart = useCallback(async (): Promise<void> => {
    try {
      if (!device) {
        await initialize();
      }
      if (!device) {
        setStatus("No device connected");
        return;
      }
      if (!device.isOpen()) {
        await device.open();
      }

      const sr = await device.getSampleRate().catch(() => DEFAULT_SAMPLE_RATE);
      sampleRateRef.current = sr > 0 ? sr : DEFAULT_SAMPLE_RATE;

      await device.setFrequency(frequencyHz);
      await device.setSampleRate(sampleRateRef.current);
      if (device.isReceiving()) {
        await device.stopRx();
      }

      samplesRef.current = [];
      setFftData([]);
      receivingRef.current = true;
      setIsReceiving(true);
      setStatus(
        `Receiving started at ${formatFrequency(frequencyHz)} • ${(sampleRateRef.current / 1e6).toFixed(3)} MSPS`,
      );
      window.dbgReceiving = true;

      await device.receive(
        (data: DataView) => {
          if (!receivingRef.current) {
            return;
          }
          try {
            const iq = device.parseSamples(data);
            appendSamples(iq);
          } catch (err) {
            console.warn("IQ parse error", err);
          }
        },
        {
          centerFrequency: frequencyHz,
          sampleRate: sampleRateRef.current,
        },
      );
    } catch (err) {
      console.error("Failed to start reception", err);
      setIsReceiving(false);
      receivingRef.current = false;
      setStatus("Failed to start reception");
      window.dbgReceiving = false;
    }
  }, [device, frequencyHz, initialize, appendSamples]);

  const handleStop = useCallback(async (): Promise<void> => {
    try {
      if (device?.isReceiving()) {
        await device.stopRx();
      }
    } finally {
      receivingRef.current = false;
      setIsReceiving(false);
      setStatus("Reception stopped");
      window.dbgReceiving = false;
    }
  }, [device]);

  // Top-level live region shows only high-level status; detailed metrics are in the bottom StatusBar

  return (
    <main className="container" aria-labelledby="monitor-heading">
      <h2 id="monitor-heading" className="visually-hidden">
        Monitor
      </h2>

      <section aria-label="Controls" className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Live Monitor</h3>
            <p className="card-subtitle">Tune, start/stop, and view spectrum</p>
          </div>
        </div>
        <div className="card-content">
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label>
              Frequency (MHz):
              <input
                type="number"
                step={0.05}
                min={0}
                value={(frequencyHz / 1e6).toFixed(3)}
                onChange={(e) => {
                  const mhz = parseFloat(e.target.value);
                  if (!Number.isNaN(mhz)) {
                    setFrequencyHz(Math.round(mhz * 1e6));
                  }
                }}
                className="control-input"
                style={{ marginLeft: 6, width: 140 }}
                aria-label="Frequency in megahertz"
              />
            </label>

            <label htmlFor="viz-mode">Visualization mode</label>
            <select
              id="viz-mode"
              className="control-input"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
            >
              <option value="waterfall">waterfall</option>
              <option value="spectrogram">spectrogram</option>
            </select>

            <button
              className="btn btn-primary"
              onClick={() => {
                void handleStart();
              }}
              aria-label="Start reception"
              disabled={isReceiving || isCheckingPaired}
            >
              ▶ Start
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                void handleStop();
              }}
              aria-label="Stop reception"
              disabled={!isReceiving}
            >
              ■ Stop
            </button>
          </div>

          <p role="status" aria-live="polite" style={{ marginTop: 8 }}>
            <span>{status}</span>
          </p>
        </div>
      </section>

      <section
        aria-label="Spectrum Visualization"
        className="card"
        style={{ marginTop: 12 }}
      >
        <div className="card-header">
          <h3 className="card-title">Spectrum</h3>
        </div>
        <div className="card-content">
          <Spectrogram
            fftData={fftData}
            width={750}
            height={400}
            freqMin={0}
            freqMax={fftSize}
            continueInBackground={false}
            mode={viewMode}
            maxWaterfallFrames={MAX_FRAMES}
          />
        </div>
      </section>
      {/* Bottom status bar */}
      <div style={{ marginTop: 12 }}>
        <StatusBar
          renderTier={renderTier}
          fps={fps}
          sampleRate={sampleRateRef.current}
          bufferHealth={bufferHealth}
          storageUsed={storageUsed}
          storageQuota={storageQuota}
          deviceConnected={Boolean(device)}
        />
      </div>
    </main>
  );
}
