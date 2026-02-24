export class SamDemodulator {
  private phase = 0;
  private freq = 0;
  private dc = 0;

  process(input: Int8Array | Float32Array, output: Float32Array): void {
    const len = input.length / 2;
    const alpha = 0.08;
    const beta = 0.0025;
    const dcAlpha = 0.998;

    for (let i = 0; i < len; i += 1) {
      const inI = input[i * 2] / 128;
      const inQ = input[(i * 2) + 1] / 128;

      const measured = Math.atan2(inQ, inI);
      let err = measured - this.phase;
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;

      this.freq += beta * err;
      this.phase += this.freq + alpha * err;
      while (this.phase > Math.PI) this.phase -= 2 * Math.PI;
      while (this.phase < -Math.PI) this.phase += 2 * Math.PI;

      const c = Math.cos(this.phase);
      const s = Math.sin(this.phase);
      const coherentI = inI * c + inQ * s;

      this.dc = this.dc * dcAlpha + coherentI * (1 - dcAlpha);
      output[i] = coherentI - this.dc;
    }
  }
}
