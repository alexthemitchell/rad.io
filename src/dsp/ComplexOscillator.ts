export class ComplexOscillator {
    private phase = 0;
    private phaseStep = 0;

    constructor(sampleRate: number) {
        // Default to 0 Hz
        this.setFrequency(0, sampleRate);
    }

    setFrequency(targetFreq: number, sampleRate: number) {
        // theta(n) = 2*pi*f*n / Fs
        // step = 2*pi*f / Fs
        this.phaseStep = (2 * Math.PI * targetFreq) / sampleRate;
    }

    /**
     * Mixes the input IQ buffer with this oscillator.
     * output = input * exp(-j * phase)  [Downconversion]
     * or
     * output = input * exp(j * phase)   [Upconversion]
     * 
     * We usually want Downconversion (Shift F_target to DC).
     * e^(-jx) = cos(x) - j*sin(x)
     * 
     * (I + jQ) * (cos - j*sin)
     * = I*cos - j*I*sin + j*Q*cos - j^2*Q*sin
     * = I*cos - j*I*sin + j*Q*cos + Q*sin
     * = (I*cos + Q*sin) + j(Q*cos - I*sin)
     */
    mix(input: Int8Array, output: Float32Array) {
        // Output must be same length as input (2 * samples)
        // Or if we decimate immediately, we can do it here. 
        // For now, pure mixing.

        const len = input.length / 2;
        
        for (let i = 0; i < len; i++) {
            const I = input[2*i];
            const Q = input[2*i+1];

            // Oscillator Components
            // We use a lookup table in production, but Math.cos/sin is fast enough in V8 for <10MSPS usually.
            const cos = Math.cos(this.phase);
            const sin = Math.sin(this.phase);

            // Downconvert: Multiply by e^(-j*theta)
            // Real: I*cos + Q*sin
            // Imag: Q*cos - I*sin
            
            output[2*i] = (I * cos + Q * sin);     // New I
            output[2*i+1] = (Q * cos - I * sin);   // New Q

            // Advance Phase
            this.phase += this.phaseStep;
            
            // Wrap Phase (keep between 0 and 2PI for precision)
            if (this.phase > 2 * Math.PI) {
                this.phase -= 2 * Math.PI;
            } else if (this.phase < -2 * Math.PI) {
                this.phase += 2 * Math.PI;
            }
        }
    }
}
