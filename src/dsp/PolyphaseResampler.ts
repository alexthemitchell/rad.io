export class PolyphaseResampler {
  private phase = 0;
  private lastSample = 0;

  process(input: Float32Array, ratio: number): Float32Array {
    if (input.length === 0) {
      return new Float32Array(0);
    }

    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    const estimated = Math.max(1, Math.ceil(input.length * safeRatio + 2));
    const out = new Float32Array(estimated);
    let outIdx = 0;

    for (let i = 0; i < input.length; i += 1) {
      const curr = input[i];
      const startPhase = this.phase;
      this.phase += safeRatio;

      while (this.phase >= 1) {
        this.phase -= 1;
        const frac = this.phase;
        out[outIdx] = this.lastSample * frac + curr * (1 - frac);
        outIdx += 1;
      }

      if (startPhase < 1 && this.phase < 0) {
        this.phase = 0;
      }

      this.lastSample = curr;
    }

    return out.subarray(0, outIdx);
  }
}
