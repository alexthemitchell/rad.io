export class StreamController {
  private controller: AbortController | null = null;
  private consecutiveTimeouts = 0;
  private readonly MAX_CONSECUTIVE_TIMEOUTS = 2;

  start(): AbortSignal {
    this.stop();
    this.controller = new AbortController();
    this.consecutiveTimeouts = 0;
    return this.controller.signal;
  }

  stop(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  handleTimeout(): boolean {
    this.consecutiveTimeouts++;
    return this.consecutiveTimeouts >= this.MAX_CONSECUTIVE_TIMEOUTS;
  }

  getConsecutiveTimeouts(): number {
    return this.consecutiveTimeouts;
  }

  resetTimeouts(): void {
    this.consecutiveTimeouts = 0;
  }
}
