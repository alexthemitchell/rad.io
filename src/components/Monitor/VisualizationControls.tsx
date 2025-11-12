import React, { type CSSProperties } from "react";
import {
  WATERFALL_COLORMAPS,
  WATERFALL_COLORMAP_NAMES,
  type WaterfallColormapName,
} from "../../constants";
import { useSettings } from "../../store";
import { formatFrequency, formatSampleRate } from "../../utils/frequency";
import type { VizMode } from "../../store/slices/settingsSlice";

interface VisualizationControlsProps {
  sampleRateHz: number;
  usableBandwidthHz: number;
  centerFrequencyHz: number;
}

/**
 * Overlay controls for the primary visualization
 *
 * Provides quick access to common visualization settings without navigating to Settings page.
 * Inspired by industry-standard SDR applications like SDRangel and GQRX.
 */
const VisualizationControls: React.FC<VisualizationControlsProps> = ({
  sampleRateHz,
  usableBandwidthHz,
  centerFrequencyHz,
}) => {
  const { settings, setSettings } = useSettings();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const safeBandwidth = Math.max(0, usableBandwidthHz);
  const halfSpanHz = safeBandwidth / 2;
  const lowerEdgeHz = Math.max(0, centerFrequencyHz - halfSpanHz);
  const upperEdgeHz = centerFrequencyHz + halfSpanHz;
  const centerLabel = formatFrequency(centerFrequencyHz);
  const spanRangeLabel =
    safeBandwidth > 0
      ? `${formatFrequency(lowerEdgeHz)} – ${formatFrequency(upperEdgeHz)}`
      : centerLabel;
  const halfSpanLabel = `${(halfSpanHz / 1e6).toFixed(2)} MHz`;
  const usableLabel = `${(safeBandwidth / 1e6).toFixed(2)} MHz usable`;
  const sampleRateLabel = formatSampleRate(sampleRateHz);

  const handleModeChange = (mode: VizMode): void => {
    setSettings({ vizMode: mode });
  };

  const handleColormapChange = (colormap: WaterfallColormapName): void => {
    setSettings({ colorMap: colormap });
  };

  const handleDbMinChange = (value: number | undefined): void => {
    setSettings({ dbMin: value });
  };

  const handleDbMaxChange = (value: number | undefined): void => {
    setSettings({ dbMax: value });
  };

  const handleFFTSizeChange = (size: number): void => {
    setSettings({ fftSize: size });
  };

  const toggleWaterfall = (): void => {
    setSettings({ showWaterfall: !settings.showWaterfall });
  };

  const toggleMultiStation = (): void => {
    setSettings({ multiStationEnabled: !settings.multiStationEnabled });
  };

  const toggleMultiStationRDS = (): void => {
    setSettings({ multiStationEnableRDS: !settings.multiStationEnableRDS });
  };

  const handleMultiChannelBandwidth = (hz: number): void => {
    setSettings({ multiStationChannelBandwidthHz: hz });
  };

  const handleMultiScanFFTSize = (size: number): void => {
    setSettings({ multiStationScanFFTSize: size });
  };

  const handleMultiScanInterval = (ms: number): void => {
    setSettings({ multiStationScanIntervalMs: ms });
  };

  const resetDbRange = (): void => {
    setSettings({ dbMin: undefined, dbMax: undefined });
  };

  // Styles
  const containerStyle: CSSProperties = {
    position: "absolute",
    top: "12px",
    right: "12px",
    zIndex: 10,
    background: "rgba(10, 14, 26, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    backdropFilter: "blur(8px)",
    boxShadow:
      "0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)",
    maxWidth: isExpanded ? "280px" : "auto",
    transition: "all 0.2s ease",
  };

  const toggleButtonStyle: CSSProperties = {
    display: "flex",
    alignItems: "stretch",
    width: "100%",
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    color: "#e0e6ed",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s ease",
  };

  const controlsStyle: CSSProperties = {
    padding: "0 12px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const sectionStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const labelTextStyle: CSSProperties = {
    color: "#a0aec0",
    fontWeight: 500,
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const modeButtonsStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "4px",
  };

  const getModeButtonStyle = (active: boolean): CSSProperties => ({
    padding: "6px 8px",
    background: active ? "#3b82f6" : "rgba(255, 255, 255, 0.05)",
    border: `1px solid ${active ? "#3b82f6" : "rgba(255, 255, 255, 0.1)"}`,
    borderRadius: "4px",
    color: active ? "white" : "#e0e6ed",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontWeight: 500,
  });

  const selectStyle: CSSProperties = {
    padding: "6px 8px",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "4px",
    color: "#e0e6ed",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  };

  const gradientBarStyle: CSSProperties = {
    height: "20px",
    borderRadius: "4px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    marginTop: "4px",
  };

  const infoStyle: CSSProperties = {
    fontSize: "11px",
    color: "#718096",
    fontFamily: "Monaco, Menlo, monospace",
    padding: "4px 8px",
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: "4px",
  };

  const numberInputStyle: CSSProperties = {
    flex: 1,
    padding: "4px 8px",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "4px",
    color: "#e0e6ed",
    fontSize: "13px",
    fontFamily: "Monaco, Menlo, monospace",
  };

  const resetButtonStyle: CSSProperties = {
    padding: "4px 12px",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "4px",
    color: "#e0e6ed",
    fontSize: "11px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontWeight: 500,
  };

  return (
    <div style={containerStyle}>
      <button
        style={toggleButtonStyle}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? "Collapse controls" : "Expand controls"}
        aria-expanded={isExpanded}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "18px", fontWeight: "bold" }}>
              {isExpanded ? "×" : "⚙"}
            </span>
            <span style={{ fontWeight: 500 }}>
              {isExpanded ? "Visualization" : "Visualization"}
            </span>
          </div>
          {!isExpanded && (
            <span
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {centerLabel} • ±{halfSpanLabel} • {usableLabel}
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div style={controlsStyle}>
          <div style={sectionStyle}>
            <span style={labelTextStyle}>Bandwidth overview:</span>
            <div
              style={{
                ...infoStyle,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                lineHeight: "1.4",
              }}
            >
              <span>
                {centerLabel} center • {sampleRateLabel}
              </span>
              <span>Coverage {spanRangeLabel}</span>
              <span>
                Span ±{halfSpanLabel} • {usableLabel}
              </span>
            </div>
          </div>
          <div style={sectionStyle}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "13px",
              }}
            >
              <span style={labelTextStyle}>Mode:</span>
              <div style={modeButtonsStyle}>
                <button
                  style={getModeButtonStyle(settings.vizMode === "fft")}
                  onClick={() => handleModeChange("fft")}
                  aria-pressed={settings.vizMode === "fft"}
                >
                  FFT
                </button>
                <button
                  style={getModeButtonStyle(settings.vizMode === "waterfall")}
                  onClick={() => handleModeChange("waterfall")}
                  aria-pressed={settings.vizMode === "waterfall"}
                >
                  Waterfall
                </button>
                <button
                  style={getModeButtonStyle(settings.vizMode === "spectrogram")}
                  onClick={() => handleModeChange("spectrogram")}
                  aria-pressed={settings.vizMode === "spectrogram"}
                >
                  Both
                </button>
              </div>
            </div>
          </div>

          {settings.vizMode === "fft" && (
            <div style={sectionStyle}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.showWaterfall}
                  onChange={toggleWaterfall}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <span>Show Waterfall</span>
              </label>
            </div>
          )}

          {(settings.vizMode === "waterfall" ||
            settings.vizMode === "spectrogram" ||
            settings.showWaterfall) && (
            <div style={sectionStyle}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                <span style={labelTextStyle}>Colormap:</span>
                <select
                  value={settings.colorMap}
                  onChange={(e) =>
                    handleColormapChange(
                      e.target.value as WaterfallColormapName,
                    )
                  }
                  style={selectStyle}
                  aria-label="Waterfall colormap"
                >
                  {WATERFALL_COLORMAP_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  ...gradientBarStyle,
                  background: `linear-gradient(to right, ${Object.values(
                    WATERFALL_COLORMAPS[
                      settings.colorMap as keyof typeof WATERFALL_COLORMAPS
                    ],
                  )
                    .slice(0, 20)
                    .map((c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`)
                    .join(", ")})`,
                }}
              />
            </div>
          )}

          <div style={sectionStyle}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "13px",
              }}
            >
              <span style={labelTextStyle}>FFT Size:</span>
              <select
                value={settings.fftSize}
                onChange={(e) => handleFFTSizeChange(parseInt(e.target.value))}
                style={selectStyle}
                aria-label="FFT size"
              >
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
              </select>
            </div>
            <div style={infoStyle}>
              RBW:{" "}
              {(
                (settings.fftSize > 0 ? 2000000 / settings.fftSize : 0) / 1000
              ).toFixed(1)}{" "}
              kHz
            </div>
          </div>

          <div style={sectionStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={labelTextStyle}>dB Range:</span>
              <button
                onClick={resetDbRange}
                style={resetButtonStyle}
                aria-label="Auto-scale dB range"
              >
                Auto
              </button>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
              }}
            >
              <span style={{ minWidth: "32px", color: "#a0aec0" }}>Min:</span>
              <input
                type="number"
                value={settings.dbMin ?? ""}
                onChange={(e) =>
                  handleDbMinChange(
                    e.target.value === ""
                      ? undefined
                      : parseFloat(e.target.value),
                  )
                }
                placeholder="Auto"
                style={numberInputStyle}
                step="5"
                aria-label="Minimum dB"
              />
              <span
                style={{ color: "#718096", fontSize: "11px", minWidth: "24px" }}
              >
                dB
              </span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
              }}
            >
              <span style={{ minWidth: "32px", color: "#a0aec0" }}>Max:</span>
              <input
                type="number"
                value={settings.dbMax ?? ""}
                onChange={(e) =>
                  handleDbMaxChange(
                    e.target.value === ""
                      ? undefined
                      : parseFloat(e.target.value),
                  )
                }
                placeholder="Auto"
                style={numberInputStyle}
                step="5"
                aria-label="Maximum dB"
              />
              <span
                style={{ color: "#718096", fontSize: "11px", minWidth: "24px" }}
              >
                dB
              </span>
            </label>
          </div>

          <div
            style={{
              paddingTop: "8px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settings.multiStationEnabled}
                    onChange={toggleMultiStation}
                    style={{ marginRight: 6 }}
                  />
                  Wideband FM scan (multi-station)
                </label>
              </div>
              {settings.multiStationEnabled && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <label
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <input
                      type="checkbox"
                      checked={settings.multiStationEnableRDS}
                      onChange={toggleMultiStationRDS}
                    />
                    Decode RDS
                  </label>
                  <label
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <span style={{ color: "#a0aec0" }}>Chan BW:</span>
                    <input
                      type="number"
                      value={Math.round(
                        settings.multiStationChannelBandwidthHz / 1000,
                      )}
                      onChange={(e) =>
                        handleMultiChannelBandwidth(
                          Number(e.target.value) * 1000,
                        )
                      }
                      style={numberInputStyle}
                    />
                    <span style={{ color: "#718096" }}>kHz</span>
                  </label>
                </div>
              )}
            </div>
            {settings.multiStationEnabled && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <label
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  <span style={{ color: "#a0aec0" }}>Scan FFT:</span>
                  <select
                    value={settings.multiStationScanFFTSize}
                    onChange={(e) =>
                      handleMultiScanFFTSize(parseInt(e.target.value))
                    }
                    style={selectStyle}
                  >
                    <option value={1024}>1024</option>
                    <option value={2048}>2048</option>
                    <option value={4096}>4096</option>
                    <option value={8192}>8192</option>
                  </select>
                </label>

                <label
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  <span style={{ color: "#a0aec0" }}>Interval:</span>
                  <input
                    type="number"
                    value={settings.multiStationScanIntervalMs}
                    onChange={(e) =>
                      handleMultiScanInterval(Number(e.target.value))
                    }
                    style={numberInputStyle}
                  />
                  <span style={{ color: "#718096" }}>ms</span>
                </label>
              </div>
            )}
            <a
              href="/settings"
              style={{
                color: "#3b82f6",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              More settings →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizationControls;
