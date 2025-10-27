import { useEffect, useState, useCallback, useRef } from "react";
import Card from "../components/Card";
import DeviceControlBar from "../components/DeviceControlBar";
import InteractiveDSPPipeline from "../components/InteractiveDSPPipeline";
import PerformanceMetrics from "../components/PerformanceMetrics";
import { useDevice } from "../contexts/DeviceContext";
import { notify } from "../lib/notifications";
import { type ISDRDevice } from "../models/SDRDevice";
import { type Sample } from "../utils/dsp";
import { performanceMonitor } from "../utils/performanceMonitor";

const MAX_BUFFER_SAMPLES = 32768;
const UPDATE_INTERVAL_MS = 33; // Target 30 FPS

function Analysis(): React.JSX.Element {
  const { device, initialize, isCheckingPaired } = useDevice();
  const [listening, setListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [frequency, _setFrequency] = useState(100.3e6);
  const [deviceError, setDeviceError] = useState<Error | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [currentFPS, setCurrentFPS] = useState<number>(0);

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
    setCurrentFPS(0);
  }, [cancelScheduledUpdate]);

  const scheduleVisualizationUpdate = useCallback((): void => {
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
        setCurrentFPS(Math.round(fps));
        frameCountRef.current = 0;
        fpsLastUpdateRef.current = now;
      }
    });
  }, []);

  const handleSampleChunk = useCallback(
    (chunk: Sample[]): void => {
      if (chunk.length === 0) {
        console.warn("Analysis: Received empty sample chunk", {
          chunkType: typeof chunk,
        });
        return;
      }

      console.debug("Analysis: Processing sample chunk", {
        sampleCount: chunk.length,
        bufferState: {
          currentSize: sampleBufferRef.current.length,
          maxSize: MAX_BUFFER_SAMPLES,
        },
      });

      const markName = `pipeline-chunk-start-${
        typeof performance !== "undefined" ? performance.now() : Date.now()
      }`;
      performanceMonitor.mark(markName);

      const combined = sampleBufferRef.current.length
        ? sampleBufferRef.current.concat(chunk)
        : chunk.slice();
      const trimmed =
        combined.length > MAX_BUFFER_SAMPLES
          ? combined.slice(combined.length - MAX_BUFFER_SAMPLES)
          : combined;
      sampleBufferRef.current = trimmed;

      performanceMonitor.measure("pipeline-processing", markName);

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
        lastUpdateRef.current = now;
        console.debug("Analysis: Scheduling visualization update", {
          bufferSize: sampleBufferRef.current.length,
          timeSinceLastUpdate: (now - lastUpdateRef.current).toFixed(2),
        });
        scheduleVisualizationUpdate();
      }
    },
    [scheduleVisualizationUpdate],
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

      console.warn("Analysis: Configuring device for streaming", {
        targetSampleRate: 2048000,
        targetFrequency: frequency,
      });
      try {
        await activeDevice.setSampleRate(2048000);
        await activeDevice.setFrequency(frequency);
        console.warn("Analysis: Device configured successfully", {
          sampleRate: 2048000,
          frequency,
        });
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
          console.debug("Analysis: Received raw data from device", {
            byteLength: data.byteLength,
          });
          const parsed = activeDevice.parseSamples(data) as Sample[];
          console.debug("Analysis: Parsed samples from raw data", {
            sampleCount: parsed.length,
          });
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
      await initialize();
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
  }, [initialize, isInitializing]);

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
    return () => {
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

  return (
    <div className="container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {null}

      <main id="main-content" role="main">
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
        />

        <Card
          title="Signal Analysis"
          subtitle="Deep dive into DSP processing and signal characteristics"
        >
          {!device ? (
            <div className="empty-state">
              <p>
                No device connected. Use the controls above to connect your SDR
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
        </Card>

        <InteractiveDSPPipeline device={device} samples={samples} />

        <PerformanceMetrics currentFPS={currentFPS} />
      </main>
    </div>
  );
}

export default Analysis;
