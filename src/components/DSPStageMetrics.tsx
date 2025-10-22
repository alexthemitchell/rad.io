import React from "react";
import type { StageMetrics } from "../hooks/useDSPPipeline";

export type DSPStageMetricsProps = {
  metrics: StageMetrics;
};

function getBadgeColor(key: string, value: number | string | boolean): string {
  // Simple demo: color by metric name
  if (typeof value === "number") {
    if (key.toLowerCase().includes("snr") && value > 20) {
      return "#4caf50";
    }
    if (key.toLowerCase().includes("thd") && value < 5) {
      return "#4caf50";
    }
    if (key.toLowerCase().includes("latency") && value < 100) {
      return "#4caf50";
    }
    if (key.toLowerCase().includes("error") && value > 0) {
      return "#f44336";
    }
    return "#2196f3";
  }
  if (typeof value === "boolean") {
    return value ? "#4caf50" : "#f44336";
  }
  return "#757575";
}

export default function DSPStageMetrics({
  metrics,
}: DSPStageMetricsProps): React.JSX.Element {
  return (
    <div className="dsp-stage-metrics" style={{ marginBottom: 16 }}>
      <table>
        <tbody>
          {Object.entries(metrics).map(([key, value]) => (
            <tr key={key}>
              <td style={{ fontWeight: "bold", paddingRight: 8 }}>{key}</td>
              <td>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 8,
                    background: getBadgeColor(key, value),
                    color: "#fff",
                  }}
                >
                  {String(value)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
