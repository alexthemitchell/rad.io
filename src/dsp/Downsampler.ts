export class Downsampler {
    // Simple Decimation Filter (CIC-like or FIR)
    // Going from 2,000,000 -> 48,000 (Factor ~41.66)
    // We can do integer decimation 2M -> 50k (Factor 40)
    // 40 is a nice number.
    // 50k is close enough to 48k for web audio (we can resample at the end or just run at 50k)
    
    private accumulator = 0;
    private count = 0;
    private factor = 40;
    private outputSampleRateHz = 50_000;

    constructor(inputSampleRateHz = 2_000_000, targetOutputSampleRateHz = 50_000) {
        this.setSampleRates(inputSampleRateHz, targetOutputSampleRateHz);
    }

    setSampleRates(inputSampleRateHz: number, targetOutputSampleRateHz = 50_000): void {
        const safeInput = Number.isFinite(inputSampleRateHz) && inputSampleRateHz > 0 ? inputSampleRateHz : 2_000_000;
        const safeTarget = Number.isFinite(targetOutputSampleRateHz) && targetOutputSampleRateHz > 0
            ? targetOutputSampleRateHz
            : 50_000;

        this.factor = Math.max(1, Math.round(safeInput / safeTarget));
        this.outputSampleRateHz = safeInput / this.factor;
    }

    getFactor(): number {
        return this.factor;
    }

    getOutputSampleRateHz(): number {
        return this.outputSampleRateHz;
    }

    process(input: Float32Array): Float32Array {
        // Output size is not just input/factor, it depends on state
        // We can push to array or calculate exact size.
        // For simplicity/perf, let's estimate size but be safe.
        // Max output size = (input.length + current_count) / factor
        
        const output = new Float32Array(Math.ceil((input.length + this.count) / this.factor));
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
        
        // Return only the filled portion
        return output.subarray(0, outIdx);
    }
}
