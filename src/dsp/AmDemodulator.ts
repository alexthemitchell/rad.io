export class AmDemodulator {
    /**
     * Demodulate IQ samples to AM Audio.
     * AM = Magnitude(IQ) = sqrt(I^2 + Q^2)
     * 
     * We often need to remove the DC component (Carrier) to get the audio.
     * Audio = Magnitude - Average(Magnitude)
     */
    
    private dcBlockerState = 0;
    private readonly alpha = 0.999; // DC Blocker constant

    process(input: Int8Array, output: Float32Array) {
        // Input: I, Q, I, Q...
        // Output: Audio (Mono)

        const len = input.length / 2;
        
        for (let i = 0; i < len; i++) {
            // Convert to Float
            const I = input[2*i] / 128.0;
            const Q = input[2*i+1] / 128.0;

            // Envelope detection (Magnitude)
            // A simple approximation (Alpha max + Beta min) is faster, 
            // but sqrt is fine for standard usage in JS/WASM these days.
            const mag = Math.sqrt(I*I + Q*Q);

            // DC Blocker (High Pass Filter) to remove Carrier
            // y[n] = x[n] - x[n-1] + alpha * y[n-1]
            // Actually simpler: Moving Average subtraction or leaky integrator.
            // Let's use: Audio = Mag - Estimated_DC
            
            this.dcBlockerState = this.dcBlockerState * this.alpha + mag * (1 - this.alpha);
            
            output[i] = mag - this.dcBlockerState;
        }
    }
}
