export type ToneDecodeState = {
  ctcssHz: number | null;
  confidence: number;
  active: boolean;
};

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

export class ToneDecoder {
  decodeCtcss(samples: Float32Array, sampleRateHz: number): ToneDecodeState {
    if (samples.length < 256 || sampleRateHz <= 0) {
      return { ctcssHz: null, confidence: 0, active: false };
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
      ctcssHz: active ? strongest.tone : null,
      confidence,
      active
    };
  }
}
