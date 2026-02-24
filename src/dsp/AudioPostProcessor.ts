export type FilterProfile = 'sharp' | 'low-latency' | 'low-ringing';
export type InterferencePreset = 'off' | 'dc-spike-reduction' | 'heterodyne-notch' | 'hum-notch';

export type FilterConfig = {
  profile: FilterProfile;
  lowCutHz: number;
  highCutHz: number;
  sampleRateHz: number;
  notchHz: number | null;
  notchQ: number;
};

const clampHz = (value: number, sampleRateHz: number) => {
  const nyquist = sampleRateHz * 0.5;
  return Math.max(0, Math.min(value, nyquist * 0.95));
};

const presetToConfig = (preset: InterferencePreset): Pick<FilterConfig, 'lowCutHz' | 'notchHz' | 'notchQ'> => {
  if (preset === 'dc-spike-reduction') {
    return { lowCutHz: 120, notchHz: null, notchQ: 8 };
  }
  if (preset === 'heterodyne-notch') {
    return { lowCutHz: 80, notchHz: 1_000, notchQ: 14 };
  }
  if (preset === 'hum-notch') {
    return { lowCutHz: 80, notchHz: 60, notchQ: 20 };
  }
  return { lowCutHz: 0, notchHz: null, notchQ: 8 };
};

export const applyInterferencePreset = (base: FilterConfig, preset: InterferencePreset): FilterConfig => {
  const presetConfig = presetToConfig(preset);
  return {
    ...base,
    lowCutHz: Math.max(base.lowCutHz, presetConfig.lowCutHz),
    notchHz: presetConfig.notchHz,
    notchQ: presetConfig.notchQ
  };
};

export class AudioPostProcessor {
  private prevInput = 0;
  private prevOutput = 0;
  private lowState = 0;
  private notchX1 = 0;
  private notchX2 = 0;
  private notchY1 = 0;
  private notchY2 = 0;
  private config: FilterConfig;

  constructor(initialConfig: FilterConfig) {
    this.config = initialConfig;
  }

  setConfig(nextConfig: FilterConfig) {
    this.config = {
      ...nextConfig,
      lowCutHz: clampHz(nextConfig.lowCutHz, nextConfig.sampleRateHz),
      highCutHz: clampHz(nextConfig.highCutHz, nextConfig.sampleRateHz)
    };
  }

  processInPlace(samples: Float32Array) {
    const cfg = this.config;
    const profileToBlend: Record<FilterProfile, number> = {
      sharp: 0.28,
      'low-latency': 0.6,
      'low-ringing': 0.18
    };

    const hpAlpha = cfg.lowCutHz <= 0
      ? 0
      : Math.exp((-2 * Math.PI * cfg.lowCutHz) / cfg.sampleRateHz);
    const lpBlend = 1 - Math.exp((-2 * Math.PI * cfg.highCutHz * profileToBlend[cfg.profile]) / cfg.sampleRateHz);

    const notchEnabled = cfg.notchHz !== null && cfg.notchHz > 0;
    const omega = notchEnabled ? (2 * Math.PI * cfg.notchHz!) / cfg.sampleRateHz : 0;
    const cosOmega = Math.cos(omega);
    const alphaNotch = notchEnabled ? Math.sin(omega) / (2 * Math.max(0.1, cfg.notchQ)) : 0;
    const b0 = notchEnabled ? 1 : 0;
    const b1 = notchEnabled ? -2 * cosOmega : 0;
    const b2 = notchEnabled ? 1 : 0;
    const a0 = notchEnabled ? 1 + alphaNotch : 1;
    const a1 = notchEnabled ? -2 * cosOmega : 0;
    const a2 = notchEnabled ? 1 - alphaNotch : 0;

    for (let i = 0; i < samples.length; i += 1) {
      const x = samples[i];

      let y = x;

      if (cfg.lowCutHz > 0) {
        const hp = hpAlpha * (this.prevOutput + x - this.prevInput);
        this.prevInput = x;
        this.prevOutput = hp;
        y = hp;
      }

      this.lowState += (y - this.lowState) * lpBlend;
      y = this.lowState;

      if (notchEnabled) {
        const notchY = (b0 / a0) * y
          + (b1 / a0) * this.notchX1
          + (b2 / a0) * this.notchX2
          - (a1 / a0) * this.notchY1
          - (a2 / a0) * this.notchY2;

        this.notchX2 = this.notchX1;
        this.notchX1 = y;
        this.notchY2 = this.notchY1;
        this.notchY1 = notchY;

        y = notchY;
      }

      samples[i] = y;
    }
  }
}
