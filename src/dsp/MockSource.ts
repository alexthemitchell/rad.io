export interface IMockSource {
    start(): void;
    stop(): void;
    getBuffer(): Float32Array;
}

export class MockSource implements IMockSource {
    private isRunning: boolean = false;
    private buffer: Float32Array;
    private phase: number = 0;

    constructor(size: number = 4096) {
        this.buffer = new Float32Array(size);
    }

    start() {
        this.isRunning = true;
    }

    stop() {
        this.isRunning = false;
    }

    getBuffer(): Float32Array {
        if (!this.isRunning) return this.buffer.fill(0);

        // Generate Sine Wave (simulated IQ)
        // I = cos(t), Q = sin(t)
        for (let i = 0; i < this.buffer.length; i += 2) {
            this.buffer[i] = Math.cos(this.phase);     // I
            this.buffer[i + 1] = Math.sin(this.phase); // Q
            this.phase += 0.1;
        }
        return this.buffer;
    }
}
