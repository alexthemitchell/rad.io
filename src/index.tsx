import { createRoot } from "react-dom/client";
import App from "./App";

const appElement = document.getElementById("app");
if (!appElement) {
  throw new Error("Unable to find app div");
}
const root = createRoot(appElement);
root.render(<App />);
