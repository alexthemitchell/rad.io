import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FrequencyDisplay from "./components/FrequencyDisplay";
import Navigation from "./components/Navigation";
import StatusFooter from "./components/StatusFooter";
import TopAppBar from "./components/TopAppBar";
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
      <div className="app-shell">
        {/* Global top bar with connection status and quick actions */}
        <TopAppBar />

        {/* Main header with title and navigation */}
        <header className="header" role="banner">
          <div className="header-content">
            <div className="header-title">
              <h1>rad.io</h1>
              <p>Software-Defined Radio Visualizer</p>
            </div>
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

        {/* Global footer with system metrics */}
        <StatusFooter />
      </div>
    </Router>
  );
}

export default App;
