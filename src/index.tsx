import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/main.css";
import { DeviceProvider } from "./contexts/DeviceContext";

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
