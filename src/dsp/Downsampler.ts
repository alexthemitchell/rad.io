export class Downsampler {
    // Simple Decimation Filter (CIC-like or FIR)
    // Going from 2,000,000 -> 48,000 (Factor ~41.66)
    // We can do integer decimation 2M -> 50k (Factor 40)
    // 40 is a nice number.
    // 50k is close enough to 48k for web audio (we can resample at the end or just run at 50k)
    
    private accumulator = 0;
    private count = 0;
    private readonly factor = 40; 

    process(input: Float32Array): Float32Array {
        // Output size
        const outSize = Math.floor(input.length / this.factor);
        const output = new Float32Array(outSize);
        let outIdx = 0;

        for (let i = 0; i < input.length; i++) {
            this.accumulator += input[i];
            this.count++;

            if (this.count === this.factor) {
                // Average the samples (Boxcar filter)
                // This acts as a low-pass filter to prevent some aliasing
                output[outIdx++] = this.accumulator / this.factor;
                
                this.accumulator = 0;
                this.count = 0;
            }
        }
        return output;
    }
}
