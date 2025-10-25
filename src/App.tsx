import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
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
      <div>
        <header className="header" role="banner">
          <h1>rad.io</h1>
          <p>Software-Defined Radio Visualizer</p>
          <Navigation />
        </header>

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
      </div>
    </Router>
  );
}

export default App;
