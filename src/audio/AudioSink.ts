export type AudioSinkStats = {
    underruns: number;
    queueAheadMs: number;
};

export class AudioSink {
    private ctx: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private nextTime = 0;
    private muted = false;
    private underrunCount = 0;
    
    constructor(private sampleRate = 50000) {}

    async start() {
        if (!this.ctx) {
            this.ctx = new AudioContext({ sampleRate: this.sampleRate });
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = this.muted ? 0 : 1;
            this.gainNode.connect(this.ctx.destination);
            this.nextTime = this.ctx.currentTime + 0.1; // Buffer ahead slightly
        }
        await this.ctx.resume();
    }

    push(samples: Float32Array) {
        if (!this.ctx) return;

        // Create buffer and copy input samples into channel data.
        const buffer = this.ctx.createBuffer(1, samples.length, this.sampleRate);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
            channelData[i] = samples[i];
        }

        // Schedule playback
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode ?? this.ctx.destination);
        
        // If we fell behind, jump to now
        if (this.nextTime < this.ctx.currentTime) {
            this.underrunCount += 1;
            this.nextTime = this.ctx.currentTime + 0.05;
        }

        source.start(this.nextTime);
        this.nextTime += buffer.duration;
    }

    stop() {
        this.ctx?.close();
        this.ctx = null;
        this.gainNode = null;
    }

    resetStats() {
        this.underrunCount = 0;
    }

    getStats(): AudioSinkStats {
        if (!this.ctx) {
            return {
                underruns: this.underrunCount,
                queueAheadMs: 0
            };
        }

        const queueAhead = Math.max(0, this.nextTime - this.ctx.currentTime) * 1000;
        return {
            underruns: this.underrunCount,
            queueAheadMs: queueAhead
        };
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        if (this.gainNode) {
            this.gainNode.gain.value = muted ? 0 : 1;
        }
    }

    isMuted() {
        return this.muted;
    }

    getState(): AudioContextState | 'closed' {
        return this.ctx?.state ?? 'closed';
    }
}
