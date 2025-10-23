import type { ISDRDevice } from "../models/SDRDevice";
import type { Sample } from "./dsp";
import { calculateSignalStrength } from "./dsp";

export function processRFInput(
  device: ISDRDevice | undefined,
  samples: Sample[],
): { output: Sample[]; metrics: { signalStrength: number } } {
  // Limit buffer size and compute signal strength
  const MAX_SAMPLES = 16384;
  const limited =
    samples.length <= MAX_SAMPLES
      ? samples
      : samples.filter(
          (_, i) => i % Math.ceil(samples.length / MAX_SAMPLES) === 0,
        );
  const signalStrength = calculateSignalStrength(limited);
  return {
    output: limited,
    metrics: { signalStrength },
  };
}

export function processTuner(
  samples: Sample[],
  params: { frequency: number; bandwidth: number; loOffset: number },
): { output: Sample[]; metrics: { actualFreq: number } } {
  // Placeholder: pass-through, but could apply frequency shift/filter
  return {
    output: samples,
    metrics: { actualFreq: params.frequency },
  };
}

export function processIQSampling(
  samples: Sample[],
  params: { sampleRate: number; dcCorrection: boolean; iqBalance: boolean },
): { output: Sample[]; metrics: { sampleRate: number } } {
  // Placeholder: pass-through, could apply DC/IQ correction
  return {
    output: samples,
    metrics: { sampleRate: params.sampleRate },
  };
}

export function processFFT(
  samples: Sample[],
  params: { fftSize: number; window: string; overlap: number; wasm: boolean },
): { output: null; metrics: { bins: number } } {
  // Placeholder: just return null for now
  return {
    output: null,
    metrics: { bins: params.fftSize },
  };
}

export function processDemodulation(
  _samples: Sample[],
  _params: {
    demod: string;
    fmDeviation: number;
    amDepth: number;
    audioBandwidth: number;
  },
): { output: null; metrics: object } {
  // Placeholder: just return null for now
  return {
    output: null,
    metrics: {},
  };
}

export function processAudioOutput(
  _samples: Sample[] | null,
  _params: {
    volume: number;
    mute: boolean;
    audioFilter: string;
    cutoff: number;
  },
): { output: null; metrics: object } {
  // Placeholder: just return null for now
  return {
    output: null,
    metrics: {},
  };
}
