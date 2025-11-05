import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/main.css";
// DeviceProvider is no longer needed with Zustand - device integration handled in App.tsx
import { registerBuiltinDrivers } from "./drivers";

// Register all built-in SDR drivers before the app renders to ensure
// driver metadata (USB filters) are available during initial render.
// This prevents a race where hooks read an empty registry on first mount.
registerBuiltinDrivers();

const appElement = document.getElementById("app");
if (!appElement) {
  throw new Error("Unable to find app div");
}
const root = createRoot(appElement);
root.render(<App />);

// Ensure we attempt a graceful device/worker teardown on HMR full reloads
// and normal navigations. These hooks are best-effort and non-blocking.

const callGlobalShutdown = (): void => {
  try {
    interface GlobalWithRadio {
      radIo?: { shutdown?: () => Promise<void> };
    }
    const g = globalThis as unknown as GlobalWithRadio;
    if (g.radIo?.shutdown) {
      // Fire and forget; cannot await during dispose/unload
      void g.radIo.shutdown();
    }
  } catch {
    // no-op
  }
};

// Webpack HMR dispose callback
interface HotModule {
  hot?: {
    dispose: (callback: () => void) => void;
  };
}
const hotModule = module as unknown as HotModule;
if (hotModule.hot) {
  hotModule.hot.dispose(() => {
    callGlobalShutdown();
  });
}

// Best-effort on navigation away
window.addEventListener("beforeunload", () => {
  callGlobalShutdown();
});
