export type NoiseSquelchConfig = {
  enabled: boolean;
  thresholdDb: number;
  hysteresisDb: number;
  hangMs: number;
  tailMs: number;
};

export type NoiseSquelchState = {
  enabled: boolean;
  open: boolean;
  gain: number;
  thresholdDb: number;
  hysteresisDb: number;
  hangMs: number;
  tailMs: number;
  hangRemainingMs: number;
  snrDb: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export class NoiseSquelch {
  private config: NoiseSquelchConfig;
  private open = true;
  private gain = 1;
  private hangRemainingMs = 0;

  constructor(config: NoiseSquelchConfig = {
    enabled: false,
    thresholdDb: 6,
    hysteresisDb: 1.5,
    hangMs: 120,
    tailMs: 140
  }) {
    this.config = config;
  }

  setConfig(next: Partial<NoiseSquelchConfig>): void {
    this.config = {
      ...this.config,
      ...next
    };

    if (!this.config.enabled) {
      this.open = true;
      this.gain = 1;
      this.hangRemainingMs = 0;
    }
  }

  getState(snrDb: number): NoiseSquelchState {
    return {
      enabled: this.config.enabled,
      open: this.open,
      gain: this.gain,
      thresholdDb: this.config.thresholdDb,
      hysteresisDb: this.config.hysteresisDb,
      hangMs: this.config.hangMs,
      tailMs: this.config.tailMs,
      hangRemainingMs: this.hangRemainingMs,
      snrDb
    };
  }

  applyInPlace(audio: Float32Array, snrDb: number, frameDurationMs = 20): NoiseSquelchState {
    if (!this.config.enabled) {
      return this.getState(snrDb);
    }

    const closeThreshold = this.config.thresholdDb - this.config.hysteresisDb;
    const shouldOpen = this.open ? snrDb >= closeThreshold : snrDb >= this.config.thresholdDb;

    if (shouldOpen) {
      this.open = true;
      this.hangRemainingMs = this.config.hangMs;
    } else if (this.hangRemainingMs > 0) {
      this.open = true;
      this.hangRemainingMs = Math.max(0, this.hangRemainingMs - frameDurationMs);
    } else {
      this.open = false;
    }

    const targetGain = this.open ? 1 : 0;
    const attackMs = 28;
    const releaseMs = Math.max(40, this.config.tailMs);
    const slew = this.open
      ? Math.min(1, frameDurationMs / attackMs)
      : Math.min(1, frameDurationMs / releaseMs);
    this.gain += (targetGain - this.gain) * slew;
    this.gain = clamp01(this.gain);

    if (this.gain <= 1e-4) {
      audio.fill(0);
      return this.getState(snrDb);
    }

    if (this.gain < 0.9999) {
      for (let i = 0; i < audio.length; i += 1) {
        audio[i] *= this.gain;
      }
    }

    return this.getState(snrDb);
  }
}
