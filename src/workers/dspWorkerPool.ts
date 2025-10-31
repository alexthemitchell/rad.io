export interface DspWorkerMessage {
  type: "fft" | "error";
  payload: unknown;
}

class DspWorkerPool {
  private workers: Worker[] = [];
  private nextWorker = 0;
  private eventTarget = new EventTarget();

  constructor(poolSize: number) {
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(new URL("./dspWorker.ts", import.meta.url), {
        type: "module",
      });
      this.workers.push(worker);
      worker.onmessage = (event: MessageEvent<DspWorkerMessage>): void => {
        this.eventTarget.dispatchEvent(
          new MessageEvent("message", { data: event.data }),
        );
      };
    }
  }

  postMessage(message: unknown): void {
    const worker = this.workers[this.nextWorker];
    if (worker) {
      worker.postMessage(message);
      this.nextWorker = (this.nextWorker + 1) % this.workers.length;
    }
  }

  // Typed overload for message events carrying DspWorkerMessage
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<DspWorkerMessage>) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  // Fallback overload for any other event types
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener:
      | ((event: MessageEvent<DspWorkerMessage>) => void)
      | (EventListenerOrEventListenerObject | null),
    options?: boolean | AddEventListenerOptions,
  ): void {
    // We can safely cast here because we control dispatchEvent to always send a MessageEvent for 'message'
    this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject,
      options,
    );
  }

  // Typed overload for message events
  removeEventListener(
    type: "message",
    callback: (event: MessageEvent<DspWorkerMessage>) => void,
    options?: EventListenerOptions | boolean,
  ): void;
  // Fallback overload for any other event types
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    callback:
      | ((event: MessageEvent<DspWorkerMessage>) => void)
      | (EventListenerOrEventListenerObject | null),
    options?: EventListenerOptions | boolean,
  ): void {
    this.eventTarget.removeEventListener(
      type,
      callback as EventListenerOrEventListenerObject,
      options,
    );
  }

  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
  }
}

export const dspWorkerPool = new DspWorkerPool(
  (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4,
);
