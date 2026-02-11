export class AudioSink {
    private ctx: AudioContext | null = null;
    private nextTime = 0;
    
    constructor(private sampleRate = 50000) {}

    async start() {
        if (!this.ctx) {
            this.ctx = new AudioContext({ sampleRate: this.sampleRate });
            this.nextTime = this.ctx.currentTime + 0.1; // Buffer ahead slightly
        }
        await this.ctx.resume();
    }

    push(samples: Float32Array) {
        if (!this.ctx) return;

        // Create buffer
        const buffer = this.ctx.createBuffer(1, samples.length, this.sampleRate);
        buffer.copyToChannel(samples, 0);

        // Schedule playback
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        
        // If we fell behind, jump to now
        if (this.nextTime < this.ctx.currentTime) {
            this.nextTime = this.ctx.currentTime + 0.05;
        }

        source.start(this.nextTime);
        this.nextTime += buffer.duration;
    }

    stop() {
        this.ctx?.close();
        this.ctx = null;
    }
}
