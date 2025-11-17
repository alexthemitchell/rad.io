import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import Card from "../components/Card";
import DeviceControlBar from "../components/DeviceControlBar";
import { InfoBanner } from "../components/InfoBanner";
import InteractiveDSPPipeline from "../components/InteractiveDSPPipeline";
import PerformanceMetrics from "../components/PerformanceMetrics";
import { notify } from "../lib/notifications";
import { type ISDRDevice } from "../models/SDRDevice";
import Measurements from "../panels/Measurements";
import { useDevice } from "../store";
import { type Sample } from "../utils/dsp";
import { performanceMonitor } from "../utils/performanceMonitor";
import {
  IQConstellation,
  WaveformVisualizer,
  EyeDiagram,
} from "../visualization";
import type { MarkerRow } from "../components/MarkerTable";

/**
 * Type guard to check if an unknown value is a valid MarkerRow
 */
function isMarkerRow(value: unknown): value is MarkerRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "frequency" in value &&
    typeof (value as { frequency: unknown }).frequency === "number"
  );
}

/**
 * Asserts that an array contains only MarkerRow objects
 */
function assertMarkerRowArray(value: unknown): asserts value is MarkerRow[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected an array");
  }
  if (!value.every(isMarkerRow)) {
    throw new TypeError("Array contains invalid MarkerRow objects");
  }
}

const DEFAULT_MAX_BUFFER_SAMPLES = 32768;
const DEFAULT_UPDATE_INTERVAL_MS = 33; // ~30 FPS

function Analysis(): React.JSX.Element {
  const {
    primaryDevice: device,
    requestDevice,
    isCheckingPaired,
  } = useDevice();
  const [listening, setListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [frequency] = useState(100.3e6);
  const [deviceError, setDeviceError] = useState<Error | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [currentFPSMetric, setCurrentFPSMetric] = useState<number>(0);

  // Analysis controls
  const [isFrozen, setIsFrozen] = useState(false);
  const [updateIntervalMs, setUpdateIntervalMs] = useState<number>(
    DEFAULT_UPDATE_INTERVAL_MS,
  );
  const [maxBufferSamples, setMaxBufferSamples] = useState<number>(
    DEFAULT_MAX_BUFFER_SAMPLES,
  );
  const [renderInBackground, setRenderInBackground] = useState<boolean>(false);

  // Autosizing for visualizations
  const viz1Ref = useRef<HTMLDivElement | null>(null);
  const viz2Ref = useRef<HTMLDivElement | null>(null);
  const viz3Ref = useRef<HTMLDivElement | null>(null);
  const [viz1Width, setViz1Width] = useState<number>(750);
  const [viz2Width, setViz2Width] = useState<number>(750);
  const [viz3Width, setViz3Width] = useState<number>(750);

  const shouldStartOnConnectRef = useRef(false);

  const sampleBufferRef = useRef<Sample[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsLastUpdateRef = useRef<number>(0);
  const receivePromiseRef = useRef<Promise<void> | null>(null);

  // Announcements via unified notifications

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
    lastUpdateRef.current = 0;
    frameCountRef.current = 0;
    fpsLastUpdateRef.current = 0;
    cancelScheduledUpdate();
    setSamples([]);
    setCurrentFPSMetric(0);
  }, [cancelScheduledUpdate]);

  const scheduleVisualizationUpdate = useCallback((): void => {
    if (isFrozen) {
      return;
    }
    if (typeof requestAnimationFrame !== "function") {
      setSamples([...sampleBufferRef.current]);
      return;
    }

    if (rafIdRef.current !== null) {
      return;
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setSamples([...sampleBufferRef.current]);

      // Track FPS
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - fpsLastUpdateRef.current;

      // Update FPS counter every second
      if (elapsed >= 1000) {
        const fps = (frameCountRef.current / elapsed) * 1000;
        setCurrentFPSMetric(Math.round(fps));
        frameCountRef.current = 0;
        fpsLastUpdateRef.current = now;
      }
    });
  }, [isFrozen]);

  const handleSampleChunk = useCallback(
    (chunk: Sample[]): void => {
      if (chunk.length === 0) {
        return;
      }

      const markName = `pipeline-chunk-start-${
        typeof performance !== "undefined" ? performance.now() : Date.now()
      }`;
      performanceMonitor.mark(markName);

      const combined = sampleBufferRef.current.length
        ? sampleBufferRef.current.concat(chunk)
        : chunk.slice();
      const limit = Math.max(1024, Math.floor(maxBufferSamples));
      const trimmed =
        combined.length > limit
          ? combined.slice(combined.length - limit)
          : combined;
      sampleBufferRef.current = trimmed;

      performanceMonitor.measure("pipeline-processing", markName);

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (!isFrozen && now - lastUpdateRef.current >= updateIntervalMs) {
        lastUpdateRef.current = now;
        scheduleVisualizationUpdate();
      }
    },
    [scheduleVisualizationUpdate, isFrozen, updateIntervalMs, maxBufferSamples],
  );

  const beginDeviceStreaming = useCallback(
    async (activeDevice: ISDRDevice): Promise<void> => {
      clearVisualizationState();
      setListening(true);
      setDeviceError(null);
      notify({
        message: "Started receiving radio signals for analysis",
        sr: "polite",
        visual: true,
        tone: "success",
      });

      try {
        await activeDevice.setSampleRate(2048000);
        await activeDevice.setFrequency(frequency);
      } catch (err) {
        console.error("Analysis: Failed to configure device", err, {
          requestedSampleRate: 2048000,
          requestedFrequency: frequency,
          supportedRates: activeDevice.getCapabilities().supportedSampleRates,
        });
        setDeviceError(
          err instanceof Error ? err : new Error("Failed to configure device"),
        );
      }

      const receivePromise = activeDevice
        .receive((data) => {
          const parsed = activeDevice.parseSamples(data) as Sample[];
          handleSampleChunk(parsed);
        })
        .catch((err: unknown) => {
          console.error("Analysis: Device streaming failed", err, {
            errorType: err instanceof Error ? err.name : typeof err,
          });
          setDeviceError(
            err instanceof Error ? err : new Error("Failed to receive data"),
          );
          notify({
            message: "Failed to receive radio signals",
            sr: "assertive",
            visual: true,
            tone: "error",
          });
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
    [clearVisualizationState, handleSampleChunk, frequency],
  );

  // Handle device connection
  const handleConnect = useCallback(async (): Promise<void> => {
    if (isInitializing) {
      return;
    }

    shouldStartOnConnectRef.current = false;
    setIsInitializing(true);

    try {
      await requestDevice();
      setDeviceError(null);
      notify({
        message: "SDR device connected",
        sr: "polite",
        visual: true,
        tone: "success",
      });
    } catch (err) {
      console.error(err);
      setDeviceError(
        err instanceof Error ? err : new Error("Failed to connect device"),
      );
      notify({
        message: "Failed to connect device",
        sr: "assertive",
        visual: true,
        tone: "error",
      });
    } finally {
      setIsInitializing(false);
    }
  }, [requestDevice, isInitializing]);

  // Handle start reception
  const startListening = useCallback(async (): Promise<void> => {
    if (listening) {
      return;
    }

    if (!device) {
      shouldStartOnConnectRef.current = true;
      await handleConnect();
      return;
    }

    shouldStartOnConnectRef.current = false;
    await beginDeviceStreaming(device);
  }, [device, listening, handleConnect, beginDeviceStreaming]);

  // Handle device reset
  const handleResetDevice = useCallback(async (): Promise<void> => {
    if (!device || isResetting) {
      return;
    }

    setIsResetting(true);

    try {
      console.warn("Analysis: Attempting software reset");
      await device.reset();
      setDeviceError(null);
      notify({
        message: "Device reset successful",
        sr: "polite",
        visual: true,
        tone: "success",
      });
      console.warn("Analysis: Reset successful");
    } catch (error) {
      console.error("Analysis: Reset failed:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDeviceError(new Error(`Reset failed: ${errorMsg}`));
      notify({
        message: "Device reset failed",
        sr: "assertive",
        visual: true,
        tone: "error",
      });
    } finally {
      setIsResetting(false);
    }
  }, [device, isResetting]);

  // Auto-start reception after connection if requested
  useEffect((): void => {
    if (!device || !shouldStartOnConnectRef.current) {
      return;
    }
    shouldStartOnConnectRef.current = false;
    void beginDeviceStreaming(device);
  }, [device, beginDeviceStreaming]);

  useEffect((): (() => void) => {
    return (): void => {
      cancelScheduledUpdate();
    };
  }, [cancelScheduledUpdate]);

  const _stopListening = useCallback(async (): Promise<void> => {
    if (device?.isReceiving()) {
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
        // Errors already handled
      }
      receivePromiseRef.current = null;
    }

    cancelScheduledUpdate();
    setListening(false);
    notify({
      message: "Stopped receiving radio signals",
      sr: "polite",
      visual: true,
      tone: "info",
    });
  }, [cancelScheduledUpdate, device]);

  // Utility actions
  const handleClear = useCallback((): void => {
    clearVisualizationState();
  }, [clearVisualizationState]);

  const handleSnapshotCSV = useCallback((): void => {
    try {
      const rows = sampleBufferRef.current
        .map((s) => `${s.I},${s.Q}`)
        .join("\n");
      const header = "I,Q\n";
      const blob = new Blob([header, rows], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `iq-snapshot-${Math.min(
        sampleBufferRef.current.length,
        maxBufferSamples,
      )}-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify({
        message: "Exported CSV snapshot of current IQ buffer",
        sr: "polite",
        visual: true,
        tone: "success",
      });
    } catch (e) {
      console.error("CSV export failed", e);
      notify({
        message: "CSV export failed",
        sr: "assertive",
        visual: true,
        tone: "error",
      });
    }
  }, [maxBufferSamples]);

  // Keyboard shortcuts: F = freeze, E = export
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "SELECT")
      ) {
        return;
      }
      if (e.key.toLowerCase() === "f") {
        setIsFrozen((v) => !v);
      } else if (e.key.toLowerCase() === "e") {
        handleSnapshotCSV();
      }
    };
    window.addEventListener("keydown", onKey);
    return (): void => window.removeEventListener("keydown", onKey);
  }, [handleSnapshotCSV]);

  // Autosize: observe visualization containers
  useLayoutEffect(() => {
    const update = (
      ref: React.RefObject<HTMLElement | null>,
      set: (w: number) => void,
    ): void => {
      const el = ref.current;
      if (!el) {
        return;
      }
      const box = el.getBoundingClientRect();
      set(Math.max(320, Math.floor(box.width)));
    };
    const ro = new ResizeObserver(() => {
      update(viz1Ref, setViz1Width);
      update(viz2Ref, setViz2Width);
      update(viz3Ref, setViz3Width);
    });
    const els = [viz1Ref.current, viz2Ref.current, viz3Ref.current].filter(
      Boolean,
    ) as HTMLElement[];
    for (const el of els) {
      ro.observe(el);
    }
    // Prime sizes
    update(viz1Ref, setViz1Width);
    update(viz2Ref, setViz2Width);
    update(viz3Ref, setViz3Width);
    return (): void => ro.disconnect();
  }, []);

  // Shared markers persisted by SpectrumExplorer
  const [sharedMarkers, setSharedMarkers] = useState<MarkerRow[]>([]);
  useEffect((): (() => void) => {
    let cancelled = false;
    const MARKERS_KEY = "viz.markers";
    const load = (): void => {
      try {
        const raw = window.localStorage.getItem(MARKERS_KEY);
        if (!raw || cancelled) {
          return;
        }
        const parsed: unknown = JSON.parse(raw);
        // Validate using type guard and assertion
        assertMarkerRowArray(parsed);
        setSharedMarkers(parsed);
      } catch {
        // ignore - invalid data or parsing error
      }
    };
    load();
    const id = window.setInterval(load, 5000);
    return (): void => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {null}

      <main id="main-content" role="main">
        {/* Advanced Feature Label */}
        <InfoBanner
          variant="advanced"
          title="🔬 Advanced Analysis Tools"
          role="note"
          className="info-banner-compact"
        >
          <p className="info-banner-footer info-banner-footer-small">
            This page provides deep signal analysis for experienced users.{" "}
            <strong>New to ATSC?</strong> Start with{" "}
            <a href="/scanner">Scanner (press 2)</a> to find channels, then{" "}
            <a href="/atsc-player">ATSC Player (press 6)</a> to watch TV.
          </p>
        </InfoBanner>

        <DeviceControlBar
          device={device}
          listening={listening}
          isInitializing={isInitializing}
          isCheckingPaired={isCheckingPaired}
          deviceError={deviceError}
          frequency={frequency}
          onConnect={handleConnect}
          onStartReception={startListening}
          onStopReception={_stopListening}
          onResetDevice={handleResetDevice}
          isResetting={isResetting}
          showConnect={false}
        />

        <Card
          title="Signal Analysis"
          subtitle="Deep dive into DSP processing and signal characteristics"
        >
          {!device ? (
            <div className="empty-state">
              <p>
                No device connected. Use the Status Bar to connect your SDR
                device.
              </p>
            </div>
          ) : !listening ? (
            <div className="info-message">
              <p>
                Click &quot;Start Reception&quot; above to begin receiving and
                analyzing signal data.
              </p>
            </div>
          ) : (
            <div className="info-message">
              <p>Receiving and analyzing signal data in real-time...</p>
            </div>
          )}

          {/* Analysis controls */}
          <div
            className="controls-panel"
            role="region"
            aria-label="Analysis controls"
          >
            <div className="control-group">
              <label className="control-label" htmlFor="freeze-toggle">
                Live view
              </label>
              <button
                id="freeze-toggle"
                className={`btn ${isFrozen ? "btn-secondary" : "btn-primary"}`}
                onClick={() => setIsFrozen((v) => !v)}
                aria-pressed={isFrozen}
                title={
                  isFrozen
                    ? "Unfreeze to resume live updates (F)"
                    : "Freeze the visualizations (F)"
                }
              >
                {isFrozen ? "❄️ Frozen" : "🟢 Live"}
              </button>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="fps-cap">
                Refresh rate
              </label>
              <select
                id="fps-cap"
                className="control-select"
                value={updateIntervalMs}
                onChange={(e) => setUpdateIntervalMs(Number(e.target.value))}
                aria-label="Visualization refresh rate"
              >
                <option value={66}>~15 FPS</option>
                <option value={33}>~30 FPS</option>
                <option value={16}>~60 FPS</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="buffer-size">
                Buffer window
              </label>
              <select
                id="buffer-size"
                className="control-select"
                value={maxBufferSamples}
                onChange={(e) => setMaxBufferSamples(Number(e.target.value))}
                aria-label="Max samples kept in buffer"
              >
                <option value={8192}>8K samples</option>
                <option value={16384}>16K samples</option>
                <option value={32768}>32K samples</option>
                <option value={65536}>64K samples</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="bg-render">
                Background
              </label>
              <button
                id="bg-render"
                className="btn btn-secondary"
                onClick={() => setRenderInBackground((v) => !v)}
                aria-pressed={renderInBackground}
                title={
                  renderInBackground
                    ? "Rendering continues when tab is hidden"
                    : "Pause rendering when tab is hidden"
                }
              >
                {renderInBackground ? "On" : "Auto-pause"}
              </button>
            </div>

            <div className="control-group" style={{ alignSelf: "end" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleClear}
                  title="Clear current buffer and counters"
                >
                  🧹 Clear
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleSnapshotCSV}
                  title="Export current buffer as CSV (E)"
                >
                  ⬇️ Export CSV
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Core analysis visuals per design guidelines */}
        <div className="analysis-grid">
          <Card
            title="IQ Constellation"
            subtitle="Visualize modulation quality and symbol clustering"
          >
            <div ref={viz1Ref}>
              <IQConstellation
                samples={samples}
                width={viz1Width}
                height={Math.max(260, Math.round(viz1Width * 0.5))}
                continueInBackground={renderInBackground}
              />
            </div>
          </Card>

          <Card
            title="Time-Domain Waveform"
            subtitle="Amplitude vs. time for signal quality checks"
          >
            <div ref={viz2Ref}>
              <WaveformVisualizer
                samples={samples}
                width={viz2Width}
                height={Math.max(220, Math.round(viz2Width * 0.4))}
                continueInBackground={renderInBackground}
              />
            </div>
          </Card>
        </div>

        <Card
          title="Eye Diagram"
          subtitle="Overlayed symbol periods to assess timing and ISI"
        >
          <div ref={viz3Ref}>
            <EyeDiagram
              samples={samples}
              width={viz3Width}
              height={Math.max(240, Math.round(viz3Width * 0.35))}
            />
          </div>
        </Card>

        <Card title="Measurements" subtitle="Markers, deltas, and export">
          {/* Render as a panel to avoid nested page containers; use shared markers in read-only mode */}
          <Measurements
            isPanel={true}
            markers={sharedMarkers.map((m) => ({
              id: m.id,
              frequency: m.freqHz,
            }))}
            readOnly={true}
          />
        </Card>

        <Card
          title="Interactive DSP Pipeline"
          subtitle="Click a stage to inspect data and parameters"
          collapsible
          defaultExpanded={false}
        >
          <InteractiveDSPPipeline device={device} samples={samples} />
        </Card>

        <Card
          title="Performance Metrics"
          subtitle="Rendering timing and diagnostics"
          collapsible
          defaultExpanded={false}
        >
          <PerformanceMetrics currentFPS={currentFPSMetric} />
        </Card>
      </main>
    </div>
  );
}

export default Analysis;
