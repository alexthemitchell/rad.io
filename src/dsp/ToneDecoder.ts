export type ToneDecodeState = {
  mode: 'off' | 'ctcss' | 'dcs';
  ctcssHz: number | null;
  dcsDetected: boolean;
  confidence: number;
  active: boolean;
};

export type ToneDecodeMode = 'OFF' | 'CTCSS' | 'DCS' | 'AUTO';

const CTCSS_TONES_HZ = [
  67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
  97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
  131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5,
  167.9, 171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8,
  196.6, 199.5, 203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6,
  241.8, 250.3, 254.1
];

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

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const emptyToneState = (): ToneDecodeState => ({
  mode: 'off',
  ctcssHz: null,
  dcsDetected: false,
  confidence: 0,
  active: false
});

export class ToneDecoder {
  decode(
    samples: Float32Array,
    sampleRateHz: number,
    mode: ToneDecodeMode
  ): ToneDecodeState {
    if (mode === 'OFF') {
      return emptyToneState();
    }

    if (mode === 'CTCSS') {
      return this.decodeCtcss(samples, sampleRateHz);
    }

    if (mode === 'DCS') {
      return this.decodeDcs(samples, sampleRateHz);
    }

    const ctcss = this.decodeCtcss(samples, sampleRateHz);
    const dcs = this.decodeDcs(samples, sampleRateHz);

    return dcs.confidence > ctcss.confidence ? dcs : ctcss;
  }

  decodeCtcss(samples: Float32Array, sampleRateHz: number): ToneDecodeState {
    if (samples.length < 256 || sampleRateHz <= 0) {
      return emptyToneState();
    }

    const powers = CTCSS_TONES_HZ.map((tone) => ({
      tone,
      power: goertzelPower(samples, sampleRateHz, tone)
    }));

    powers.sort((a, b) => b.power - a.power);
    const strongest = powers[0];
    const runnerUp = powers[1] ?? { tone: 0, power: 1e-9 };
    const ratio = strongest.power / Math.max(1e-9, runnerUp.power);
    const confidence = Math.max(0, Math.min(1, (ratio - 1) / 3));
    const active = strongest.power > 1e-7 && ratio > 1.15;

    return {
      mode: active ? 'ctcss' : 'off',
      ctcssHz: active ? strongest.tone : null,
      dcsDetected: false,
      confidence,
      active
    };
  }

  // Baseline DCS detection: detects strong digital-coded-squelch symbol energy around 134.4 bps.
  decodeDcs(samples: Float32Array, sampleRateHz: number): ToneDecodeState {
    if (samples.length < 512 || sampleRateHz <= 0) {
      return emptyToneState();
    }

    const symbolPower = goertzelPower(samples, sampleRateHz, 134.4);
    const sideLowPower = goertzelPower(samples, sampleRateHz, 110);
    const sideHighPower = goertzelPower(samples, sampleRateHz, 160);
    const sidebandFloor = Math.max(1e-9, (sideLowPower + sideHighPower) * 0.5);
    const ratio = symbolPower / sidebandFloor;

    let rms = 0;
    for (let i = 0; i < samples.length; i += 1) {
      rms += samples[i] * samples[i];
    }
    rms = Math.sqrt(rms / samples.length);

    const confidence = clamp01(((ratio - 1) / 2.5) * clamp01((rms - 0.02) / 0.2));
    const active = symbolPower > 1e-7 && ratio > 1.2 && rms > 0.02;

    return {
      mode: active ? 'dcs' : 'off',
      ctcssHz: null,
      dcsDetected: active,
      confidence,
      active
    };
  }
}
