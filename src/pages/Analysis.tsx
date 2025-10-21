import { useEffect, useState, useCallback, useRef } from "react";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import { useLiveRegion } from "../hooks/useLiveRegion";
import InteractiveDSPPipeline from "../components/InteractiveDSPPipeline";
import PerformanceMetrics from "../components/PerformanceMetrics";
import Card from "../components/Card";
import { Sample } from "../utils/dsp";
import { performanceMonitor } from "../utils/performanceMonitor";
import { ISDRDevice } from "../models/SDRDevice";

const MAX_BUFFER_SAMPLES = 32768;
const UPDATE_INTERVAL_MS = 33; // Target 30 FPS

function Analysis(): React.JSX.Element {
  const { device } = useHackRFDevice();
  const [listening, setListening] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [currentFPS, setCurrentFPS] = useState<number>(0);

  const sampleBufferRef = useRef<Sample[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsLastUpdateRef = useRef<number>(0);
  const receivePromiseRef = useRef<Promise<void> | null>(null);

  // Live region for screen reader announcements
  const { announce, LiveRegion } = useLiveRegion();

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
      if (!chunk || chunk.length === 0) {
        console.warn("handleSampleChunk: received empty chunk");
        return;
      }

      console.debug(`handleSampleChunk: received ${chunk.length} samples`);

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
        console.debug("Scheduling visualization update");
        scheduleVisualizationUpdate();
      }
    },
    [scheduleVisualizationUpdate],
  );

  const beginDeviceStreaming = useCallback(
    async (activeDevice: ISDRDevice): Promise<void> => {
      clearVisualizationState();
      setListening(true);
      announce("Started receiving radio signals for analysis");

      console.warn("beginDeviceStreaming: Configuring device before streaming");
      try {
        await activeDevice.setSampleRate(2048000);
        console.warn("beginDeviceStreaming: Sample rate set to 2.048 MSPS");
      } catch (err) {
        console.error("Failed to set sample rate:", err);
      }

      const receivePromise = activeDevice
        .receive((data) => {
          console.warn("Received data, byteLength:", data?.byteLength || 0);
          const parsed = activeDevice.parseSamples(data) as Sample[];
          console.warn("Parsed samples count:", parsed?.length || 0);
          handleSampleChunk(parsed);
        })
        .catch((err) => {
          console.error(err);
          announce("Failed to receive radio signals");
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
    [clearVisualizationState, handleSampleChunk, announce],
  );

  // Start streaming if device is receiving
  useEffect((): void => {
    if (device && device.isReceiving() && !listening) {
      void beginDeviceStreaming(device);
    }
  }, [device, listening, beginDeviceStreaming]);

  useEffect((): (() => void) => {
    return () => {
      cancelScheduledUpdate();
    };
  }, [cancelScheduledUpdate]);

  const _stopListening = useCallback(async (): Promise<void> => {
    if (device && device.isReceiving()) {
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
    announce("Stopped receiving radio signals");
  }, [cancelScheduledUpdate, device, announce]);

  return (
    <div className="container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <LiveRegion />

      <main id="main-content" role="main">
        <Card
          title="Signal Analysis"
          subtitle="Deep dive into DSP processing and signal characteristics"
        >
          {!device ? (
            <div className="empty-state">
              <p>
                No device connected. Please connect and start receiving on the
                Live Monitor page first.
              </p>
            </div>
          ) : !listening ? (
            <div className="info-message">
              <p>
                Start reception on the Live Monitor page to see analysis data.
              </p>
            </div>
          ) : (
            <div className="info-message">
              <p>Receiving and analyzing signal data in real-time...</p>
            </div>
          )}
        </Card>

        <InteractiveDSPPipeline
          device={device as ISDRDevice | undefined}
          samples={samples}
        />

        <PerformanceMetrics currentFPS={currentFPS} />
      </main>
    </div>
  );
}

export default Analysis;
