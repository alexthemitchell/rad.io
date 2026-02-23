export type AudioSinkStats = {
    underruns: number;
    queueAheadMs: number;
    concealmentEvents: number;
    popSuppressionEvents: number;
};

export class AudioSink {
    private ctx: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private nextTime = 0;
    private muted = false;
    private underrunCount = 0;
    private concealmentCount = 0;
    private popSuppressionCount = 0;
    private static readonly RAMP_DOWN_SEC = 0.002;
    private static readonly RAMP_UP_SEC = 0.008;
    
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

        if (this.gainNode) {
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(this.muted ? 0 : 1, now + AudioSink.RAMP_UP_SEC);
            this.popSuppressionCount += 1;
        }
    }

    private applyPopSuppressionRamp() {
        if (!this.ctx || !this.gainNode) return;

        const now = this.ctx.currentTime;
        const gainParam = this.gainNode.gain;
        const current = gainParam.value;
        const target = this.muted ? 0 : 1;

        gainParam.cancelScheduledValues(now);
        gainParam.setValueAtTime(current, now);
        gainParam.linearRampToValueAtTime(Math.min(current, 0.2), now + AudioSink.RAMP_DOWN_SEC);
        gainParam.linearRampToValueAtTime(target, now + AudioSink.RAMP_UP_SEC);

        this.popSuppressionCount += 1;
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
            this.concealmentCount += 1;
            this.applyPopSuppressionRamp();
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
        this.concealmentCount = 0;
        this.popSuppressionCount = 0;
    }

    getStats(): AudioSinkStats {
        if (!this.ctx) {
            return {
                underruns: this.underrunCount,
                queueAheadMs: 0,
                concealmentEvents: this.concealmentCount,
                popSuppressionEvents: this.popSuppressionCount
            };
        }

        const queueAhead = Math.max(0, this.nextTime - this.ctx.currentTime) * 1000;
        return {
            underruns: this.underrunCount,
            queueAheadMs: queueAhead,
            concealmentEvents: this.concealmentCount,
            popSuppressionEvents: this.popSuppressionCount
        };
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        this.applyPopSuppressionRamp();
    }

    isMuted() {
        return this.muted;
    }

    getState(): AudioContextState | 'closed' {
        return this.ctx?.state ?? 'closed';
    }
}
