export class NfmDemodulator {
    private prevI = 0;
    private prevQ = 0;
    private deemphasis = 0;

    /**
     * Baseline narrowband FM demodulation.
     * - Polar discriminator for phase delta
     * - Simple deemphasis for voice-like smoothing
     */
    process(input: Int8Array | Float32Array, output: Float32Array) {
        const len = input.length / 2;

        for (let i = 0; i < len; i++) {
            const currI = input[2 * i] / 128.0;
            const currQ = input[2 * i + 1] / 128.0;

            const cross = currQ * this.prevI - currI * this.prevQ;
            const dot = currI * this.prevI + currQ * this.prevQ;
            const phaseDiff = Math.atan2(cross, dot);

            // Conservative gain for NFM voice path.
            const scaled = phaseDiff * 0.6;

            // Single-pole deemphasis style smoothing.
            this.deemphasis = this.deemphasis * 0.92 + scaled * 0.08;
            output[i] = this.deemphasis;

            this.prevI = currI;
            this.prevQ = currQ;
        }
    }
}
