import { ISDRDevice, SDRDataCallback, SDRGainStage } from './ISDRDevice';
import { SDRDiscontinuityCause, SDRDiscontinuityEvent, SDRStreamFrame } from './streamFrame';

export class MockDevice implements ISDRDevice {
    name = "Mock Source (Synthetic)";
    private isStreaming = false;
    private frequency = 100_000_000;
    private sampleRate = 2_000_000;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private phase = 0;
    private sequence = 0;
    private sampleIndex = 0;
    private timestampNs = 0;
    private pendingDiscontinuity: SDRDiscontinuityCause | null = null;
    private lastTickWallClockMs = 0;
    private readonly blockIntervalMs = 10;

    private markDiscontinuity(cause: SDRDiscontinuityCause): void {
        if (this.pendingDiscontinuity === 'restart') {
            return;
        }

        if (cause === 'restart' || this.pendingDiscontinuity === null) {
            this.pendingDiscontinuity = cause;
            return;
        }

        // Keep sample-rate changes sticky until observed by the next frame.
        if (this.pendingDiscontinuity === 'sample_rate_change' && cause === 'retune') {
            return;
        }

        this.pendingDiscontinuity = cause;
    }
    
    // Internal Gain State
    private mockGain = 50;

    getGainStages(): SDRGainStage[] {
        return [
            { name: 'MAIN', label: 'Signal Strength', min: 0, max: 100, step: 1, value: this.mockGain }
        ];
    }

    async open(): Promise<void> {
        console.log("Mock Device Opened");
    }

    async close(): Promise<void> {
        this.stop();
        console.log("Mock Device Closed");
    }

    async setFrequency(hz: number): Promise<void> {
        this.frequency = hz;
        if (this.isStreaming) {
            this.markDiscontinuity('retune');
        }
        console.log(`Mock: Tuned to ${hz} Hz`);
    }

    async setSampleRate(hz: number): Promise<void> {
        if (hz > 0 && Number.isFinite(hz)) {
            this.sampleRate = hz;
            if (this.isStreaming) {
                this.markDiscontinuity('sample_rate_change');
            }
        }
        console.log(`Mock: Rate set to ${hz} Hz`);
    }

    async setGain(name: string, value: number): Promise<void> {
        if (name === 'MAIN') this.mockGain = value;
        console.log(`Mock: Gain ${name} = ${value}`);
    }

    async start(onData: SDRDataCallback): Promise<void> {
        if (this.isStreaming) return;
        this.isStreaming = true;
        this.markDiscontinuity('restart');
        this.lastTickWallClockMs = Date.now();

        const BLOCK_SIZE = 16384;
        const COMPLEX_SAMPLES_PER_BLOCK = BLOCK_SIZE / 2;
        const buffer = new Int8Array(BLOCK_SIZE);
        
        // FM Synthesis Params
        const tunedFrequencyHz = this.frequency;
        const modFreq = 440 + Math.floor((tunedFrequencyHz / 1_000_000) % 20); // Slightly vary tone with tuned frequency
        const deviation = 75_000; // +/- 75 kHz deviation (Standard WFM)
        
        this.intervalId = setInterval(() => {
            if (!this.isStreaming) return;

            const nowMs = Date.now();
            const elapsedMs = Math.max(0, nowMs - this.lastTickWallClockMs);
            this.lastTickWallClockMs = nowMs;

            const elapsedBlocks = Math.max(1, Math.round(elapsedMs / this.blockIntervalMs));
            const droppedSamples = (elapsedBlocks - 1) * COMPLEX_SAMPLES_PER_BLOCK;
            if (droppedSamples > 0) {
                this.sampleIndex += droppedSamples;
                this.timestampNs += Math.floor((droppedSamples * 1_000_000_000) / this.sampleRate);
            }

            for (let i = 0; i < BLOCK_SIZE; i += 2) {
                const t = this.phase / this.sampleRate;
                
                // Instantaneous Phase (Integral of f_inst)
                // phi(t) = 2*pi * integral(f_inst) 
                // integral(sin(wt)) = -1/w * cos(wt)
                // phi(t) = 2*pi * deviation * (-1/(2*pi*f_mod)) * cos(2*pi*f_mod*t)
                // phi(t) = - (deviation / f_mod) * cos(2*pi*f_mod*t)
                
                // Modulation Index beta = deviation / f_mod
                const beta = deviation / modFreq;
                const phi = -beta * Math.cos(2 * Math.PI * modFreq * t);

                // IQ = exp(j * phi)
                const valI = Math.cos(phi) * this.mockGain;
                const valQ = Math.sin(phi) * this.mockGain;

                // Add slight noise
                const noiseI = (Math.random() - 0.5) * 5;
                const noiseQ = (Math.random() - 0.5) * 5;

                buffer[i] = Math.max(-128, Math.min(127, valI + noiseI));
                buffer[i+1] = Math.max(-128, Math.min(127, valQ + noiseQ));

                this.phase++;
            }
            
            // Keep phase within reasonable bounds to avoid float precision loss? 
            // Actually for t calculation we need monotonic time.
            // Resetting phase will glitch the audio. 
            // Let's just let it run. JS Numbers go up to 2^53. At 2MSPS that's ~142 years.
            
            const sequence = this.sequence;
            const sampleIndex = this.sampleIndex;
            const timestampNs = this.timestampNs;

            let discontinuity: SDRDiscontinuityEvent | undefined;
            const cause = this.pendingDiscontinuity ?? (droppedSamples > 0 ? 'dropped_samples' : null);
            if (cause) {
                discontinuity = {
                    cause,
                    sequence,
                    sampleIndex,
                    wallClockMs: nowMs,
                    droppedSamples: droppedSamples > 0 ? droppedSamples : undefined
                };
                this.pendingDiscontinuity = null;
            }

            const frame: SDRStreamFrame = {
                sequence,
                sampleIndex,
                sampleCount: COMPLEX_SAMPLES_PER_BLOCK,
                timestampNs,
                sampleRate: this.sampleRate,
                droppedSamples,
                discontinuity,
                sampleClock: {
                    truthMode: 'unknown'
                }
            };

            onData(new DataView(buffer.buffer), frame);

            this.sequence += 1;
            this.sampleIndex += COMPLEX_SAMPLES_PER_BLOCK;
            this.timestampNs += Math.floor((COMPLEX_SAMPLES_PER_BLOCK * 1_000_000_000) / this.sampleRate);

        }, this.blockIntervalMs);
    }

    async stop(): Promise<void> {
        this.isStreaming = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
