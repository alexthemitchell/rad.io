export type ImpulseBlankerState = {
  enabled: boolean;
  blankedSamples: number;
  blankingRatio: number;
  estimatedImpulseEnergy: number;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class ImpulseBlanker {
  private enabled = false;
  private thresholdMultiplier = 6;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  applyInPlace(samples: Float32Array): ImpulseBlankerState {
    if (!this.enabled || samples.length === 0) {
      return {
        enabled: this.enabled,
        blankedSamples: 0,
        blankingRatio: 0,
        estimatedImpulseEnergy: 0
      };
    }

    let meanAbs = 0;
    for (let i = 0; i < samples.length; i += 1) {
      meanAbs += Math.abs(samples[i]);
    }
    meanAbs /= samples.length;

    const threshold = Math.max(1e-5, meanAbs * this.thresholdMultiplier);
    let blankedSamples = 0;
    let impulseEnergy = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const abs = Math.abs(samples[i]);
      if (abs > threshold) {
        impulseEnergy += abs * abs;
        samples[i] = 0;
        blankedSamples += 1;
      }
    }

    return {
      enabled: this.enabled,
      blankedSamples,
      blankingRatio: clamp(blankedSamples / samples.length, 0, 1),
      estimatedImpulseEnergy: impulseEnergy
    };
  }
}
