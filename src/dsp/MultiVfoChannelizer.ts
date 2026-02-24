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
}
