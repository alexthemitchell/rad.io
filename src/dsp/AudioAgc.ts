export type AgcMode = 'WFM' | 'AM' | 'NFM';
export type AgcTrackingState = 'idle' | 'tracking' | 'hold';

export type AudioAgcState = {
  enabled: boolean;
  mode: AgcMode;
  state: AgcTrackingState;
  targetLevelDbfs: number;
  estimatedGainDb: number;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const modeTargetDbfs = (mode: AgcMode): number => {
  if (mode === 'WFM') return -18;
  if (mode === 'AM') return -21;
  return -20;
};

export class AudioAgc {
  private enabled = false;
  private mode: AgcMode = 'WFM';
  private gainLinear = 1;
  private holdRemainingMs = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setMode(mode: AgcMode): void {
    this.mode = mode;
  }

  private targetRmsLinear(): number {
    return Math.pow(10, modeTargetDbfs(this.mode) / 20);
  }

  private rms(samples: Float32Array): number {
    if (samples.length === 0) {
      return 0;
    }

    let sumSq = 0;
    for (let i = 0; i < samples.length; i += 1) {
      sumSq += samples[i] * samples[i];
    }

    return Math.sqrt(sumSq / samples.length);
  }

  getState(): AudioAgcState {
    const estimatedGainDb = 20 * Math.log10(Math.max(1e-6, this.gainLinear));
    const state: AgcTrackingState = !this.enabled
      ? 'idle'
      : this.holdRemainingMs > 0
        ? 'hold'
        : 'tracking';

    return {
      enabled: this.enabled,
      mode: this.mode,
      state,
      targetLevelDbfs: modeTargetDbfs(this.mode),
      estimatedGainDb
    };
  }

  applyInPlace(samples: Float32Array, frameDurationMs: number, squelchOpen: boolean): AudioAgcState {
    if (!this.enabled || samples.length === 0) {
      return this.getState();
    }

    if (!squelchOpen) {
      this.holdRemainingMs = 200;
      return this.getState();
    }

    this.holdRemainingMs = Math.max(0, this.holdRemainingMs - frameDurationMs);

    const currentRms = this.rms(samples);
    const target = this.targetRmsLinear();
    const targetGain = clamp(target / Math.max(1e-5, currentRms), 0.25, 4);

    const attackMs = 45;
    const releaseMs = 260;
    const slew = targetGain < this.gainLinear
      ? Math.min(1, frameDurationMs / attackMs)
      : Math.min(1, frameDurationMs / releaseMs);

    if (this.holdRemainingMs <= 0) {
      this.gainLinear += (targetGain - this.gainLinear) * slew;
      this.gainLinear = clamp(this.gainLinear, 0.25, 4);
    }

    for (let i = 0; i < samples.length; i += 1) {
      samples[i] *= this.gainLinear;
    }

    return this.getState();
  }
}
