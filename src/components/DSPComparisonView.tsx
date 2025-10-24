import React, { useState } from "react";
import FFTChart from "./FFTChart";
import IQConstellation from "./IQConstellation";
import WaveformChart from "./WaveformChart";
import type { DSPPipelineStage } from "../hooks/useDSPPipeline";
import type { Sample } from "../utils/dsp";

export type DSPComparisonViewProps = {
  stage: DSPPipelineStage;
};

function renderVis(
  data: Sample[] | Float32Array | null,
  stageId: DSPPipelineStage["id"],
): React.JSX.Element | null {
  switch (stageId) {
    case "rf-input":
    case "tuner":
      return <WaveformChart samples={(data as Sample[]) || []} />;
    case "iq-sampling":
      return <IQConstellation samples={(data as Sample[]) || []} />;
    case "fft":
      return <FFTChart samples={(data as Sample[]) || []} />;
    case "demodulation":
    case "audio-output":
      // No visualization for these stages yet
      return null;
    default:
      return null;
  }
}

export default function DSPComparisonView({
  stage,
}: DSPComparisonViewProps): React.JSX.Element {
  const [mode, setMode] = useState<"split" | "overlay">("split");
  return (
    <div className="dsp-comparison-view" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 8 }}>
        <label htmlFor="comparison-mode" style={{ marginRight: 8 }}>
          Comparison Mode:
        </label>
        <select
          id="comparison-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as "split" | "overlay")}
        >
          <option value="split">Split View</option>
          <option value="overlay">Overlay</option>
        </select>
      </div>
      {mode === "split" ? (
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>Input</div>
            {renderVis(stage.inputData, stage.id)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>Output</div>
            {renderVis(stage.outputData, stage.id)}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>Overlay</div>
          {/* For overlay, just show both visualizations stacked for now */}
          {renderVis(stage.inputData, stage.id)}
          {renderVis(stage.outputData, stage.id)}
        </div>
      )}
    </div>
  );
}
