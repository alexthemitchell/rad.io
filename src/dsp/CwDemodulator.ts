export class CwDemodulator {
  private phase = 0;
  private toneHz = 700;
  private sampleRateHz = 50_000;
  private dc = 0;

  setConfig(toneHz: number, sampleRateHz: number): void {
    this.toneHz = toneHz;
    this.sampleRateHz = sampleRateHz;
  }

  process(input: Int8Array | Float32Array, output: Float32Array): void {
    const len = input.length / 2;
    const dcAlpha = 0.995;
    const omega = (2 * Math.PI * this.toneHz) / Math.max(1, this.sampleRateHz);

    for (let i = 0; i < len; i += 1) {
      const inI = input[i * 2] / 128;
      const inQ = input[(i * 2) + 1] / 128;

      const c = Math.cos(this.phase);
      const s = Math.sin(this.phase);
      const mixedI = inI * c - inQ * s;
      const mixedQ = inI * s + inQ * c;
      const mag = Math.hypot(mixedI, mixedQ);

      this.dc = this.dc * dcAlpha + mag * (1 - dcAlpha);
      output[i] = mag - this.dc;

      this.phase += omega;
      if (this.phase > Math.PI) {
        this.phase -= 2 * Math.PI;
      }
    }
  }
}
