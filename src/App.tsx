import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FrequencyDisplay from "./components/FrequencyDisplay";
import Navigation from "./components/Navigation";
import RenderingSettingsModal from "./components/RenderingSettingsModal";
import ShortcutsOverlay from "./components/ShortcutsOverlay";
import StatusBar from "./components/StatusBar";
import ToastProvider from "./components/ToastProvider";
import TopAppBar from "./components/TopAppBar";
import { useDeviceIntegration } from "./hooks/useDeviceIntegration";
import { useDSPInitialization } from "./hooks/useDSPInitialization";
import { useFrequencySync } from "./hooks/useFrequencySync";
import { useStatusMetrics } from "./hooks/useStatusMetrics";
import Analysis from "./pages/Analysis";
import ATSCPlayer from "./pages/ATSCPlayer";
import Calibration from "./pages/Calibration";
import Decode from "./pages/Decode";
import Help from "./pages/Help";
import Monitor from "./pages/Monitor";
import Recordings from "./pages/Recordings";
import Scanner from "./pages/Scanner";
import Settings from "./pages/Settings";
import Bookmarks from "./panels/Bookmarks";
import Devices from "./panels/Devices";
import Diagnostics from "./panels/Diagnostics";
import Measurements from "./panels/Measurements";
import { useFrequency } from "./store";
import { preloadWasmModule } from "./utils/dspWasm";

function App(): React.JSX.Element {
  // Preload WASM module on app initialization for better performance
  useEffect(() => {
    preloadWasmModule();
  }, []);

  // Initialize DSP environment detection and capability reporting
  useDSPInitialization();

  // Initialize device management integration (bridges React hooks with Zustand store)
  useDeviceIntegration();

  // Initialize frequency synchronization (automatically retunes device when frequency changes)
  useFrequencySync();

  // Initialize status metrics collection (hook manages its own subscriptions)
  const metrics = useStatusMetrics();
  const [showRenderingSettings, setShowRenderingSettings] = useState(false);

  return (
    <Router>
      <ToastProvider>
        <div className="app-shell">
          {/* Skip link: first focusable element for keyboard users */}
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>

          {/* Live regions handled within ToastProvider */}

          {/* Global top bar with connection status and quick actions */}
          <TopAppBar asBanner />

          {/* Main header with title and navigation */}
          <header className="header" role="banner">
            <div className="header-content">
              {/* Always-visible frequency display + VFO control (shared state) */}
              <SharedVFO />
              {/* Application title & tagline for branding and tests */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h1 className="app-title" style={{ margin: 0, fontSize: 18 }}>
                  rad.io
                </h1>
                <span
                  className="app-tagline"
                  style={{ fontSize: 12, opacity: 0.85 }}
                >
                  Software-Defined Radio Visualizer
                </span>
              </div>
            </div>
            <Navigation />
          </header>

          {/* Main content area for pages */}
          <main id="main-content" tabIndex={-1} style={{ paddingBottom: 56 }}>
            <Routes>
              {/* Primary workspaces */}
              <Route path="/" element={<Monitor />} />
              <Route path="/monitor" element={<Monitor />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/decode" element={<Decode />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/recordings" element={<Recordings />} />
              <Route path="/atsc-player" element={<ATSCPlayer />} />

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

              {/* Demo pages removed */}
            </Routes>
          </main>

          {/* Global StatusBar pinned to bottom of viewport */}
          <StatusBar
            message={undefined}
            renderTier={metrics.renderTier}
            fps={metrics.fps}
            inputFps={metrics.inputFps}
            droppedFrames={metrics.droppedFrames}
            renderP95Ms={metrics.renderP95Ms}
            longTasks={metrics.longTasks}
            sampleRate={metrics.sampleRate}
            bufferHealth={metrics.bufferHealth}
            bufferDetails={metrics.bufferDetails}
            storageUsed={metrics.storageUsed}
            storageQuota={metrics.storageQuota}
            deviceConnected={metrics.deviceConnected}
            audioState={metrics.audio.state}
            audioVolume={Math.round((metrics.audio.volume ?? 0) * 100)}
            audioClipping={metrics.audio.clipping}
            onOpenRenderingSettings={() => setShowRenderingSettings(true)}
          />

          {/* Global shortcuts help overlay (toggles with '?') */}
          <ShortcutsOverlay />

          <RenderingSettingsModal
            isOpen={showRenderingSettings}
            onClose={() => setShowRenderingSettings(false)}
          />
          {/* Footer intentionally minimal to keep focus on primary tasks */}
        </div>
      </ToastProvider>
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
    </div>
  );
}
