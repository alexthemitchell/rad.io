import { ComplexOscillator } from './ComplexOscillator';

export type VfoConfig = {
  id: string;
  offsetHz: number;
};

export type VfoFrame = {
  id: string;
  iq: Float32Array;
  groupDelaySamples: number;
};

export class MultiVfoChannelizer {
  private sampleRateHz: number;
  private vfos: VfoConfig[] = [];
  private oscillators: Map<string, ComplexOscillator> = new Map();
  private readonly pfbDecimation = 2;
  private readonly prototypeTaps = [
    -0.0019, -0.0026, -0.0034, -0.0032, -0.0013, 0.0032, 0.0103, 0.0187,
    0.0263, 0.0301, 0.0278, 0.0186, 0.0035, -0.0138, -0.0280, -0.0340,
    -0.0280, -0.0138, 0.0035, 0.0186, 0.0278, 0.0301, 0.0263, 0.0187,
    0.0103, 0.0032, -0.0013, -0.0032, -0.0034, -0.0026, -0.0019
  ];

  constructor(sampleRateHz: number) {
    this.sampleRateHz = sampleRateHz;
  }

  setSampleRate(sampleRateHz: number): void {
    this.sampleRateHz = sampleRateHz;
    for (const vfo of this.vfos) {
      const osc = this.oscillators.get(vfo.id);
      if (osc) {
        osc.setFrequency(vfo.offsetHz, sampleRateHz);
      }
    }
  }

  setVfos(vfos: VfoConfig[]): void {
    const maxOffsetHz = this.sampleRateHz * 0.45;
    const seen = new Set<string>();
    const normalized: VfoConfig[] = [];

    for (const vfo of vfos) {
      if (normalized.length >= 4) {
        break;
      }
      if (seen.has(vfo.id)) {
        continue;
      }

      const offsetHz = Math.max(-maxOffsetHz, Math.min(maxOffsetHz, vfo.offsetHz));
      normalized.push({ id: vfo.id, offsetHz });
      seen.add(vfo.id);
    }

    this.vfos = normalized;
    const next = new Map<string, ComplexOscillator>();

    for (const vfo of this.vfos) {
      const existing = this.oscillators.get(vfo.id);
      const osc = existing ?? new ComplexOscillator(this.sampleRateHz);
      osc.setFrequency(vfo.offsetHz, this.sampleRateHz);
      next.set(vfo.id, osc);
    }

    this.oscillators = next;
  }

  getVfos(): VfoConfig[] {
    return [...this.vfos];
  }

  process(inputIq: Int8Array): VfoFrame[] {
    if (this.vfos.length === 0) {
      return [];
    }

    if (this.vfos.length >= 3) {
      return this.processPfbLike(inputIq);
    }

    const frames: VfoFrame[] = [];
    for (const vfo of this.vfos) {
      const osc = this.oscillators.get(vfo.id);
      if (!osc) {
        continue;
      }

      const out = new Float32Array(inputIq.length);
      osc.mix(inputIq, out);
      frames.push({ id: vfo.id, iq: out, groupDelaySamples: 0 });
    }

    return frames;
  }

  private processPfbLike(inputIq: Int8Array): VfoFrame[] {
    const frames: VfoFrame[] = [];
    const groupDelaySamples = Math.floor((this.prototypeTaps.length - 1) / 2);

    for (const vfo of this.vfos) {
      const osc = this.oscillators.get(vfo.id);
      if (!osc) {
        continue;
      }

      const mixed = new Float32Array(inputIq.length);
      osc.mix(inputIq, mixed);
      const decimated = this.filterDecimateComplex(mixed, this.pfbDecimation);
      frames.push({ id: vfo.id, iq: decimated, groupDelaySamples });
    }

    return frames;
  }

  private filterDecimateComplex(interleavedIq: Float32Array, decimation: number): Float32Array {
    const complexCount = Math.floor(interleavedIq.length / 2);
    const outComplex = Math.max(1, Math.floor(complexCount / decimation));
    const out = new Float32Array(outComplex * 2);

    let outIndex = 0;
    for (let n = 0; n < complexCount && outIndex < outComplex; n += decimation) {
      let accI = 0;
      let accQ = 0;
      for (let t = 0; t < this.prototypeTaps.length; t += 1) {
        const src = n - t;
        if (src < 0 || src >= complexCount) {
          continue;
        }
        const tap = this.prototypeTaps[t];
        accI += interleavedIq[src * 2] * tap;
        accQ += interleavedIq[(src * 2) + 1] * tap;
      }
      out[outIndex * 2] = accI;
      out[(outIndex * 2) + 1] = accQ;
      outIndex += 1;
    }

    return out.subarray(0, outIndex * 2);
  }
}
