import { useEffect } from "react";
import VisualizerPage from "./pages/Visualizer";
import { preloadWasmModule } from "./utils/dspWasm";

function App() {
  // Preload WASM module on app initialization for better performance
  useEffect(() => {
    preloadWasmModule();
  }, []);

  return (
    <div>
      <VisualizerPage />
    </div>
  );
}

export default App;
