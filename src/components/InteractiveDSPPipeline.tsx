import React, { useMemo } from "react";
import useDSPPipeline, { type DSPPipelineStage } from "../hooks/useDSPPipeline";
import {
  exportStageDataAsCSV,
  exportStageDataAsJSON,
  copyToClipboard,
  savePNGFromCanvas,
} from "../utils/exportUtils";
import DSPComparisonView from "./DSPComparisonView";
import DSPStageMetrics from "./DSPStageMetrics";
import DSPStagePanel from "./DSPStagePanel";
import FFTChart from "../visualization/components/FFTChart";
import IQConstellation from "../visualization/components/IQConstellation";
import WaveformChart from "./WaveformChart";
import type { ISDRDevice } from "../models/SDRDevice";
import type { Sample } from "../utils/dsp";

type Props = {
  device: ISDRDevice | undefined;
  samples: Sample[];
};

function StageVisualization({
  stage,
}: {
  stage: DSPPipelineStage;
}): React.JSX.Element | null {
  // Adapters: we primarily have Sample[] based components; FFTChart accepts samples
  switch (stage.id) {
    case "rf-input":
    case "tuner":
      return <WaveformChart samples={stage.outputData as Sample[]} />;
    case "iq-sampling":
      return <IQConstellation samples={stage.outputData as Sample[]} />;
    case "fft":
      return <FFTChart samples={stage.inputData as Sample[]} />;
    case "demodulation":
    case "audio-output":
      return <WaveformChart samples={stage.outputData as Sample[]} />;
    default:
      return null;
  }
}

export default function InteractiveDSPPipeline({
  device,
  samples,
}: Props): React.JSX.Element {
  const { stages, selectedStageId, selectStage, updateParameter, resetStage } =
    useDSPPipeline(device, samples);

  const selectedStage = useMemo(() => {
    return stages.find((s) => s.id === selectedStageId) ?? stages[0];
  }, [stages, selectedStageId]);

  return (
    <div className="card">
      <div className="card-title">Interactive DSP Pipeline</div>
      <div className="card-subtitle">
        Click a stage to inspect data and parameters in real-time
      </div>

      <div className="dsp-pipeline" role="tablist" aria-label="DSP stages">
        {stages.map((stage) => (
          <button
            key={stage.id}
            data-stage={stage.id}
            role="tab"
            aria-selected={selectedStageId === stage.id}
            className={selectedStageId === stage.id ? "btn btn-primary" : "btn"}
            onClick={() => selectStage(stage.id)}
            style={{ marginRight: 8 }}
          >
            {stage.name}
          </button>
        ))}
      </div>

      {selectedStage ? (
        <div
          data-testid="stage-panel"
          className="card"
          style={{ marginTop: 12 }}
        >
          {/* Comparison View */}
          <DSPComparisonView stage={selectedStage} />
          {/* Visualization */}
          <StageVisualization stage={selectedStage} />
          {/* Metrics */}
          <DSPStageMetrics metrics={selectedStage.metrics} />
          {/* Controls and metrics */}
          <DSPStagePanel
            stage={selectedStage}
            onParameterChange={(param, value) =>
              updateParameter(selectedStage.id, param, value)
            }
            onReset={() => resetStage(selectedStage.id)}
          />
          {/* Export actions */}
          <div style={{ marginTop: 16 }}>
            <button
              className="btn"
              onClick={() =>
                copyToClipboard(
                  exportStageDataAsCSV(
                    selectedStage.id,
                    Array.isArray(selectedStage.outputData)
                      ? (selectedStage.outputData as Array<
                          Record<string, unknown>
                        >)
                      : [],
                  ),
                )
              }
              style={{ marginRight: 8 }}
            >
              Copy CSV
            </button>
            <button
              className="btn"
              onClick={() =>
                copyToClipboard(
                  exportStageDataAsJSON(
                    selectedStage.id,
                    Array.isArray(selectedStage.outputData)
                      ? (selectedStage.outputData as Array<
                          Record<string, unknown>
                        >)
                      : [],
                  ),
                )
              }
              style={{ marginRight: 8 }}
            >
              Copy JSON
            </button>
            <button
              className="btn"
              onClick={() => {
                const canvas = document.querySelector("canvas");
                if (canvas) {
                  savePNGFromCanvas(canvas, `${selectedStage.id}.png`);
                }
              }}
            >
              Export PNG
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
