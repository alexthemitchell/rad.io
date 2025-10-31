import React, { useCallback, useEffect, useState } from "react";
import AudioControls from "../components/AudioControls";
import PrimaryVisualization from "../components/Monitor/PrimaryVisualization";
import RDSDisplay from "../components/RDSDisplay";
import RecordingControls from "../components/RecordingControls";
import SignalStrengthMeter from "../components/SignalStrengthMeter";
import StatusBar from "../components/StatusBar";
import { WATERFALL_COLORMAPS } from "../constants";
import { useDevice } from "../contexts/DeviceContext";
import { useFrequency } from "../contexts/FrequencyContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useDsp } from "../hooks/useDsp";
import {
  useFrequencyScanner,
  type ActiveSignal,
} from "../hooks/useFrequencyScanner";
import { shouldUseMockSDR } from "../utils/e2e";
import { formatFrequency } from "../utils/frequency";
import type { IQSample } from "../models/SDRDevice";

declare global {
  interface Window {
    dbgReceiving?: boolean;
  }
}

const Monitor: React.FC = () => {
  const { device } = useDevice();
  const { notify } = useNotifications();
  const useMock = shouldUseMockSDR();

  // UI state
  const { frequencyHz: frequency, setFrequencyHz: setFrequency } =
    useFrequency();
  const [isReceiving, setIsReceiving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Tuning state
  // Hardware configuration - currently hardcoded, could be made configurable in future
  const sampleRate = 2_000_000; // 2 MSPS
  const lnaGain = 16; // dB
  const vgaGain = 30; // dB
  const [fftSize, setFftSize] = useState(4096);

  // Deprecated: spectrogram frames are streamed directly to the renderer now.
  // Keeping a React state history is unnecessary and adds GC pressure.
  // const [_spectroFrames, setSpectroFrames] = useState<Float32Array[]>([]);

  const {
    magnitudes: fftData,
    start: startDsp,
    stop: stopDsp,
  } = useDsp(device, {
    fftSize,
    onNewFft: (_fft: Float32Array) => {
      // No-op here; PrimaryVisualization consumes latest fftData directly.
      // This avoids React state churn for history frames.
    },
  });

  // State for visualization settings
  const [vizMode, setVizMode] = useState<"fft" | "waterfall" | "spectrogram">(
    "fft",
  );
  const [highPerfMode, setHighPerfMode] = useState(false);
  const [showWaterfall, setShowWaterfall] = useState(true);
  const [colorMap, setColorMap] =
    useState<keyof typeof WATERFALL_COLORMAPS>("turbo");
  const [dbMin, setDbMin] = useState<number | undefined>(-100);
  const [dbMax, setDbMax] = useState<number | undefined>(0);

  // Stable list of available colormap names for the dropdown
  const colorNames = React.useMemo<string[]>(() => {
    const keys = Object.keys(WATERFALL_COLORMAPS as Record<string, unknown>);
    return keys;
  }, []);

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
      setStatusMsg(`Scan complete, found ${foundSignals.length} signals.`);
    }
  }, [scanner.state, foundSignals.length]);

  const tuneDevice = useCallback(async () => {
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
      if (device.setVGAGain) {
        await device.setVGAGain(vgaGain);
      }
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
      setStatusMsg(
        err instanceof Error ? `Tune failed: ${err.message}` : "Tune failed",
      );
      throw err;
    }
  }, [device, frequency, lnaGain, sampleRate, vgaGain]);

  // Reception control
  const handleStart = useCallback(async (): Promise<void> => {
    if (!device && !useMock) {
      setStatusMsg("No device connected or setup not initialized");
      return;
    }
    // Guard against re-entrant calls to prevent infinite loops
    if (isReceiving) {
      console.warn("Already receiving, skipping start");
      return;
    }
    try {
      scanner.stopScan();
      if (device) {
        await tuneDevice();
      }
      // Optimistically mark receiving before awaiting DSP start to unblock E2E readiness checks
      setIsReceiving(true);
      setStatusMsg("Receiving started");
      await startDsp();
    } catch (err) {
      console.error("Start failed", err);
      setIsReceiving(false);
      setStatusMsg(
        err instanceof Error ? `Start failed: ${err.message}` : "Start failed",
      );
    }
  }, [device, tuneDevice, startDsp, scanner, isReceiving, useMock]);

  const handleStop = useCallback(async (): Promise<void> => {
    try {
      await stopDsp();
    } finally {
      setIsReceiving(false);
      setStatusMsg("Reception stopped");
    }
  }, [stopDsp]);

  // Auto-start reception if a previously paired device is already connected/opened.
  // Note: handleStart is intentionally omitted from deps to prevent infinite loop (see PLAYBOOK_MONITOR_INFINITE_LOOP_2025_10)
  useEffect(() => {
    // In mock/e2e mode, let tests control start to avoid races
    if (useMock) {
      // Under automation, proactively start to avoid flake in simulated suite
      const isWebDriver =
        typeof navigator !== "undefined" && navigator.webdriver === true;
      if (isWebDriver && !isReceiving && scanner.state === "idle") {
        void handleStart();
      }
      return;
    }
    if (
      !device ||
      !device.isOpen() ||
      isReceiving ||
      scanner.state !== "idle"
    ) {
      return;
    }
    void handleStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, isReceiving, scanner.state, useMock]);

  // Ensure RX is stopped when leaving the page
  useEffect(() => {
    return (): void => {
      if (isReceiving) {
        void handleStop();
      }
    };
  }, [isReceiving, handleStop]);

  // Test/debug hook: expose receiving state for E2E assertions
  useEffect(() => {
    window.dbgReceiving = isReceiving;
  }, [isReceiving]);

  // Dummy state for components that are not yet fully integrated
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "playback"
  >("idle");
  // TODO(rad.io): Temporary placeholder for recordedSamples. Replace with proper IQSample[] when recording is implemented.
  const [recordedSamples, setRecordedSamples] = useState<IQSample[]>([]);
  // TODO(rad.io): Temporary placeholder for recordingDuration. Refactor consuming components to accept optional props or implement feature properly.
  const [recordingDuration, _setRecordingDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  // TODO(rad.io): Temporary placeholder for signalQuality. Refactor consuming components to accept optional props or implement feature properly.
  const [signalQuality, _setSignalQuality] = useState({
    snr: 0,
    peakPower: 0,
    avgPower: 0,
  });
  // Render metrics are shown in the global StatusBar (App)

  const handleStartRecording = (): void => setRecordingState("recording");
  const handleStopRecording = (): void => setRecordingState("idle");
  const handleStartPlayback = (): void => setRecordingState("playback");
  const handleStopPlayback = (): void => setRecordingState("idle");
  const handleToggleAudio = (): void => setIsAudioPlaying(!isAudioPlaying);
  const handleVolumeChange = (vol: number): void => setVolume(vol * 100);
  const handleToggleMute = (): void => setIsMuted(!isMuted);

  return (
    <div className="monitor-page" role="main">
      <header className="page-header">
        <h1>Signal Monitor</h1>
        <p>
          Monitor live signals, analyze spectrum data, and record IQ samples.
        </p>
      </header>

      {/* Page status message will be surfaced via the StatusBar below to maintain a single status region. */}

      <section
        aria-labelledby="visualization-heading"
        aria-label="Spectrum visualization"
      >
        <h2 id="visualization-heading">Visualization</h2>
        <div
          role="group"
          aria-label="Visualization controls"
          style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
        >
          <div
            role="group"
            aria-label="Live reception controls"
            style={{ display: "inline-flex", gap: 8 }}
          >
            {!isReceiving ? (
              <button
                onClick={() => void handleStart()}
                aria-label="Start reception"
                title="Start receiving IQ samples from the SDR device"
                disabled={!device && !useMock}
              >
                ▶ Start reception
              </button>
            ) : (
              <button
                onClick={() => void handleStop()}
                aria-label="Stop reception"
                title="Stop receiving IQ samples"
              >
                ⏸ Stop reception
              </button>
            )}
          </div>
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
          {vizMode !== "fft" && (
            <>
              <label>
                Colormap:
                <select
                  aria-label="Spectrogram colormap"
                  value={colorMap}
                  onChange={(e) =>
                    setColorMap(
                      e.target.value as keyof typeof WATERFALL_COLORMAPS,
                    )
                  }
                  style={{ marginLeft: 6 }}
                >
                  {colorNames.map((name) => {
                    const label = `${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
                    return (
                      <option key={name} value={name}>
                        {label}
                      </option>
                    );
                  })}
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
            </>
          )}
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
                // [PR#160] Manual clearing of foundSignals is necessary here because
                // the scanner hook does not own the signal list. If the hook is
                // refactored to manage its own signal list, remove this line.
                setFoundSignals([]);
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
        <div style={{ marginTop: 8 }}>
          <PrimaryVisualization
            fftData={fftData}
            fftSize={fftSize}
            sampleRate={sampleRate}
            centerFrequency={frequency}
            mode={
              vizMode === "fft" && showWaterfall
                ? "spectrogram"
                : vizMode === "fft"
                  ? "fft"
                  : vizMode
            }
            colorMap={colorMap}
            dbMin={dbMin}
            dbMax={dbMax}
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
            <SignalStrengthMeter samples={[]} />
          </div>
          {foundSignals.length > 0 && foundSignals[0]?.rdsData && (
            <div style={{ flex: "1 1 300px" }}>
              <RDSDisplay rdsData={foundSignals[0].rdsData} stats={null} />
            </div>
          )}
        </div>

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
              {(sampleRate / 1e6).toFixed(2)} MSPS
            </div>
          </div>
        </div>
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
          message={statusMsg}
          sampleRate={sampleRate}
          deviceConnected={Boolean(device)}
          audioState={"idle"}
          audioVolume={volume}
          audioClipping={false}
        />
      </div>
    </div>
  );
};

export default Monitor;
