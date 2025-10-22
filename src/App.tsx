import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import LiveMonitor from "./pages/LiveMonitor";
import Scanner from "./pages/Scanner";
import Analysis from "./pages/Analysis";
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
          <Route path="/" element={<LiveMonitor />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/analysis" element={<Analysis />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
