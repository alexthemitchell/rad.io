export type FrequencyModelState = {
  afcEnabled: boolean;
  afcCorrectionHz: number;
  driftEstimateHzPerSec: number;
  driftConfidence: number;
  ppmCorrectionHz: number;
  totalCorrectionHz: number;
  stabilityMode: boolean;
  phaseErrorRms: number;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export class FrequencyTracker {
  private afcEnabled = false;
  private stabilityMode = false;
  private afcCorrectionHz = 0;
  private driftEstimateHzPerSec = 0;
  private driftConfidence = 0;
  private phaseErrorRms = 0;

  setAfcEnabled(enabled: boolean): void {
    if (!enabled && this.afcEnabled) {
      this.afcCorrectionHz = 0;
    }
    this.afcEnabled = enabled;
  }

  setStabilityMode(enabled: boolean): void {
    this.stabilityMode = enabled;
  }

  reset(): void {
    this.afcCorrectionHz = 0;
    this.driftEstimateHzPerSec = 0;
    this.driftConfidence = 0;
    this.phaseErrorRms = 0;
  }

  update(iq: Float32Array, sampleRateHz: number, frameDurationSec: number, ppmCorrectionHz: number): FrequencyModelState {
    if (iq.length < 4 || sampleRateHz <= 0 || frameDurationSec <= 0) {
      return this.getState(ppmCorrectionHz);
    }

    let sum = 0;
    let sumSq = 0;
    let count = 0;

    let prevI = iq[0];
    let prevQ = iq[1];
    for (let i = 2; i < iq.length; i += 2) {
      const currI = iq[i];
      const currQ = iq[i + 1];
      const cross = currQ * prevI - currI * prevQ;
      const dot = currI * prevI + currQ * prevQ;
      const dphi = Math.atan2(cross, dot);
      sum += dphi;
      sumSq += dphi * dphi;
      count += 1;
      prevI = currI;
      prevQ = currQ;
    }

    if (count === 0) {
      return this.getState(ppmCorrectionHz);
    }

    const mean = sum / count;
    const variance = Math.max(0, sumSq / count - mean * mean);
    const rms = Math.sqrt(variance);
    const freqOffsetHz = mean * sampleRateHz / (2 * Math.PI);

    this.phaseErrorRms = rms;
    const confidenceRaw = 1 - clamp(rms / 0.3, 0, 1);
    this.driftConfidence = 0.9 * this.driftConfidence + 0.1 * confidenceRaw;

    if (this.afcEnabled) {
      const targetAfc = clamp(-freqOffsetHz, -6_000, 6_000);
      const prevAfc = this.afcCorrectionHz;
      this.afcCorrectionHz = prevAfc + (targetAfc - prevAfc) * 0.08;
      const delta = this.afcCorrectionHz - prevAfc;
      this.driftEstimateHzPerSec = 0.95 * this.driftEstimateHzPerSec + 0.05 * (delta / frameDurationSec);
    } else {
      this.afcCorrectionHz *= 0.9;
      this.driftEstimateHzPerSec *= 0.9;
    }

    return this.getState(ppmCorrectionHz);
  }

  getState(ppmCorrectionHz: number): FrequencyModelState {
    const total = ppmCorrectionHz + this.afcCorrectionHz;
    return {
      afcEnabled: this.afcEnabled,
      afcCorrectionHz: this.afcCorrectionHz,
      driftEstimateHzPerSec: this.driftEstimateHzPerSec,
      driftConfidence: this.driftConfidence,
      ppmCorrectionHz,
      totalCorrectionHz: total,
      stabilityMode: this.stabilityMode,
      phaseErrorRms: this.phaseErrorRms
    };
  }
}
