export type AudioSinkStats = {
    underruns: number;
    queueAheadMs: number;
    concealmentEvents: number;
    popSuppressionEvents: number;
    limiterEvents: number;
    safetyMuteEvents: number;
};

export type AudioSafetyConfig = {
    maxOutputLevel: number;
    limiterDrive: number;
};

export class AudioSink {
    private ctx: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private nextTime = 0;
    private muted = false;
    private outputLevel = 0.6;
    private maxOutputLevel = 0.8;
    private underrunCount = 0;
    private concealmentCount = 0;
    private popSuppressionCount = 0;
    private limiterEventCount = 0;
    private safetyMuteEventCount = 0;
    private lastSample = 0;
    private safetyConfig: AudioSafetyConfig = {
        maxOutputLevel: 0.85,
        limiterDrive: 1.6
    };
    private static readonly RAMP_DOWN_SEC = 0.002;
    private static readonly RAMP_UP_SEC = 0.008;
    
    constructor(private sampleRate = 50000) {}

    async start() {
        if (!this.ctx) {
            this.ctx = new AudioContext({ sampleRate: this.sampleRate });
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = this.resolveTargetGain();
            this.gainNode.connect(this.ctx.destination);
            this.nextTime = this.ctx.currentTime + 0.1; // Buffer ahead slightly
        }
        await this.ctx.resume();

        if (this.gainNode) {
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(this.resolveTargetGain(), now + AudioSink.RAMP_UP_SEC);
            this.popSuppressionCount += 1;
        }
    }

    private resolveTargetGain() {
        if (this.muted) {
            return 0;
        }

        const cappedLevel = Math.min(this.outputLevel, this.maxOutputLevel);
        return Math.max(0, Math.min(1, cappedLevel));
    }

    private applyPopSuppressionRamp() {
        if (!this.ctx || !this.gainNode) return;

        const now = this.ctx.currentTime;
        const gainParam = this.gainNode.gain;
        const current = gainParam.value;
        const target = this.resolveTargetGain();

        gainParam.cancelScheduledValues(now);
        gainParam.setValueAtTime(current, now);
        gainParam.linearRampToValueAtTime(Math.min(current, 0.2), now + AudioSink.RAMP_DOWN_SEC);
        gainParam.linearRampToValueAtTime(target, now + AudioSink.RAMP_UP_SEC);

        this.popSuppressionCount += 1;
    }

    private applyLimiter(sample: number): number {
        const driven = sample * this.safetyConfig.limiterDrive;
        const clipped = Math.tanh(driven);
        const scaled = clipped / Math.max(1, this.safetyConfig.limiterDrive * 0.85);
        const max = this.safetyConfig.maxOutputLevel;
        const limited = Math.max(-max, Math.min(max, scaled));

        if (Math.abs(sample) > max || Math.abs(driven) > 1.2) {
            this.limiterEventCount += 1;
        }

        return limited;
    }

    private writeConcealmentSplice(length: number) {
        if (!this.ctx || length <= 0) return;

        const spliceBuffer = this.ctx.createBuffer(1, length, this.sampleRate);
        const data = spliceBuffer.getChannelData(0);

        for (let i = 0; i < length; i += 1) {
            const t = 1 - (i / Math.max(1, length - 1));
            data[i] = this.lastSample * t;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = spliceBuffer;
        source.connect(this.gainNode ?? this.ctx.destination);
        source.start(this.ctx.currentTime + 0.002);
    }

    push(samples: Float32Array) {
        if (!this.ctx) return;

        // Create buffer and copy input samples into channel data.
        const buffer = this.ctx.createBuffer(1, samples.length, this.sampleRate);
        const channelData = buffer.getChannelData(0);
        let severeSampleCount = 0;
        for (let i = 0; i < samples.length; i++) {
            if (Math.abs(samples[i]) > 1.25) {
                severeSampleCount += 1;
            }
            const limited = this.applyLimiter(samples[i]);
            channelData[i] = limited;
            this.lastSample = limited;
        }

        // Hard-mute pathological bursts to avoid dangerous transients at the speaker.
        const severeThreshold = Math.max(8, Math.floor(samples.length * 0.05));
        if (!this.muted && severeSampleCount > severeThreshold) {
            channelData.fill(0);
            this.lastSample = 0;
            this.safetyMuteEventCount += 1;
            this.applyPopSuppressionRamp();
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
            this.writeConcealmentSplice(Math.floor(this.sampleRate * 0.01));
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
        this.limiterEventCount = 0;
        this.safetyMuteEventCount = 0;
    }

    getStats(): AudioSinkStats {
        if (!this.ctx) {
            return {
                underruns: this.underrunCount,
                queueAheadMs: 0,
                concealmentEvents: this.concealmentCount,
                popSuppressionEvents: this.popSuppressionCount,
                limiterEvents: this.limiterEventCount,
                safetyMuteEvents: this.safetyMuteEventCount
            };
        }

        const queueAhead = Math.max(0, this.nextTime - this.ctx.currentTime) * 1000;
        return {
            underruns: this.underrunCount,
            queueAheadMs: queueAhead,
            concealmentEvents: this.concealmentCount,
            popSuppressionEvents: this.popSuppressionCount,
            limiterEvents: this.limiterEventCount,
            safetyMuteEvents: this.safetyMuteEventCount
        };
    }

    setSafetyConfig(config: Partial<AudioSafetyConfig>) {
        this.safetyConfig = {
            ...this.safetyConfig,
            ...config,
            maxOutputLevel: Math.max(0.1, Math.min(1, config.maxOutputLevel ?? this.safetyConfig.maxOutputLevel)),
            limiterDrive: Math.max(0.6, Math.min(4, config.limiterDrive ?? this.safetyConfig.limiterDrive))
        };
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        this.applyPopSuppressionRamp();
    }

    setOutputLevel(level: number) {
        this.outputLevel = Math.max(0, Math.min(1, level));
        this.applyPopSuppressionRamp();
    }

    setMaxOutputLevel(level: number) {
        this.maxOutputLevel = Math.max(0, Math.min(1, level));
        this.applyPopSuppressionRamp();
    }

    getOutputLevel() {
        return this.outputLevel;
    }

    getMaxOutputLevel() {
        return this.maxOutputLevel;
    }

    isMuted() {
        return this.muted;
    }

    getState(): AudioContextState | 'closed' {
        return this.ctx?.state ?? 'closed';
    }
}
