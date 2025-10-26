import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FrequencyDisplay from "./components/FrequencyDisplay";
import Navigation from "./components/Navigation";
import TopAppBar from "./components/TopAppBar";
import { DeviceProvider } from "./contexts/DeviceContext";
import Analysis from "./pages/Analysis";
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
import { preloadWasmModule } from "./utils/dspWasm";

function App(): React.JSX.Element {
  // Preload WASM module on app initialization for better performance
  useEffect(() => {
    preloadWasmModule();
  }, []);

  return (
    <Router>
      <DeviceProvider>
        <div className="app-shell">
          {/* Skip link: first focusable element for keyboard users */}
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>

          {/* Global live region for announcements (visually hidden).
              Use aria-live without role to avoid duplicate 'status' landmarks.
          */}
          <div
            aria-live="polite"
            aria-atomic="true"
            className="visually-hidden"
          />

          {/* Global top bar with connection status and quick actions */}
          <TopAppBar asBanner={false} />

          {/* Main header with title and navigation */}
          <header className="header" role="banner">
            <div className="header-content">
              {/* Maintain accessible document title and subtitle */}
              <h1 className="visually-hidden">rad.io</h1>
              <p className="visually-hidden">
                Software-Defined Radio Visualizer
              </p>
              {/* Always-visible frequency display */}
              <FrequencyDisplay />
            </div>
            <Navigation />
          </header>

          {/* Main content area for pages */}
          <Routes>
            {/* Primary workspaces */}
            <Route path="/" element={<Monitor />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/decode" element={<Decode />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/recordings" element={<Recordings />} />

            {/* Supporting panels (also accessible as full pages) */}
            <Route path="/bookmarks" element={<Bookmarks isPanel={false} />} />
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
          </Routes>

          {/* Footer intentionally minimal to keep focus on primary tasks */}
        </div>
      </DeviceProvider>
    </Router>
  );
}

export default App;
