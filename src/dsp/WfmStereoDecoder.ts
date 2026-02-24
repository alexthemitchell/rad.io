export type WfmStereoState = {
  locked: boolean;
  pilotLevel: number;
  separationDb: number;
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const goertzelPower = (samples: Float32Array, sampleRateHz: number, frequencyHz: number): number => {
  const omega = (2 * Math.PI * frequencyHz) / sampleRateHz;
  const coeff = 2 * Math.cos(omega);
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = 0; i < samples.length; i += 1) {
    q0 = coeff * q1 - q2 + samples[i];
    q2 = q1;
    q1 = q0;
  }

  return q1 * q1 + q2 * q2 - coeff * q1 * q2;
};

export class WfmStereoDecoder {
  private state: WfmStereoState = {
    locked: false,
    pilotLevel: 0,
    separationDb: 0
  };

  process(samples: Float32Array, sampleRateHz: number): WfmStereoState {
    if (samples.length < 512 || sampleRateHz <= 0) {
      return this.state;
    }

    const pilot = goertzelPower(samples, sampleRateHz, 19_000);
    const sideband = goertzelPower(samples, sampleRateHz, 38_000);
    const lowAudio = goertzelPower(samples, sampleRateHz, 1_000);

    const pilotNorm = clamp01((pilot / Math.max(1e-9, lowAudio)) * 0.6);
    const sepRatio = sideband / Math.max(1e-9, lowAudio);
    const separationDb = 10 * Math.log10(Math.max(1e-9, sepRatio));

    this.state = {
      locked: pilotNorm > 0.08,
      pilotLevel: pilotNorm,
      separationDb: Number.isFinite(separationDb) ? separationDb : 0
    };

    return this.state;
  }

  getState(): WfmStereoState {
    return this.state;
  }
}
