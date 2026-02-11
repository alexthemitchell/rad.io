export class WfmDemodulator {
    private prevI = 0;
    private prevQ = 0;

    /**
     * Demodulate IQ samples to FM Audio (Float32).
     * Using simple Polar Discriminator: angle(new) - angle(old)
     * Output is roughly proportional to frequency deviation.
     */
    process(input: Int8Array, output: Float32Array) {
        // Input: I, Q, I, Q... (Interleaved 8-bit signed)
        // Output: Audio Samples (Mono)
        
        const len = input.length / 2;
        
        for (let i = 0; i < len; i++) {
            // Convert to Float (-1.0 to 1.0)
            const currI = input[2*i] / 128.0;
            const currQ = input[2*i + 1] / 128.0;

            // Calculate Angle difference
            // phase_diff = atan2(Q, I) - atan2(prevQ, prevI)
            // Faster trick: atan2(Q*prevI - I*prevQ, I*prevI + Q*prevQ)
            // This is the phase of (curr * conj(prev))
            
            const cross = currQ * this.prevI - currI * this.prevQ;
            const dot = currI * this.prevI + currQ * this.prevQ;
            
            // Result is in radians per sample (-pi to pi)
            let phaseDiff = Math.atan2(cross, dot);

            // Output is directly the demodulated signal
            output[i] = phaseDiff; // Scale later if needed (Gain)

            this.prevI = currI;
            this.prevQ = currQ;
        }
    }
}
