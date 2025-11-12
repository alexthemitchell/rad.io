import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/main.css";
// DeviceProvider is no longer needed with Zustand - device integration handled in App.tsx
import { registerBuiltinDrivers } from "./drivers";
import { seedDebugRDS } from "./lib/devRDS";

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

// Expose debug helpers in development mode for deterministic E2E testing
if (process.env["NODE_ENV"] !== "production") {
  // Load dev-only helpers lazily to keep production bundle smaller and avoid
  // disallowed `require()` usage flagged by the linter.
  void (async (): Promise<void> => {
    const [{ createRDSDecoder }, { getAllCachedStations }] = await Promise.all([
      import("./utils/rdsDecoder"),
      import("./store/rdsCache"),
    ]);
    const debugDecoder = createRDSDecoder(228000);
    (globalThis as any).__DEV_RDS__ = {
      seedDebugRDS,
      getDebugRDS: () => getAllCachedStations(),
      // Attach decoder helpers using safe, typed proxies
      injectGroup: (group: unknown): void => {
        (debugDecoder as { injectGroup?: (g: unknown) => void }).injectGroup?.(group);
      },
      getDecoderStats: () => (debugDecoder as { getStats?: () => unknown }).getStats?.(),
    };
  })();
}

// Small helper to capture latest console messages for automated tests
if (process.env["NODE_ENV"] !== "production") {
  (globalThis as any).__lastConsoleLogged = null as string | null;

  const origWarn = console.warn;
  console.warn = function (...args: unknown[]): void {
    (globalThis as any).__lastConsoleLogged = args.map(String).join(" ");
    // origWarn expects any[]; cast to any for compatibility
    origWarn.apply(console, args as any[]);
  } as unknown as typeof console.warn;
}
