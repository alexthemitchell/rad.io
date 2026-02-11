import { ISDRDevice } from './ISDRDevice';

export class MockDevice implements ISDRDevice {
    name = "Mock Source (Synthetic)";
    private isStreaming = false;
    private frequency = 100_000_000;
    private sampleRate = 2_000_000;
    private intervalId: any = null;
    private phase = 0;

    async open(): Promise<void> {
        console.log("Mock Device Opened");
    }

    async close(): Promise<void> {
        this.stop();
        console.log("Mock Device Closed");
    }

    async setFrequency(hz: number): Promise<void> {
        this.frequency = hz;
        console.log(`Mock: Tuned to ${hz} Hz`);
    }

    async setSampleRate(hz: number): Promise<void> {
        this.sampleRate = hz;
        console.log(`Mock: Rate set to ${hz} Hz`);
    }

    async setGain(name: string, value: number): Promise<void> {
        console.log(`Mock: Gain ${name} = ${value}`);
    }

    async start(onData: (data: DataView) => void): Promise<void> {
        if (this.isStreaming) return;
        this.isStreaming = true;

        const BLOCK_SIZE = 16384; 
        const buffer = new Int8Array(BLOCK_SIZE);
        
        // FM Synthesis Params
        const modFreq = 440; // 440 Hz Audio Tone
        const deviation = 75_000; // +/- 75 kHz deviation (Standard WFM)
        
        this.intervalId = setInterval(() => {
            if (!this.isStreaming) return;

            for (let i = 0; i < BLOCK_SIZE; i += 2) {
                const t = this.phase / this.sampleRate;
                
                // Modulating Signal (Audio)
                // m(t) = sin(2*pi*f_mod*t)
                const audio = Math.sin(2 * Math.PI * modFreq * t);

                // Instantaneous Frequency Offset
                // f_inst(t) = deviation * m(t)
                const f_inst = deviation * audio;

                // Instantaneous Phase (Integral of f_inst)
                // phi(t) = 2*pi * integral(f_inst) 
                // integral(sin(wt)) = -1/w * cos(wt)
                // phi(t) = 2*pi * deviation * (-1/(2*pi*f_mod)) * cos(2*pi*f_mod*t)
                // phi(t) = - (deviation / f_mod) * cos(2*pi*f_mod*t)
                
                // Modulation Index beta = deviation / f_mod
                const beta = deviation / modFreq;
                const phi = -beta * Math.cos(2 * Math.PI * modFreq * t);

                // IQ = exp(j * phi)
                const valI = Math.cos(phi) * 100;
                const valQ = Math.sin(phi) * 100;

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
            
            onData(new DataView(buffer.buffer));

        }, 10);
    }

    async stop(): Promise<void> {
        this.isStreaming = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
