import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FrequencyDisplay from "./components/FrequencyDisplay";
import Navigation from "./components/Navigation";
import RenderingSettingsModal from "./components/RenderingSettingsModal";
import ShortcutsOverlay from "./components/ShortcutsOverlay";
import ToastProvider from "./components/ToastProvider";
import TopAppBar from "./components/TopAppBar";
import VFOControl from "./components/VFOControl";
import { FrequencyProvider, useFrequency } from "./contexts/FrequencyContext";
import { useStatusMetrics } from "./hooks/useStatusMetrics";
import Analysis from "./pages/Analysis";
import Calibration from "./pages/Calibration";
import Decode from "./pages/Decode";
import Help from "./pages/Help";
import Monitor from "./pages/Monitor";
import Recordings from "./pages/Recordings";
import RenderersDemo from "./pages/RenderersDemo";
import Scanner from "./pages/Scanner";
import Settings from "./pages/Settings";
import VisualizationDemo from "./pages/VisualizationDemo";
import Bookmarks from "./panels/Bookmarks";
import Devices from "./panels/Devices";
import Diagnostics from "./panels/Diagnostics";
import Measurements from "./panels/Measurements";
import { preloadWasmModule } from "./utils/dspWasm";

function App(): React.JSX.Element {
  // Preload WASM module on app initialization for better performance
  useEffect(() => {
    preloadWasmModule();
  }, []);

  const _metrics = useStatusMetrics();
  const [showRenderingSettings, setShowRenderingSettings] = useState(false);

  return (
    <Router>
      <FrequencyProvider>
        <ToastProvider>
          <div className="app-shell">
            {/* Skip link: first focusable element for keyboard users */}
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>

            {/* Live regions handled within ToastProvider */}

            {/* Global top bar with connection status and quick actions */}
            <TopAppBar asBanner={false} />

            {/* Main header with title and navigation */}
            <header className="header" role="banner">
              <div className="header-content">
                {/* Maintain accessible document title and subtitle */}
                <h1>rad.io</h1>
                <p>Software-Defined Radio Visualizer</p>
                {/* Always-visible frequency display + VFO control (shared state) */}
                <SharedVFO />
              </div>
              <Navigation />
            </header>

            {/* Main content area for pages */}
            <main id="main-content" tabIndex={-1}>
              <Routes>
                {/* Primary workspaces */}
                <Route path="/" element={<Monitor />} />
                <Route path="/monitor" element={<Monitor />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/decode" element={<Decode />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/recordings" element={<Recordings />} />

                {/* Supporting panels (also accessible as full pages) */}
                <Route
                  path="/bookmarks"
                  element={<Bookmarks isPanel={false} />}
                />
                <Route path="/devices" element={<Devices isPanel={false} />} />
                <Route
                  path="/measurements"
                  element={<Measurements isPanel={false} />}
                />
                <Route
                  path="/diagnostics"
                  element={<Diagnostics isPanel={false} />}
                />

                {/* Settings and configuration */}
                <Route path="/settings" element={<Settings />} />
                <Route path="/calibration" element={<Calibration />} />

                {/* Help and documentation */}
                <Route path="/help" element={<Help />} />

                {/* Demo pages */}
                <Route path="/demo" element={<VisualizationDemo />} />
                <Route path="/renderers-demo" element={<RenderersDemo />} />
              </Routes>
            </main>

            {/* Global shortcuts help overlay (toggles with '?') */}
            <ShortcutsOverlay />

            {/* Page-level StatusBar components provide status; no global duplicate here */}
            <RenderingSettingsModal
              isOpen={showRenderingSettings}
              onClose={() => setShowRenderingSettings(false)}
            />
            {/* Footer intentionally minimal to keep focus on primary tasks */}
          </div>
        </ToastProvider>
      </FrequencyProvider>
    </Router>
  );
}

export default App;

// Small internal component to bridge FrequencyContext into header controls
function SharedVFO(): React.JSX.Element {
  const { frequencyHz, setFrequencyHz } = useFrequency();
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <FrequencyDisplay frequency={frequencyHz} onChange={setFrequencyHz} />
      <VFOControl frequencyHz={frequencyHz} onChange={setFrequencyHz} />
    </div>
  );
}
