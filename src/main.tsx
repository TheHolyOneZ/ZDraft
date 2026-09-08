import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { installPlantUmlRunner } from "./lib/plantumlRunner";
import "./index.css";


installPlantUmlRunner();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
