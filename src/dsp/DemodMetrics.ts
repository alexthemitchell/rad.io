export type DemodMode = 'WFM' | 'AM' | 'NFM';
export type LockState = 'searching' | 'locked' | 'degraded';

export type DemodQualityMetrics = {
  mode: DemodMode;
  lockState: LockState;
  quality: number;
  snrEstimateDb: number;
  pilotLevel: number;
  carrierLevel: number;
  deviationEstimate: number;
};

const mean = (samples: Float32Array) => {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i];
  }
  return sum / samples.length;
};

const rms = (samples: Float32Array) => {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
};

const stdDev = (samples: Float32Array, avg: number) => {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const delta = samples[i] - avg;
    sum += delta * delta;
  }
  return Math.sqrt(sum / samples.length);
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const evaluateDemodQuality = (mode: DemodMode, audio: Float32Array): DemodQualityMetrics => {
  const avg = mean(audio);
  const sigma = stdDev(audio, avg);
  const energy = rms(audio);
  const estimatedNoise = Math.max(1e-6, sigma * 0.6);
  const snrEstimateDb = 20 * Math.log10(Math.max(1e-6, energy) / estimatedNoise);

  if (mode === 'WFM') {
    const pilotLevel = clamp01((energy - 0.06) / 0.28);
    const quality = clamp01((pilotLevel * 0.7) + clamp01((snrEstimateDb + 6) / 16) * 0.3);
    const lockState: LockState = quality > 0.72 ? 'locked' : quality > 0.42 ? 'degraded' : 'searching';
    return {
      mode,
      lockState,
      quality,
      snrEstimateDb,
      pilotLevel,
      carrierLevel: 0,
      deviationEstimate: energy * 0.8
    };
  }

  if (mode === 'AM') {
    const carrierLevel = clamp01((Math.abs(avg) * 4) + 0.05);
    const quality = clamp01((carrierLevel * 0.65) + clamp01((snrEstimateDb + 5) / 20) * 0.35);
    const lockState: LockState = carrierLevel > 0.55 ? 'locked' : carrierLevel > 0.28 ? 'degraded' : 'searching';
    return {
      mode,
      lockState,
      quality,
      snrEstimateDb,
      pilotLevel: 0,
      carrierLevel,
      deviationEstimate: 0
    };
  }

  const deviationEstimate = energy;
  const quality = clamp01((snrEstimateDb + 2) / 16);
  const lockState: LockState = quality > 0.66 ? 'locked' : quality > 0.36 ? 'degraded' : 'searching';

  return {
    mode,
    lockState,
    quality,
    snrEstimateDb,
    pilotLevel: 0,
    carrierLevel: 0,
    deviationEstimate
  };
};
