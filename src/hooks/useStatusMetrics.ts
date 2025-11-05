import { useEffect, useMemo, useRef, useState } from "react";
import { notify } from "../lib/notifications";
import { renderTierManager } from "../lib/render/RenderTierManager";
import { useDevice } from "../store";
import { performanceMonitor } from "../utils/performanceMonitor";
import { useSpeaker, type SpeakerInfo } from "./useSpeaker";
import type { RenderTier } from "../types/rendering";

export type StatusMetrics = {
  deviceConnected: boolean;
  renderTier: RenderTier;
  fps: number;
  /** Cadence of visualization data pushes (viz-push) in FPS */
  inputFps?: number;
  /** Estimated dropped frames over the last 60 seconds */
  droppedFrames?: number;
  /** p95 render duration for 'rendering' measures (ms) */
  renderP95Ms: number;
  /** Count of long tasks observed (PerformanceObserver) */
  longTasks: number;
  sampleRate: number; // Hz
  bufferHealth: number; // 0-100
  bufferDetails?: { currentSamples: number; maxSamples: number };
  storageUsed: number; // bytes
  storageQuota: number; // bytes
  audio: SpeakerInfo;
};

/**
 * Aggregates system metrics for StatusBar from existing managers and APIs.
 * - GPU tier via renderTierManager
 * - FPS via performanceMonitor
 * - Device connection, sample rate, and buffer health via DeviceContext/ISDRDevice
 * - Storage usage via StorageManager.estimate()
 */
export function useStatusMetrics(): StatusMetrics {
  const { primaryDevice } = useDevice();
  const speaker = useSpeaker();
  const [renderTier, setRenderTier] = useState<RenderTier>(
    renderTierManager.getTier(),
  );
  const [fps, setFps] = useState<number>(0);
  const [inputFps, setInputFps] = useState<number>(0);
  const [droppedFrames, setDroppedFrames] = useState<number>(0);
  const [renderP95Ms, setRenderP95Ms] = useState<number>(0);
  const [longTasks, setLongTasks] = useState<number>(0);
  const [sampleRate, setSampleRate] = useState<number>(0);
  const [bufferHealth, setBufferHealth] = useState<number>(100);
  const [bufferDetails, setBufferDetails] = useState<
    { currentSamples: number; maxSamples: number } | undefined
  >(undefined);
  const [storageUsed, setStorageUsed] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<number>(0);

  const deviceConnected = useMemo(
    () => Boolean(primaryDevice),
    [primaryDevice],
  );

  // Subscribe to render tier changes
  useEffect(() => {
    return renderTierManager.subscribe(setRenderTier);
  }, []);

  // Announcements: emit live-region updates on important state changes
  const prev = useRef({
    deviceConnected: deviceConnected,
    renderTier: renderTier,
    fpsCategory: fps >= 55 ? "good" : fps >= 30 ? "warn" : "crit",
    bufferCategory:
      bufferHealth >= 80 ? "good" : bufferHealth >= 50 ? "warn" : "crit",
    storageCategory:
      storageQuota === 0
        ? "unknown"
        : storageUsed / (storageQuota || 1) >= 0.9
          ? "crit"
          : storageUsed / (storageQuota || 1) >= 0.7
            ? "warn"
            : "good",
    audioState: speaker.state,
    audioClipping: speaker.clipping,
  });

  useEffect(() => {
    if (prev.current.deviceConnected !== deviceConnected) {
      notify({
        message: deviceConnected ? "Device connected" : "Device disconnected",
        tone: deviceConnected ? "success" : "warning",
        sr: "polite",
        visual: true,
      });
      prev.current.deviceConnected = deviceConnected;
    }
  }, [deviceConnected]);

  useEffect(() => {
    if (prev.current.renderTier !== renderTier) {
      notify({
        message: `Rendering with ${renderTier}`,
        sr: "polite",
        visual: false,
      });
      prev.current.renderTier = renderTier;
    }
  }, [renderTier]);

  useEffect(() => {
    const cat = fps >= 55 ? "good" : fps >= 30 ? "warn" : "crit";
    if (prev.current.fpsCategory !== cat) {
      if (cat === "warn") {
        notify({
          message: "Performance: FPS dropped below target",
          sr: "polite",
          visual: false,
        });
      }
      if (cat === "crit") {
        notify({
          message: "Performance: FPS critical",
          sr: "assertive",
          visual: false,
        });
      }
      if (cat === "good") {
        notify({
          message: "Performance: FPS recovered",
          sr: "polite",
          visual: false,
        });
      }
      prev.current.fpsCategory = cat;
    }
  }, [fps]);

  useEffect(() => {
    const cat =
      bufferHealth >= 80 ? "good" : bufferHealth >= 50 ? "warn" : "crit";
    if (prev.current.bufferCategory !== cat) {
      if (cat === "warn") {
        notify({
          message: "Buffer health warning",
          sr: "polite",
          visual: false,
        });
      }
      if (cat === "crit") {
        notify({
          message: "Buffer health critical",
          sr: "assertive",
          visual: false,
        });
      }
      if (cat === "good") {
        notify({
          message: "Buffer health recovered",
          sr: "polite",
          visual: false,
        });
      }
      prev.current.bufferCategory = cat;
    }
  }, [bufferHealth]);

  useEffect(() => {
    const pct = storageQuota === 0 ? 0 : storageUsed / (storageQuota || 1);
    const cat =
      storageQuota === 0
        ? "unknown"
        : pct >= 0.9
          ? "crit"
          : pct >= 0.7
            ? "warn"
            : "good";
    if (prev.current.storageCategory !== cat) {
      if (cat === "warn") {
        notify({
          message: "Storage nearing quota",
          sr: "polite",
          visual: true,
          tone: "warning",
        });
      }
      if (cat === "crit") {
        notify({
          message: "Storage critical",
          sr: "assertive",
          visual: true,
          tone: "error",
        });
      }
      if (cat === "good") {
        notify({ message: "Storage ok", sr: "polite", visual: false });
      }
      prev.current.storageCategory = cat;
    }
  }, [storageUsed, storageQuota]);

  useEffect(() => {
    if (prev.current.audioState !== speaker.state) {
      notify({
        message: `Audio ${speaker.state}`,
        sr: "polite",
        visual: false,
      });
      prev.current.audioState = speaker.state;
    }
    if (!prev.current.audioClipping && speaker.clipping) {
      notify({
        message: "Audio clipping detected",
        sr: "assertive",
        visual: true,
        tone: "warning",
      });
    }
    prev.current.audioClipping = speaker.clipping;
  }, [speaker.state, speaker.clipping]);

  // Poll FPS every second
  useEffect(() => {
    const windowSeconds = 60;
    const windowBuf: number[] = [];
    const id = setInterval(() => {
      setFps(performanceMonitor.getFPS());
      // Data arrival cadence (viz push loop)
      setInputFps(performanceMonitor.getCadenceFPS("viz-push"));
      const stats = performanceMonitor.getStats("rendering");
      setRenderP95Ms(stats.p95 || 0);
      setLongTasks(performanceMonitor.getLongTasks().length);

      // Approximate dropped frames as the positive delta between input cadence and render fps
      const fIn = performanceMonitor.getCadenceFPS("viz-push");
      const fOut = performanceMonitor.getFPS();
      const est = Math.max(0, Math.round(Math.max(0, fIn - fOut)));
      windowBuf.push(est);
      if (windowBuf.length > windowSeconds) {
        windowBuf.shift();
      }
      const sum = windowBuf.reduce((a, b) => a + b, 0);
      setDroppedFrames(sum);
    }, 1000);
    return (): void => clearInterval(id);
  }, []);

  // Poll device metrics periodically when a device is connected
  useEffect(() => {
    let id: number | undefined;

    async function tick(): Promise<void> {
      if (!primaryDevice) {
        setSampleRate(0);
        setBufferHealth(100);
      } else {
        try {
          const rate = await primaryDevice.getSampleRate().catch(() => 0);
          const mem = primaryDevice.getMemoryInfo();
          setSampleRate(rate);
          if (mem.maxSamples > 0) {
            const pct = (mem.currentSamples / mem.maxSamples) * 100;
            const clamped = Math.max(0, Math.min(100, pct));
            setBufferHealth(Number.isFinite(clamped) ? clamped : 100);
            setBufferDetails({
              currentSamples: mem.currentSamples,
              maxSamples: mem.maxSamples,
            });
          } else {
            setBufferHealth(100);
            setBufferDetails(undefined);
          }
        } catch {
          // Non-fatal; keep last known values
        }
      }
      id = window.setTimeout(() => {
        void tick();
      }, 1500);
    }

    void tick();
    return (): void => {
      if (id) {
        window.clearTimeout(id);
      }
    };
  }, [primaryDevice]);

  // Storage estimate (if supported)
  useEffect(() => {
    const update = async (): Promise<void> => {
      try {
        const est = await navigator.storage.estimate();
        setStorageUsed(est.usage ?? 0);
        setStorageQuota(est.quota ?? 0);
      } catch {
        // Ignore
      }
    };
    void update();
    const id = setInterval(() => {
      void update();
    }, 10000);
    return (): void => {
      clearInterval(id);
    };
  }, []);

  return {
    deviceConnected,
    renderTier,
    fps,
    inputFps,
    renderP95Ms,
    longTasks,
    sampleRate,
    bufferHealth,
    bufferDetails,
    storageUsed,
    storageQuota,
    audio: speaker,
    droppedFrames,
  };
}
