import { useCallback, useEffect, useMemo, useState } from "react";
import type { ISDRDevice } from "../models/SDRDevice";
import type { Sample } from "../utils/dsp";
import {
  processRFInput,
  processTuner,
  processIQSampling,
  processFFT,
  processDemodulation,
  processAudioOutput,
} from "../utils/dspProcessing";

export type StageParameters = Record<string, number | boolean | string>;
export type StageMetrics = Record<string, number | string | boolean>;

export type DSPPipelineStage = {
  id:
    | "rf-input"
    | "tuner"
    | "iq-sampling"
    | "fft"
    | "demodulation"
    | "audio-output";
  name: string;
  description: string;
  inputData: Sample[] | Float32Array | null;
  outputData: Sample[] | Float32Array | null;
  parameters: StageParameters;
  metrics: StageMetrics;
};

export function useDSPPipeline(
  device: ISDRDevice | undefined,
  rawSamples: Sample[],
): {
  stages: DSPPipelineStage[];
  selectedStageId: DSPPipelineStage["id"] | null;
  selectStage: (id: DSPPipelineStage["id"]) => void;
  updateParameter: (
    stageId: DSPPipelineStage["id"],
    param: string,
    value: number | boolean | string,
  ) => void;
  resetStage: (stageId: DSPPipelineStage["id"]) => void;
} {
  // Limit stored samples to keep memory usage in check
  // Removed unused MAX_SAMPLES_PER_STAGE constant

  const initialStages: DSPPipelineStage[] = useMemo(
    () => [
      {
        id: "rf-input",
        name: "RF Input",
        description: "Raw IQ samples from the device front-end",
        inputData: null,
        outputData: [] as Sample[],
        parameters: {} as StageParameters,
        metrics: {},
      },
      {
        id: "tuner",
        name: "Tuner",
        description: "Frequency tuning and filtering",
        inputData: null,
        outputData: null,
        parameters: {
          frequency: 100.3e6,
          bandwidth: 20e6,
          loOffset: 0,
        } as StageParameters,
        metrics: {},
      },
      {
        id: "iq-sampling",
        name: "I/Q Sampling",
        description: "Digitization and IQ correction",
        inputData: null,
        outputData: null,
        parameters: {
          sampleRate: 20e6,
          dcCorrection: true,
          iqBalance: false,
        } as StageParameters,
        metrics: {},
      },
      {
        id: "fft",
        name: "FFT Analysis",
        description: "Frequency-domain analysis and spectrogram",
        inputData: null,
        outputData: null,
        parameters: {
          fftSize: 1024,
          window: "Hann",
          overlap: 0,
          wasm: false,
        } as StageParameters,
        metrics: {},
      },
      {
        id: "demodulation",
        name: "Demodulation",
        description: "Baseband demodulation to audio",
        inputData: null,
        outputData: null,
        parameters: {
          demod: "FM",
          fmDeviation: 75000,
          amDepth: 50,
          audioBandwidth: 12000,
        } as StageParameters,
        metrics: {},
      },
      {
        id: "audio-output",
        name: "Audio Output",
        description: "Audio post-processing and playback",
        inputData: null,
        outputData: null,
        parameters: {
          volume: 0.5,
          mute: false,
          audioFilter: "None",
          cutoff: 1000,
        } as StageParameters,
        metrics: {},
      },
    ],
    [],
  );

  const [stages, setStages] = useState<DSPPipelineStage[]>(initialStages);
  const [selectedStageId, setSelectedStageId] = useState<
    DSPPipelineStage["id"] | null
  >("rf-input");

  const selectStage = useCallback(
    (id: DSPPipelineStage["id"]) => setSelectedStageId(id),
    [],
  );

  const updateParameter = useCallback(
    (
      stageId: DSPPipelineStage["id"],
      param: string,
      value: number | boolean | string,
    ) => {
      setStages((prev) =>
        prev.map((s) =>
          s.id === stageId
            ? { ...s, parameters: { ...s.parameters, [param]: value } }
            : s,
        ),
      );
    },
    [],
  );

  const resetStage = useCallback(
    (stageId: DSPPipelineStage["id"]) => {
      setStages((prev) =>
        prev.map((s) => {
          if (s.id !== stageId) {
            return s;
          }
          const original = initialStages.find((st) => st.id === stageId)!;
          return { ...original };
        }),
      );
    },
    [initialStages],
  );

  // Basic processing chain (placeholder):
  // - RF Input: store limited view of raw samples and compute signal strength
  useEffect(() => {
    // Stage 1: RF Input
    const rfResult = processRFInput(device, rawSamples);

    // Stage 2: Tuner
    const tunerParams = (initialStages[1]?.parameters ?? {}) as {
      frequency: number;
      bandwidth: number;
      loOffset: number;
    };
    const tunerResult = processTuner(rfResult.output, tunerParams);

    // Stage 3: IQ Sampling
    const iqParams = (initialStages[2]?.parameters ?? {}) as {
      sampleRate: number;
      dcCorrection: boolean;
      iqBalance: boolean;
    };
    const iqResult = processIQSampling(tunerResult.output, iqParams);

    // Stage 4: FFT
    const fftParams = (initialStages[3]?.parameters ?? {}) as {
      fftSize: number;
      window: string;
      overlap: number;
      wasm: boolean;
    };
    const fftResult = processFFT(iqResult.output, fftParams);

    // Stage 5: Demodulation
    const demodParams = (initialStages[4]?.parameters ?? {}) as {
      demod: string;
      fmDeviation: number;
      amDepth: number;
      audioBandwidth: number;
    };
    const demodResult = processDemodulation(iqResult.output, demodParams);

    // Stage 6: Audio Output
    const audioParams = (initialStages[5]?.parameters ?? {}) as {
      volume: number;
      mute: boolean;
      audioFilter: string;
      cutoff: number;
    };
    const audioResult = processAudioOutput(demodResult.output, audioParams);

    setStages((prev) => {
      return prev.map((s) => {
        switch (s.id) {
          case "rf-input":
            return {
              ...s,
              inputData: null,
              outputData: rfResult.output,
              metrics: rfResult.metrics,
            };
          case "tuner":
            return {
              ...s,
              inputData: rfResult.output,
              outputData: tunerResult.output,
              metrics: tunerResult.metrics,
            };
          case "iq-sampling":
            return {
              ...s,
              inputData: tunerResult.output,
              outputData: iqResult.output,
              metrics: iqResult.metrics,
            };
          case "fft":
            return {
              ...s,
              inputData: iqResult.output,
              outputData: fftResult.output,
              metrics: fftResult.metrics,
            };
          case "demodulation":
            return {
              ...s,
              inputData: iqResult.output,
              outputData: demodResult.output,
              metrics: (demodResult.metrics as StageMetrics) ?? {},
            };
          case "audio-output":
            return {
              ...s,
              inputData: demodResult.output,
              outputData: audioResult.output,
              metrics: (audioResult.metrics as StageMetrics) ?? {},
            };
          default:
            return s;
        }
      });
    });
  }, [rawSamples, device, initialStages]);

  // Sync tuner and IQ parameters from device if available (best-effort)
  useEffect(() => {
    if (!device) {
      return;
    }
    // In a real implementation, we'd query device.getFrequency/getSampleRate here.
    // Keep placeholder to demonstrate one-way sync pattern.
  }, [device]);

  return {
    stages,
    selectedStageId,
    selectStage,
    updateParameter,
    resetStage,
  };
}

export default useDSPPipeline;
