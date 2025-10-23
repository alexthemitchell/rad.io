import React from "react";
import DSPStageControls from "./DSPStageControls";
import type { DSPPipelineStage } from "../hooks/useDSPPipeline";

export type DSPStagePanelProps = {
  stage: DSPPipelineStage;
  onParameterChange: (param: string, value: number | boolean | string) => void;
  onReset: () => void;
};

export default function DSPStagePanel({
  stage,
  onParameterChange,
  onReset,
}: DSPStagePanelProps): React.JSX.Element {
  return (
    <div className="dsp-stage-panel">
      <div className="card-title">{stage.name}</div>
      <div className="card-subtitle">{stage.description}</div>
      <div style={{ marginTop: 8 }}>
        {/* Metrics table */}
        <table style={{ marginBottom: 16 }}>
          <tbody>
            {Object.entries(stage.metrics).map(([key, value]) => (
              <tr key={key}>
                <td style={{ fontWeight: "bold", paddingRight: 8 }}>{key}</td>
                <td>{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Controls */}
        <DSPStageControls
          parameters={stage.parameters}
          onParameterChange={onParameterChange}
        />
        <button className="btn" style={{ marginTop: 8 }} onClick={onReset}>
          Reset to Default
        </button>
      </div>
    </div>
  );
}
