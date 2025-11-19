import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AudioControls from "../components/AudioControls";
import { DiagnosticsOverlay } from "../components/DiagnosticsOverlay";
import PrimaryVisualization from "../components/Monitor/PrimaryVisualization";
import QuickActions from "../components/Monitor/QuickActions";
import VisualizationControls from "../components/Monitor/VisualizationControls";
import RDSDisplay from "../components/RDSDisplay";
import { WATERFALL_COLORMAPS } from "../constants";
import { useDsp } from "../hooks/useDsp";
import {
  useFrequencyScanner,
  type ActiveSignal,
} from "../hooks/useFrequencyScanner";
import { useReception } from "../hooks/useReception";
import {
  useSignalDetection,
  type DetectedSignal,
} from "../hooks/useSignalDetection";
import { CalibrationManager } from "../lib/measurement/calibration";
import { estimateFMBroadcastPPM } from "../lib/measurement/fm-ppm-calibrator";
import { notify } from "../lib/notifications";
import { toggleShortcuts } from "../lib/shortcuts";
import { type SDRCapabilities, type IQSample } from "../models/SDRDevice";
import { useDevice, useFrequency, useSettings, useDiagnostics } from "../store";
// import { shouldUseMockSDR } from "../utils/e2e";
import { updateBulkCachedRDSData } from "../store/rdsCache";
import {
  addBookmark as addBookmarkToStorage,
  bookmarkExists,
  updateBookmark,
} from "../utils/bookmarkStorage";
import { formatFrequency, formatSampleRate } from "../utils/frequency";
import { generateBookmarkId } from "../utils/id";
import { createMultiStationFMProcessor } from "../utils/multiStationFM";
import type { RDSStationData } from "../models/RDSData";
import type { Bookmark } from "../types/bookmark";

declare global {
  interface Window {
    dbgReceiving?: boolean;
  }
}

const Monitor: React.FC = () => {
  const { primaryDevice: device } = useDevice();
  const { setOverlayVisible } = useDiagnostics();

  // UI state
  const { frequencyHz: frequency, setFrequencyHz: setFrequency } =
    useFrequency();
  const { settings, setSettings } = useSettings();

  // State for device capabilities and bandwidth
  const [deviceBandwidth, setDeviceBandwidth] = useState<number>(0);
  const [deviceCapabilities, setDeviceCapabilities] =
    useState<SDRCapabilities | null>(null);

  const maxSupportedSampleRate = useMemo(() => {
    if (!deviceCapabilities) {
      return 20_000_000; // sensible default for HackRF profile
    }
    const { supportedSampleRates = [], maxBandwidth } = deviceCapabilities;
    if (supportedSampleRates.length > 0) {
      return Math.max(...supportedSampleRates);
    }
    if (typeof maxBandwidth === "number" && maxBandwidth > 0) {
      return maxBandwidth;
    }
    return 20_000_000;
  }, [deviceCapabilities]);

  const usableBandwidthHz = useMemo(() => {
    if (deviceBandwidth > 0) {
      return Math.min(deviceBandwidth, maxSupportedSampleRate);
    }
    if (
      deviceCapabilities?.maxBandwidth &&
      deviceCapabilities.maxBandwidth > 0
    ) {
      return Math.min(deviceCapabilities.maxBandwidth, maxSupportedSampleRate);
    }
    return maxSupportedSampleRate;
  }, [deviceBandwidth, deviceCapabilities, maxSupportedSampleRate]);

  const hardwareConfig = useMemo(
    () => ({
      sampleRate: Math.max(maxSupportedSampleRate, usableBandwidthHz),
      lnaGain: 16, // dB
      vgaGain: 30, // dB
      bandwidth: usableBandwidthHz,
    }),
    [maxSupportedSampleRate, usableBandwidthHz],
  );
  const sampleRate = hardwareConfig.sampleRate; // For compatibility with existing code

  const halfSpanHz = useMemo(() => usableBandwidthHz / 2, [usableBandwidthHz]);
  const spanLowerHz = useMemo(
    () => Math.max(0, frequency - halfSpanHz),
    [frequency, halfSpanHz],
  );
  const spanUpperHz = useMemo(
    () => frequency + halfSpanHz,
    [frequency, halfSpanHz],
  );
  const spanLabel = `${formatFrequency(spanLowerHz)} – ${formatFrequency(spanUpperHz)}`;
  const halfSpanLabel = `${(halfSpanHz / 1e6).toFixed(2)} MHz`;
  const usableBandwidthLabel = `${(usableBandwidthHz / 1e6).toFixed(2)} MHz`;
  const sampleRateLabel = formatSampleRate(sampleRate);
  const deviceConnected = Boolean(device);
  const summaryBandwidthText = deviceConnected
    ? `${usableBandwidthLabel} usable • ${sampleRateLabel}`
    : `Target ${sampleRateLabel}`;
  const spanSummaryText = deviceConnected
    ? `Span ±${halfSpanLabel}`
    : "Span --";
  const coverageSummaryText = deviceConnected
    ? `Coverage ${spanLabel}`
    : "Coverage --";

  // Deprecated: spectrogram frames are streamed directly to the renderer now.
  // Keeping a React state history is unnecessary and adds GC pressure.
  // const [_spectroFrames, setSpectroFrames] = useState<Float32Array[]>([]);

  const iqSamplesRef = useRef<IQSample[]>([]);
  const msProcessorRef = useRef<ReturnType<
    typeof createMultiStationFMProcessor
  > | null>(null);
  const msIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    magnitudes: fftData,
    start: startDsp,
    stop: stopDsp,
  } = useDsp(device, {
    fftSize: settings.fftSize,
    onNewFft: () => {
      // No-op here; PrimaryVisualization consumes latest fftData directly.
      // This avoids React state churn for history frames.
    },
    onIQSamples: (samples: IQSample[]) => {
      const buf = iqSamplesRef.current;
      buf.push(...samples);
      // Keep ~300k samples (~0.15s at 2 MSPS). RDS accumulates across chunks.
      const maxSamples = 300_000;
      if (buf.length > maxSamples) {
        buf.splice(0, buf.length - maxSamples);
      }
    },
  });

  // State for visualization settings
  // Settings values come from context: settings.{vizMode, highPerf, showWaterfall, colorMap, dbMin, dbMax, fftSize}

  const [foundSignals, setFoundSignals] = useState<ActiveSignal[]>([]);
  const scanner = useFrequencyScanner(device, (signal: ActiveSignal) => {
    setFoundSignals((prev) => {
      // Check if signal already exists at this frequency and update it
      const idx = prev.findIndex((s) => s.frequency === signal.frequency);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = signal;
        return updated;
      }
      // Otherwise append new signal
      return [...prev, signal];
    });
  });

  useEffect(() => {
    if (scanner.state === "idle" && foundSignals.length > 0) {
      setScanStatusMsg(`Scan complete, found ${foundSignals.length} signals.`);
    }
  }, [scanner.state, foundSignals.length]);

  // Fetch device capabilities when device is connected
  useEffect(() => {
    if (!device) {
      setDeviceCapabilities(null);
      setDeviceBandwidth(0);
      return;
    }

    // Get capabilities synchronously
    const caps = device.getCapabilities();
    setDeviceCapabilities(caps);

    // Get usable bandwidth asynchronously
    void device.getUsableBandwidth().then((bw) => {
      setDeviceBandwidth(bw);
    });
  }, [device]);

  // Reception control using the useReception hook
  const [, setScanStatusMsg] = useState<string>("");
  const { isReceiving } = useReception({
    device,
    frequency,
    config: hardwareConfig,
    startDsp,
    stopDsp,
    stopScanner: scanner.stopScan,
    scannerState: scanner.state,
  });

  // Combine reception and scan status messages (reception takes precedence)
  // Note: value currently unused; StatusBar consumes messages directly from hooks.
  // const statusMsg = receptionStatusMsg || scanStatusMsg;

  // Automatic signal detection during live reception
  const autoDetection = useSignalDetection(
    isReceiving ? fftData : null, // Only detect when receiving
    sampleRate,
    frequency,
    isReceiving, // Enable when receiving
  );

  // Dummy state for components that are not yet fully integrated
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  // TODO(rad.io): Temporary placeholder for signalQuality. Refactor consuming components to accept optional props or implement feature properly.
  const [signalQuality] = useState({
    snr: 0,
    peakPower: 0,
    avgPower: 0,
  });
  // Render metrics are shown in the global StatusBar (App)

  const handleToggleAudio = (): void => setIsAudioPlaying(!isAudioPlaying);
  const handleVolumeChange = (vol: number): void => setVolume(vol * 100);
  const handleToggleMute = (): void => setIsMuted(!isMuted);

  // Quick Actions handlers
  // TODO: Integrate with actual recording system (RecordingControls logic)
  // This is currently a placeholder state for UI demonstration.
  // Replace with actual recording state when backend integration is available.
  const [isRecordingActive, setIsRecordingActive] = useState(false);

  const handleBookmark = useCallback((frequencyHz: number): void => {
    // Check if frequency already bookmarked
    const existing = bookmarkExists(frequencyHz);
    if (existing) {
      // Update lastUsed timestamp
      updateBookmark(existing.id, { lastUsed: Date.now() });
      notify({
        message: `Updated bookmark for ${formatFrequency(frequencyHz)}`,
        sr: "polite",
        visual: true,
        tone: "success",
      });
      return;
    }

    // Create new bookmark
    const newBookmark: Bookmark = {
      id: generateBookmarkId(),
      frequency: frequencyHz,
      name: formatFrequency(frequencyHz),
      tags: [],
      notes: "",
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    // Save to localStorage
    addBookmarkToStorage(newBookmark);

    notify({
      message: `Bookmarked ${formatFrequency(frequencyHz)}`,
      sr: "polite",
      visual: true,
      tone: "success",
    });
  }, []);

  const handleToggleRecording = useCallback((): void => {
    // TODO: Integrate with actual recording system (RecordingControls logic)
    // For now, just toggle state and show notification
    setIsRecordingActive((prev) => {
      const newState = !prev;
      notify({
        message: newState ? "Recording started" : "Recording stopped",
        sr: "polite",
        visual: true,
        tone: newState ? "success" : "info",
      });
      return newState;
    });
  }, []);

  const handleShowHelp = useCallback((): void => {
    toggleShortcuts();
  }, []);

  // Use refs to track mutable values for keyboard shortcuts to avoid listener churn
  const frequencyRef = useRef(frequency);
  const showGridRef = useRef(settings.showGridlines);

  useEffect(() => {
    frequencyRef.current = frequency;
  }, [frequency]);

  useEffect(() => {
    showGridRef.current = settings.showGridlines;
  }, [settings.showGridlines]);

  const handleToggleGrid = useCallback((): void => {
    const newState = !showGridRef.current;
    setSettings({ showGridlines: newState });
    notify({
      message: newState ? "Gridlines shown" : "Gridlines hidden",
      sr: "polite",
      visual: true,
      tone: "info",
    });
  }, [setSettings]);

  // Keyboard shortcuts for quick actions
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent): void => {
      // Only handle keyboard shortcuts if not in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "b":
          event.preventDefault();
          handleBookmark(frequencyRef.current);
          break;
        case "g":
          event.preventDefault();
          handleToggleGrid();
          break;
        // Note: '?' is already handled by ShortcutsOverlay
        // Note: Recording uses global Ctrl/Cmd+S shortcut (see ShortcutsOverlay)
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return (): void => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleBookmark, handleToggleGrid]);

  // Auto FM PPM calibration (runs once per session when stable)
  const autoPpmDoneRef = useRef(false);
  useEffect(() => {
    if (!isReceiving || autoPpmDoneRef.current) return;
    const est = estimateFMBroadcastPPM(autoDetection.signals);
    if (!est) return;
    const mgr = new CalibrationManager();
    // Persist calibration against actual connected device identity
    void (async (): Promise<void> => {
      try {
        if (!device) return;
        const info = await device.getDeviceInfo();
        const deviceId = `${info.vendorId}:${info.productId}:${info.serialNumber ?? ""}`;
        mgr.setFrequencyCalibration(deviceId, {
          deviceId,
          ppmOffset: est.ppm,
          referenceFrequency: 100_000_000, // nominal reference for logging
          measuredFrequency: 100_000_000,
          calibrationDate: Date.now(),
        });
        try {
          window.dispatchEvent(
            new CustomEvent("rad:calibration-updated", {
              detail: { deviceId, ppm: est.ppm },
            }),
          );
        } catch {
          // no-op
        }
        autoPpmDoneRef.current = true;
        setScanStatusMsg(
          `Auto PPM calibrated: ${est.ppm.toFixed(1)} ppm (from ${est.count} FM carriers)`,
        );
        // Retune current frequency to apply correction in adapter
        const snapped = Math.round(frequency / 1_000) * 1_000;
        void device.setFrequency(snapped).catch((err: unknown) => {
          console.warn("Retune after auto-PPM failed", err);
        });
      } catch (err) {
        console.warn("Auto-PPM calibration persistence failed", err);
      }
    })();
  }, [autoDetection.signals, isReceiving, device, frequency]);

  // Multi-station FM processor lifecycle and processing
  useEffect(() => {
    // Dispose previous processor if config changes or disabled
    if (!isReceiving || !settings.multiStationEnabled) {
      if (msIntervalRef.current) {
        clearInterval(msIntervalRef.current);
        // Explicitly clear timer ref

        msIntervalRef.current = null;
      }
      msProcessorRef.current = null;
      return;
    }

    // Create processor if not present
    msProcessorRef.current ??= createMultiStationFMProcessor({
      sampleRate: sampleRate,
      centerFrequency: frequency,
      bandwidth: hardwareConfig.bandwidth,
      enableRDS: settings.multiStationEnableRDS,
      channelBandwidth: settings.multiStationChannelBandwidthHz,
      scanFFTSize: settings.multiStationScanFFTSize,
      scanIntervalMs: settings.multiStationScanIntervalMs,
      usePFBChannelizer: settings.multiStationUsePFBChannelizer,
    });

    // Update config when settings change
    msProcessorRef.current.updateConfig({
      sampleRate: sampleRate,
      centerFrequency: frequency,
      bandwidth: hardwareConfig.bandwidth,
      enableRDS: settings.multiStationEnableRDS,
      channelBandwidth: settings.multiStationChannelBandwidthHz,
      scanFFTSize: settings.multiStationScanFFTSize,
      scanIntervalMs: settings.multiStationScanIntervalMs,
      usePFBChannelizer: settings.multiStationUsePFBChannelizer,
    });

    // Process wideband IQ periodically using interval; inline handler so we can control timing
    const handler = async (): Promise<void> => {
      try {
        const samples = iqSamplesRef.current.slice();
        if (samples.length === 0) return;
        const processor = msProcessorRef.current;
        if (!processor) return;
        const results = await processor.processWidebandSamples(samples);
        const updates: Array<{ frequencyHz: number; data: RDSStationData }> =
          [];
        for (const [freq, { rdsData }] of results) {
          if (rdsData) {
            updates.push({ frequencyHz: freq, data: rdsData });
          }
        }
        if (updates.length > 0) {
          updateBulkCachedRDSData(updates);
          // Also attach rdsData to existing foundSignals so UI updates faster
          setFoundSignals((prev) => {
            const map = new Map(prev.map((s) => [s.frequency, s]));
            for (const u of updates) {
              const s = map.get(u.frequencyHz);
              if (s) {
                map.set(u.frequencyHz, { ...s, rdsData: u.data });
              }
            }
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn("Multi-station FM processor iteration failed", err);
      }
    };

    // Immediately run one pass then schedule
    void handler();
    if (msIntervalRef.current) {
      clearInterval(msIntervalRef.current);
      // Explicitly clear timer ref

      msIntervalRef.current = null;
    }
    msIntervalRef.current = setInterval(
      () => void handler(),
      Math.max(200, settings.multiStationScanIntervalMs),
    );

    return (): void => {
      if (msIntervalRef.current) {
        clearInterval(msIntervalRef.current);
        msIntervalRef.current = null;
      }
    };
  }, [
    isReceiving,
    settings.multiStationEnabled,
    settings.multiStationEnableRDS,
    settings.multiStationChannelBandwidthHz,
    settings.multiStationScanFFTSize,
    settings.multiStationScanIntervalMs,
    settings.multiStationUsePFBChannelizer,
    sampleRate,
    hardwareConfig.bandwidth,
    frequency,
  ]);

  // Type helper for JSX prop inference - validate colorMap exists in WATERFALL_COLORMAPS
  const colorKey = (
    Object.keys(WATERFALL_COLORMAPS).includes(settings.colorMap)
      ? settings.colorMap
      : "turbo"
  ) as keyof typeof WATERFALL_COLORMAPS;

  // Merge autodedetected signals and multi-station channels (if enabled) for visualization annotations
  const msChannels = msProcessorRef.current?.getChannels() ?? [];
  // Map msChannels into DetectedSignal-like objects and merge with autoDetected signals by frequency (prefer rdsData)
  const mergedSignals = ((): DetectedSignal[] => {
    const map = new Map<number, DetectedSignal>();
    // Grab auto detected first
    for (const s of autoDetection.signals) {
      map.set(s.frequency, s);
    }
    // Augment with ms channels
    for (const ch of msChannels) {
      const existing = map.get(ch.frequency);
      const base: DetectedSignal =
        existing ??
        ({
          binIndex: Math.max(0, Math.floor(settings.fftSize / 2)),
          frequency: ch.frequency,
          power: ch.strength * 100,
          bandwidth: settings.multiStationChannelBandwidthHz,
          snr: 0,
          lastSeen: ch.lastSeen ?? Date.now(),
          isActive: true,
          label: undefined,
          type: "wideband-fm",
          confidence: Math.min(1, Math.max(0, ch.strength)),
        } as DetectedSignal);
      // Attach RDS data if present
      if (ch.rdsData) {
        base.rdsData = ch.rdsData;
      }
      map.set(ch.frequency, base);
    }
    const result = Array.from(map.values()).filter(Boolean);
    return result;
  })();

  return (
    <div className="monitor-page" role="main">
      {/* Accessible page heading for tests & screen readers */}
      <h1 style={{ position: "absolute", left: -9999, top: -9999 }}>
        Frequency Control
      </h1>
      <section
        aria-labelledby="visualization-heading"
        aria-label="Spectrum visualization"
        style={{ marginTop: "8px" }}
      >
        <h2 id="visualization-heading" className="visually-hidden">
          Visualization
        </h2>
        {/* Simple, focused controls per UI-DESIGN-SPEC */}
        <div
          role="group"
          aria-label="Monitor controls"
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "baseline",
              padding: "6px 10px",
              borderRadius: "6px",
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              color: "#e2e8f0",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.85em",
            }}
          >
            <span>Center {formatFrequency(frequency)}</span>
            <span>{spanSummaryText}</span>
            <span>{coverageSummaryText}</span>
            <span>{summaryBandwidthText}</span>
          </div>
          {/* Reception and scan controls removed per request */}

          {/* Auto-calibration runs silently in background; indicator is in StatusBar */}

          {scanner.state !== "idle" && (
            <span style={{ opacity: 0.7, fontSize: "0.9em" }}>
              {Math.round(scanner.progress)}%
            </span>
          )}

          <button
            className="btn btn-secondary diagnostics-button"
            onClick={() => setOverlayVisible(true)}
            title="Show diagnostics overlay"
          >
            Diagnostics
          </button>

          {/* Quick Actions Toolbar */}
          <QuickActions
            currentFrequencyHz={frequency}
            isRecording={isRecordingActive}
            showGrid={settings.showGridlines}
            onBookmark={handleBookmark}
            onToggleRecording={handleToggleRecording}
            onToggleGrid={handleToggleGrid}
            onShowHelp={handleShowHelp}
          />
        </div>
        <div style={{ marginTop: 8, position: "relative" }}>
          <VisualizationControls
            sampleRateHz={sampleRate}
            usableBandwidthHz={usableBandwidthHz}
            centerFrequencyHz={frequency}
          />
          <PrimaryVisualization
            fftData={fftData}
            fftSize={settings.fftSize}
            sampleRate={sampleRate}
            centerFrequency={frequency}
            mode={
              settings.vizMode === "fft" && settings.showWaterfall
                ? "spectrogram"
                : settings.vizMode === "fft"
                  ? "fft"
                  : settings.vizMode
            }
            colorMap={colorKey}
            dbMin={settings.dbMin}
            dbMax={settings.dbMax}
            signals={mergedSignals}
            // Show annotations if receiving or if we have merged signals available
            // (e.g., multi-station scan produced channels, or auto-detection found carriers)
            showAnnotations={isReceiving || mergedSignals.length > 0}
            showGridlines={settings.showGridlines}
            showGridLabels={settings.showGridLabels}
            onTune={(fHz) => {
              const snapped = Math.round(fHz / 1_000) * 1_000;
              setFrequency(snapped);
              if (device) {
                void device
                  .setFrequency(snapped)
                  .then(() =>
                    setScanStatusMsg(
                      `Tuned to ${formatFrequency(snapped)} @ ${(
                        sampleRate / 1e6
                      ).toFixed(2)} MSPS`,
                    ),
                  )
                  .catch((err: unknown) => {
                    console.error("Failed to set frequency", err);
                    setScanStatusMsg(
                      `Failed to tune to ${formatFrequency(snapped)}: ${err instanceof Error ? err.message : String(err)}`,
                    );
                  });
              }
            }}
          />
        </div>
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
                        // Device will tune to the new frequency on the next reception start/restart
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
        {foundSignals.length > 0 && foundSignals[0]?.rdsData && (
          <div style={{ marginBottom: "16px" }}>
            <RDSDisplay rdsData={foundSignals[0].rdsData} stats={null} />
          </div>
        )}

        {/* Professional signal measurements */}
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
            <div style={{ fontSize: "0.85em", opacity: 0.7 }}>Sample Rate</div>
            <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
              {sampleRateLabel}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.85em", opacity: 0.7 }}>Bandwidth</div>
            <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
              {deviceConnected && usableBandwidthHz > 0
                ? `${(usableBandwidthHz / 1e6).toFixed(2)} MHz`
                : "--"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.85em", opacity: 0.7 }}>Lower Edge</div>
            <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
              {deviceConnected ? formatFrequency(spanLowerHz) : "--"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.85em", opacity: 0.7 }}>Upper Edge</div>
            <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
              {deviceConnected ? formatFrequency(spanUpperHz) : "--"}
            </div>
          </div>
        </div>
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

      {/* StatusBar is rendered globally in the App shell */}
      <DiagnosticsOverlay detailed={true} />
    </div>
  );
};

export default Monitor;
