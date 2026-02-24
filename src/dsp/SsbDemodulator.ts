export type SsbMode = 'USB' | 'LSB';

export class SsbDemodulator {
  private phase = 0;
  private mode: SsbMode = 'USB';
  private bfoHz = 1500;
  private sampleRateHz = 50_000;
  private hp = 0;

  setConfig(mode: SsbMode, bfoHz: number, sampleRateHz: number): void {
    this.mode = mode;
    this.bfoHz = bfoHz;
    this.sampleRateHz = sampleRateHz;
  }

  process(input: Int8Array | Float32Array, output: Float32Array): void {
    const len = input.length / 2;
    const hpAlpha = 0.995;
    const omega = (2 * Math.PI * this.bfoHz) / Math.max(1, this.sampleRateHz);

    for (let i = 0; i < len; i += 1) {
      const inI = input[i * 2] / 128;
      const inQ = input[(i * 2) + 1] / 128;

      const c = Math.cos(this.phase);
      const s = Math.sin(this.phase);
      const mixedI = inI * c - inQ * s;
      const mixedQ = inI * s + inQ * c;

      const raw = this.mode === 'USB' ? mixedI + mixedQ : mixedI - mixedQ;
      this.hp = this.hp * hpAlpha + raw * (1 - hpAlpha);
      output[i] = raw - this.hp;

      this.phase += omega;
      if (this.phase > Math.PI) {
        this.phase -= 2 * Math.PI;
      }
    }
  }
}
