export type ToneDecodeState = {
  mode: 'off' | 'ctcss' | 'dcs';
  ctcssHz: number | null;
  dcsDetected: boolean;
  dcsCode: number | null;
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

const COMMON_DCS_CODES = [
  23, 25, 26, 31, 32, 36, 43, 47, 51, 53, 54, 65, 71, 72, 73, 74, 114, 115,
  116, 122, 125, 131, 132, 134, 143, 145, 152, 155, 156, 162, 165, 172, 174,
  205, 212, 223, 225, 226, 243, 244, 245, 246, 251, 252, 255, 261, 263, 265,
  266, 271, 274, 306, 311, 315, 325, 331, 332, 343, 346, 351, 356, 364, 365,
  371, 411, 412, 413, 423, 431, 432, 445, 446, 452, 454, 455, 462, 464, 465,
  466, 503, 506, 516, 523, 526, 532, 546, 565, 606, 612, 624, 627, 631, 632,
  654, 662, 664, 703, 712, 723, 731, 732, 734, 743, 754
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
  dcsCode: null,
  confidence: 0,
  active: false
});

const dcsCodeToBits = (code: number): number[] => {
  const digits = String(code).padStart(3, '0');
  const bits: number[] = [];
  for (let i = 0; i < digits.length; i += 1) {
    const value = Number(digits[i]);
    for (let b = 2; b >= 0; b -= 1) {
      bits.push((value >> b) & 1);
    }
  }
  return bits;
};

const decodeDcsBits = (samples: Float32Array, sampleRateHz: number, symbolRateHz: number): number[] => {
  const samplesPerSymbol = sampleRateHz / symbolRateHz;
  const symbols = Math.floor(samples.length / samplesPerSymbol);
  const bits: number[] = [];

  for (let symbol = 0; symbol < symbols; symbol += 1) {
    const start = Math.floor(symbol * samplesPerSymbol);
    const end = Math.min(samples.length, Math.floor((symbol + 1) * samplesPerSymbol));
    if (end - start < 3) {
      continue;
    }

    let sum = 0;
    for (let i = start; i < end; i += 1) {
      sum += samples[i];
    }
    bits.push(sum >= 0 ? 1 : 0);
  }

  return bits;
};

const scoreDcsCode = (bits: number[], code: number): number => {
  const pattern = dcsCodeToBits(code);
  if (bits.length < pattern.length) {
    return 0;
  }

  let best = 0;
  for (let offset = 0; offset <= bits.length - pattern.length; offset += 1) {
    let matches = 0;
    for (let i = 0; i < pattern.length; i += 1) {
      if (bits[offset + i] === pattern[i]) {
        matches += 1;
      }
    }
    best = Math.max(best, matches / pattern.length);
  }

  return best;
};

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
      dcsCode: null,
      confidence,
      active
    };
  }

  // Baseline DCS detection + codeword candidate extraction.
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

    let confidence = clamp01(((ratio - 1) / 2.5) * clamp01((rms - 0.02) / 0.2));
    let active = symbolPower > 1e-7 && ratio > 1.2 && rms > 0.02;

    let dcsCode: number | null = null;
    if (active || rms > 0.02) {
      const bits = decodeDcsBits(samples, sampleRateHz, 134.4);
      let bestCode = 0;
      let bestScore = 0;
      for (const candidate of COMMON_DCS_CODES) {
        const score = scoreDcsCode(bits, candidate);
        if (score > bestScore) {
          bestScore = score;
          bestCode = candidate;
        }
      }
      dcsCode = bestScore >= 0.78 ? bestCode : null;
      if (dcsCode !== null && rms > 0.02) {
        active = true;
        confidence = Math.max(confidence, 0.2 + (bestScore - 0.78) * 0.8);
      }
    }

    return {
      mode: active ? 'dcs' : 'off',
      ctcssHz: null,
      dcsDetected: active,
      dcsCode,
      confidence,
      active
    };
  }
}
