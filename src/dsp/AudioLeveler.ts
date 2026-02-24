export type AudioLevelerState = {
  enabled: boolean;
  gainLinear: number;
  gainDb: number;
  targetRms: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class AudioLeveler {
  private enabled = false;
  private gainLinear = 1;
  private targetRms = 0.22;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getState(): AudioLevelerState {
    return {
      enabled: this.enabled,
      gainLinear: this.gainLinear,
      gainDb: 20 * Math.log10(Math.max(1e-6, this.gainLinear)),
      targetRms: this.targetRms
    };
  }

  private rms(samples: Float32Array): number {
    if (samples.length === 0) {
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      sum += samples[i] * samples[i];
    }

    return Math.sqrt(sum / samples.length);
  }

  applyInPlace(samples: Float32Array, frameDurationMs: number): AudioLevelerState {
    if (!this.enabled || samples.length === 0) {
      return this.getState();
    }

    const currentRms = this.rms(samples);
    const targetGain = clamp(this.targetRms / Math.max(1e-4, currentRms), 0.25, 4);

    const attackMs = 60;
    const releaseMs = 240;
    const slew = targetGain < this.gainLinear
      ? Math.min(1, frameDurationMs / attackMs)
      : Math.min(1, frameDurationMs / releaseMs);

    this.gainLinear += (targetGain - this.gainLinear) * slew;
    this.gainLinear = clamp(this.gainLinear, 0.25, 4);

    for (let i = 0; i < samples.length; i += 1) {
      samples[i] *= this.gainLinear;
    }

    return this.getState();
  }
}
