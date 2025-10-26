import { useState } from "react";
import { Link } from "react-router-dom";

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
          {/* TODO: Theme selector (light/dark/auto) */}
          {/* TODO: Colormap selection (Viridis, Plasma, etc.) */}
          {/* TODO: FFT size selector */}
          {/* TODO: Window function selector */}
          {/* TODO: dB range controls (min/max) */}
          <p>Display settings coming soon</p>
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
          <p>Advanced settings coming soon</p>
        </section>
      )}

      <section aria-label="Actions">
        <button>Save Settings</button>
        <button>Reset to Defaults</button>
        {/* TODO: Export/import settings profile (future) */}
      </section>
    </main>
  );
}

export default Settings;
