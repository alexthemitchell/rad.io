export type AudioPllState = {
  ratio: number;
  targetQueueMs: number;
  queueErrorMs: number;
};

export class AudioPllController {
  private ratio = 1;
  private targetQueueMs = 120;

  update(queueAheadMs: number): AudioPllState {
    const safeQueueAheadMs = Number.isFinite(queueAheadMs) ? Math.max(0, queueAheadMs) : this.targetQueueMs;
    const rawError = this.targetQueueMs - safeQueueAheadMs;
    const error = Math.abs(rawError) < 2 ? 0 : rawError;
    const correction = error * 0.00002;
    this.ratio = Math.max(0.96, Math.min(1.04, this.ratio + correction));

    return {
      ratio: this.ratio,
      targetQueueMs: this.targetQueueMs,
      queueErrorMs: error
    };
  }

  reset(): void {
    this.ratio = 1;
  }

  setTargetQueueMs(targetQueueMs: number): void {
    if (!Number.isFinite(targetQueueMs)) {
      return;
    }

    this.targetQueueMs = Math.max(20, Math.min(400, targetQueueMs));
  }

  getState(): AudioPllState {
    return {
      ratio: this.ratio,
      targetQueueMs: this.targetQueueMs,
      queueErrorMs: 0
    };
  }
}
