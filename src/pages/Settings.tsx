import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  WATERFALL_COLORMAP_NAMES,
  type WaterfallColormapName,
} from "../constants";
import { useSettings } from "../contexts";

/**
 * Settings page with tabbed interface
 *
 * Purpose: Application configuration across multiple categories
 * Dependencies: ADR-0009 (State Management), ADR-0005 (Storage)
 *
 * Tabs:
 * - Display: Theme, colormap, FFT size, window function, dB range
 * - Radio: Default mode, squelch, AGC, audio filters
 * - Audio: Output device, volume, sample rate, buffer size
 * - Calibration: Quick access to calibration wizard
 * - Advanced: Worker pool size, GPU mode, debug logging, experimental features
 *
 * Patterns:
 * - Persist via localStorage (or IndexedDB for larger configs)
 * - Validation via Zod schemas
 * - Profile export/import (future)
 *
 * TODO: Implement tabbed interface
 * TODO: Add Display settings (theme, palette, FFT, window, dB range)
 * TODO: Add Radio settings (mode, squelch, AGC, filters)
 * TODO: Add Audio settings (device, volume, sample rate, buffer)
 * TODO: Add Advanced settings (workers, GPU, debug, experimental)
 * TODO: Implement save/restore with validation
 * TODO: Add profile export/import (future)
 */
function Settings(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<
    "display" | "radio" | "audio" | "calibration" | "advanced"
  >("display");
  // Notifications will be integrated when actions are implemented
  const { settings, setSettings, resetSettings } = useSettings();
  const colorNames = useMemo<WaterfallColormapName[]>(
    () => WATERFALL_COLORMAP_NAMES,
    [],
  );

  return (
    <main className="page-container" aria-labelledby="settings-heading">
      <h2 id="settings-heading">Settings</h2>

      <nav aria-label="Settings tabs">
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "display"}
            aria-controls="display-panel"
            onClick={() => setActiveTab("display")}
          >
            Display
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "radio"}
            aria-controls="radio-panel"
            onClick={() => setActiveTab("radio")}
          >
            Radio
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "audio"}
            aria-controls="audio-panel"
            onClick={() => setActiveTab("audio")}
          >
            Audio
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "calibration"}
            aria-controls="calibration-panel"
            onClick={() => setActiveTab("calibration")}
          >
            Calibration
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "advanced"}
            aria-controls="advanced-panel"
            onClick={() => setActiveTab("advanced")}
          >
            Advanced
          </button>
        </div>
      </nav>

      {activeTab === "display" && (
        <section
          id="display-panel"
          role="tabpanel"
          aria-labelledby="display-tab"
        >
          <h3>Display Settings</h3>
          <div
            style={{
              display: "grid",
              gap: 12,
              alignItems: "center",
              maxWidth: 720,
            }}
          >
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>Visualization mode:</span>
              <select
                aria-label="Visualization mode"
                value={settings.vizMode}
                onChange={(e) =>
                  setSettings({
                    vizMode: e.target.value as
                      | "fft"
                      | "waterfall"
                      | "spectrogram",
                  })
                }
              >
                <option value="fft">FFT</option>
                <option value="waterfall">Waterfall</option>
                <option value="spectrogram">Spectrogram</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>FFT Size:</span>
              <select
                aria-label="FFT size"
                value={settings.fftSize}
                onChange={(e) =>
                  setSettings({ fftSize: parseInt(e.target.value, 10) })
                }
              >
                {[1024, 2048, 4096, 8192].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {settings.vizMode === "fft" && (
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={settings.showWaterfall}
                  onChange={(e) =>
                    setSettings({ showWaterfall: e.target.checked })
                  }
                  aria-label="Toggle waterfall visualization"
                />
                <span>Show Waterfall</span>
              </label>
            )}
            {settings.vizMode !== "fft" && (
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>Colormap:</span>
                <select
                  aria-label="Spectrogram colormap"
                  value={settings.colorMap}
                  onChange={(e) => setSettings({ colorMap: e.target.value })}
                >
                  {colorNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>dB Floor:</span>
                <input
                  type="number"
                  placeholder="auto"
                  value={settings.dbMin ?? ""}
                  onChange={(e) =>
                    setSettings({
                      dbMin:
                        e.target.value === ""
                          ? undefined
                          : parseFloat(e.target.value),
                    })
                  }
                  aria-label="Manual dB floor (leave blank for auto)"
                  style={{ width: 100 }}
                />
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>dB Ceil:</span>
                <input
                  type="number"
                  placeholder="auto"
                  value={settings.dbMax ?? ""}
                  onChange={(e) =>
                    setSettings({
                      dbMax:
                        e.target.value === ""
                          ? undefined
                          : parseFloat(e.target.value),
                    })
                  }
                  aria-label="Manual dB ceiling (leave blank for auto)"
                  style={{ width: 100 }}
                />
              </label>
            </div>
            <div>
              <button
                type="button"
                onClick={() => resetSettings()}
                aria-label="Reset rendering settings to defaults"
              >
                Restore Display Defaults
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === "radio" && (
        <section id="radio-panel" role="tabpanel" aria-labelledby="radio-tab">
          <h3>Radio Settings</h3>
          {/* TODO: Default modulation mode */}
          {/* TODO: Squelch threshold */}
          {/* TODO: AGC settings */}
          {/* TODO: Audio filter presets */}
          <p>Radio settings coming soon</p>
        </section>
      )}

      {activeTab === "audio" && (
        <section id="audio-panel" role="tabpanel" aria-labelledby="audio-tab">
          <h3>Audio Settings</h3>
          {/* TODO: Output device selector */}
          {/* TODO: Volume control */}
          {/* TODO: Sample rate selector */}
          {/* TODO: Buffer size selector */}
          <p>Audio settings coming soon</p>
        </section>
      )}

      {activeTab === "calibration" && (
        <section
          id="calibration-panel"
          role="tabpanel"
          aria-labelledby="calibration-tab"
        >
          <h3>Calibration</h3>
          {/* TODO: Link to calibration wizard */}
          {/* TODO: Current calibration profile display */}
          {/* TODO: Last calibration date */}
          <p>Go to the Calibration page for full calibration wizard</p>
          <Link to="/calibration">Open Calibration Wizard</Link>
        </section>
      )}

      {activeTab === "advanced" && (
        <section
          id="advanced-panel"
          role="tabpanel"
          aria-labelledby="advanced-tab"
        >
          <h3>Advanced Settings</h3>
          {/* TODO: Worker pool size */}
          {/* TODO: GPU mode selector (WebGL2/WebGPU/Auto) */}
          {/* TODO: Debug logging toggle */}
          {/* TODO: Experimental features */}
          <div
            style={{
              display: "grid",
              gap: 12,
              alignItems: "center",
              maxWidth: 720,
            }}
          >
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={settings.highPerf}
                onChange={(e) => setSettings({ highPerf: e.target.checked })}
                aria-label="High performance mode"
              />
              <span>High performance mode</span>
            </label>
          </div>
        </section>
      )}

      <section aria-label="Actions">
        <button disabled title="Not implemented yet">
          Save Settings
        </button>
        <button disabled title="Not implemented yet">
          Reset to Defaults
        </button>
        {/* TODO: Export/import settings profile (future) */}
      </section>
    </main>
  );
}

export default Settings;
