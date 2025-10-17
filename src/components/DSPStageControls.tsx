import React from "react";
import type { StageParameters } from "../hooks/useDSPPipeline";

export type DSPStageControlsProps = {
  parameters: StageParameters;
  onParameterChange: (param: string, value: number | boolean | string) => void;
};

export default function DSPStageControls({
  parameters,
  onParameterChange,
}: DSPStageControlsProps): React.JSX.Element {
  // Render controls for each parameter
  return (
    <div className="dsp-stage-controls">
      {Object.entries(parameters).map(([key, value]) => {
        if (typeof value === "number") {
          // Render slider for numbers
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <label htmlFor={key} style={{ marginRight: 8 }}>
                {key}
              </label>
              <input
                id={key}
                type="range"
                min={0}
                max={
                  typeof value === "number" ? Math.max(2048, value * 2) : 100
                }
                step={1}
                value={value}
                onChange={(e) => onParameterChange(key, Number(e.target.value))}
                style={{ width: 180 }}
              />
              <span style={{ marginLeft: 8 }}>{value}</span>
            </div>
          );
        } else if (typeof value === "boolean") {
          // Render toggle for booleans
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <label htmlFor={key} style={{ marginRight: 8 }}>
                {key}
              </label>
              <input
                id={key}
                type="checkbox"
                checked={value}
                onChange={(e) => onParameterChange(key, e.target.checked)}
              />
            </div>
          );
        } else if (typeof value === "string") {
          // Render dropdown for enums/strings
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <label htmlFor={key} style={{ marginRight: 8 }}>
                {key}
              </label>
              <input
                id={key}
                type="text"
                value={value}
                onChange={(e) => onParameterChange(key, e.target.value)}
                style={{ width: 180 }}
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
