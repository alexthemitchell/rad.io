import type { VfoFrame } from './MultiVfoChannelizer';

export type VfoAudioRoute = 'main' | 'aux' | 'mix' | 'mute';

export type VfoRuntimeMetric = {
  id: string;
  offsetHz: number;
  groupDelaySamples: number;
  power: number;
  quality01: number;
  strategy: VfoFrame['strategy'];
  cpuMs: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const computeSignalPower = (iq: Float32Array): number => {
  if (iq.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < iq.length; i += 1) {
    const sample = iq[i];
    sum += sample * sample;
  }

  return sum / iq.length;
};

export const computeVfoQuality01 = (iq: Float32Array): number => {
  if (iq.length < 4) {
    return 0;
  }

  let signal = 0;
  let delta = 0;
  for (let i = 0; i < iq.length; i += 1) {
    const sample = iq[i];
    signal += sample * sample;

    if (i > 0) {
      const diff = sample - iq[i - 1];
      delta += diff * diff;
    }
  }

  const signalAvg = signal / iq.length;
  const deltaAvg = delta / Math.max(1, iq.length - 1);
  const pseudoSnr = signalAvg / Math.max(1e-9, deltaAvg);
  return clamp01(Math.log10(1 + pseudoSnr));
};

export const normalizeVfoAudioRoute = (route: unknown, hasAuxVfo: boolean): VfoAudioRoute => {
  if (route === 'main' || route === 'mix' || route === 'mute') {
    return route;
  }

  if (route === 'aux') {
    return hasAuxVfo ? 'aux' : 'main';
  }

  return 'main';
};

const resolveSample = (buffer: Float32Array | null, index: number): number => {
  if (!buffer || index < 0 || index >= buffer.length) {
    return 0;
  }

  return buffer[index];
};

export const routeVfoAudio = (
  route: VfoAudioRoute,
  main: Float32Array,
  aux: Float32Array | null
): Float32Array => {
  if (route === 'mute') {
    return new Float32Array(0);
  }

  if (route === 'main' || !aux) {
    return main;
  }

  if (route === 'aux') {
    return aux;
  }

  const length = Math.max(main.length, aux.length);
  if (length === 0) {
    return new Float32Array(0);
  }

  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = 0.5 * (resolveSample(main, i) + resolveSample(aux, i));
  }

  return out;
};

export const buildVfoRuntimeMetrics = (
  frames: VfoFrame[],
  offsetById: ReadonlyMap<string, number>,
  processingMs: number
): VfoRuntimeMetric[] => {
  if (frames.length === 0) {
    return [];
  }

  const cpuPerVfoMs = processingMs / frames.length;
  return frames.map((frame) => ({
    id: frame.id,
    offsetHz: offsetById.get(frame.id) ?? 0,
    groupDelaySamples: frame.groupDelaySamples,
    power: computeSignalPower(frame.iq),
    quality01: computeVfoQuality01(frame.iq),
    strategy: frame.strategy,
    cpuMs: cpuPerVfoMs
  }));
};
