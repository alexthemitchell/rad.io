export type NfmAudioPreset = 'voice-na-75us' | 'voice-eu-50us' | 'flat-discriminator';
export type NfmOutputPath = 'voice' | 'discriminator';

type NfmConfig = {
    preset: NfmAudioPreset;
    outputPath: NfmOutputPath;
};

export class NfmDemodulator {
    private prevI = 0;
    private prevQ = 0;
    private deemphasis = 0;
    private config: NfmConfig = {
        preset: 'voice-na-75us',
        outputPath: 'voice'
    };

    setConfig(next: Partial<NfmConfig>) {
        this.config = {
            ...this.config,
            ...next
        };
    }

    private alphaForPreset(): number {
        if (this.config.outputPath === 'discriminator' || this.config.preset === 'flat-discriminator') {
            return 1;
        }

        return this.config.preset === 'voice-eu-50us' ? 0.12 : 0.08;
    }

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

            const scaled = phaseDiff * 0.6;
            const alpha = this.alphaForPreset();

            if (alpha >= 0.9999) {
                this.deemphasis = scaled;
            } else {
                this.deemphasis = this.deemphasis * (1 - alpha) + scaled * alpha;
            }

            output[i] = this.deemphasis;

            this.prevI = currI;
            this.prevQ = currQ;
        }
    }
}
