import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/main.css";
import { DeviceProvider } from "./contexts/DeviceContext";
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
root.render(
  <DeviceProvider>
    <App />
  </DeviceProvider>,
);
