export class WfmDemodulator {
    private prevI = 0;
    private prevQ = 0;

    /**
     * Demodulate IQ samples to FM Audio (Float32).
     * Using simple Polar Discriminator: angle(new) - angle(old)
     * Output is roughly proportional to frequency deviation.
     */
    process(input: Int8Array | Float32Array, output: Float32Array) {
        // Input: I, Q, I, Q... (Interleaved)
        // Output: Audio Samples (Mono)
        
        const len = input.length / 2;
        
        for (let i = 0; i < len; i++) {
            // Convert to Float (-1.0 to 1.0)
            // If Int8, divide by 128. If Float32 (from NCO), it's already scaled ~100?
            // NCO outputs I*cos + Q*sin. Input I/Q are -128..127.
            // So NCO output is -180..180 approx.
            // We should normalize.
            
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
