// Worker manager for off-main-thread visualization rendering
// Provides a simple API for components to use worker-based rendering

type Sample = {
  I: number;
  Q: number;
};

type ViewTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

type RenderConfig = {
  width: number;
  height: number;
  dpr: number;
  freqMin?: number;
  freqMax?: number;
};

type RenderData = {
  samples?: Sample[];
  fftData?: Float32Array[];
  transform?: ViewTransform;
};

type VisualizationType =
  | "spectrogram"
  | "constellation"
  | "waveform"
  | "waterfall";

type WorkerMessage =
  | { type: "initialized"; success: boolean; hasWebGL: boolean; has2D: boolean }
  | { type: "resized" }
  | {
      type: "frameComplete";
      frameId: number;
      renderTimeMs: number;
      queueSize: number;
      droppedFrames: number;
      renderedFrames: number;
    }
  | { type: "frameDropped"; frameId: number; reason: string; queueSize: number }
  | { type: "error"; message: string };

export type RenderMetrics = {
  frameId: number;
  renderTimeMs: number;
  queueSize: number;
  droppedFrames: number;
  renderedFrames: number;
};

export type WorkerCapabilities = {
  hasWebGL: boolean;
  has2D: boolean;
};

/**
 * Manages a worker for off-main-thread visualization rendering.
 * Handles OffscreenCanvas transfer, frame queuing, and backpressure.
 */
export class VisualizationWorkerManager {
  private worker: Worker | null = null;
  private transferred = false;
  private nextFrameId = 0;
  private capabilities: WorkerCapabilities | null = null;
  private onMetricsCallback: ((metrics: RenderMetrics) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private initPromise: Promise<boolean> | null = null;

  /**
   * Check if worker and OffscreenCanvas are supported
   */
  static isSupported(): boolean {
    return (
      typeof Worker !== "undefined" && typeof OffscreenCanvas === "function"
    );
  }

  /**
   * Initialize the worker with a canvas element
   * @param canvas - The canvas element to transfer to the worker
   * @param vizType - Type of visualization (constellation, waveform, etc.)
   * @param config - Initial rendering configuration
   * @returns Promise that resolves to true if initialization succeeded
   */
  async initialize(
    canvas: HTMLCanvasElement,
    vizType: VisualizationType,
    config: RenderConfig,
  ): Promise<boolean> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initializeInternal(canvas, vizType, config);
    return this.initPromise;
  }

  private async _initializeInternal(
    canvas: HTMLCanvasElement,
    vizType: VisualizationType,
    config: RenderConfig,
  ): Promise<boolean> {
    if (this.transferred) {
      throw new Error("Canvas already transferred to worker");
    }

    if (!VisualizationWorkerManager.isSupported()) {
      return false;
    }

    // Check if canvas can be transferred
    const hasContext =
      canvas.getContext("2d") !== null ||
      canvas.getContext("webgl") !== null ||
      canvas.getContext("webgl2") !== null ||
      canvas.getContext("webgpu") !== null;

    if (hasContext) {
      // Canvas already has a context, can't transfer
      return false;
    }

    const transferFn = (
      canvas as HTMLCanvasElement & {
        transferControlToOffscreen?: () => OffscreenCanvas;
      }
    ).transferControlToOffscreen;

    if (typeof transferFn !== "function") {
      return false;
    }

    try {
      // Create worker
      const workerUrl =
        typeof window !== "undefined" && typeof URL !== "undefined"
          ? new URL("./visualization-renderer.worker.ts", window.location.href)
          : ("./visualization-renderer.worker.ts" as unknown as URL);

      this.worker = new Worker(workerUrl);

      // Set up message handler
      this.worker.onmessage = (ev: MessageEvent<WorkerMessage>): void => {
        const msg = ev.data;

        if (msg.type === "initialized") {
          this.capabilities = {
            hasWebGL: msg.hasWebGL,
            has2D: msg.has2D,
          };
        } else if (msg.type === "frameComplete") {
          if (this.onMetricsCallback) {
            this.onMetricsCallback({
              frameId: msg.frameId,
              renderTimeMs: msg.renderTimeMs,
              queueSize: msg.queueSize,
              droppedFrames: msg.droppedFrames,
              renderedFrames: msg.renderedFrames,
            });
          }
        } else if (msg.type === "frameDropped") {
          console.warn("Frame dropped by worker:", msg);
        } else if (msg.type === "error") {
          console.error("Worker error:", msg.message);
          if (this.onErrorCallback) {
            this.onErrorCallback(msg.message);
          }
        }
      };

      this.worker.onerror = (err): void => {
        console.error("Worker error event:", err);
        if (this.onErrorCallback) {
          this.onErrorCallback(err.message);
        }
      };

      // Set canvas dimensions before transfer
      const pixelW = Math.max(1, Math.floor(config.width * config.dpr));
      const pixelH = Math.max(1, Math.floor(config.height * config.dpr));
      // eslint-disable-next-line no-param-reassign
      canvas.width = pixelW;
      // eslint-disable-next-line no-param-reassign
      canvas.height = pixelH;

      // Transfer canvas to worker
      const offscreen = transferFn.call(canvas);
      this.transferred = true;

      // Send init message
      this.worker.postMessage(
        {
          type: "init",
          canvas: offscreen,
          visualizationType: vizType,
          renderConfig: config,
        },
        [offscreen],
      );

      // Wait for initialization confirmation with timeout
      await new Promise<void>((resolve, reject) => {
        const INIT_TIMEOUT_MS = 5000;
        let settled = false;

        const handler = (ev: MessageEvent<WorkerMessage>): void => {
          if (ev.data.type === "initialized" && !settled) {
            settled = true;
            clearTimeout(timeoutId);
            this.worker?.removeEventListener("message", handler);
            resolve();
          }
        };

        // Add event listener before setting timeout to avoid missing messages
        this.worker?.addEventListener("message", handler);

        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true;
            this.worker?.removeEventListener("message", handler);
            reject(new Error("Worker initialization timed out after 5s"));
          }
        }, INIT_TIMEOUT_MS);
      });

      return true;
    } catch (err) {
      console.error("Failed to initialize worker:", err);
      this.cleanup();
      return false;
    }
  }

  /**
   * Check if the worker is initialized and ready
   */
  isReady(): boolean {
    return this.transferred && this.worker !== null;
  }

  /**
   * Get worker capabilities (WebGL, 2D support)
   */
  getCapabilities(): WorkerCapabilities | null {
    return this.capabilities;
  }

  /**
   * Render a frame in the worker
   * @param data - Data to render (samples, FFT data, etc.)
   */
  render(data: RenderData): void {
    if (!this.isReady()) {
      throw new Error("Worker not initialized");
    }

    const frameId = this.nextFrameId++;

    if (!this.worker) {
      throw new Error("Worker not initialized");
    }

    this.worker.postMessage({
      type: "render",
      frameId,
      data,
    });
  }

  /**
   * Update rendering configuration (e.g., on resize)
   * @param config - New rendering configuration
   */
  resize(config: RenderConfig): void {
    if (!this.isReady() || !this.worker) {
      throw new Error("Worker not initialized");
    }

    this.worker.postMessage({
      type: "resize",
      renderConfig: config,
    });
  }

  /**
   * Set callback for render metrics
   */
  onMetrics(callback: (metrics: RenderMetrics) => void): void {
    this.onMetricsCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Clean up worker and resources
   */
  cleanup(): void {
    if (this.worker) {
      try {
        this.worker.postMessage({ type: "dispose" });
      } catch {
        // Ignore errors during cleanup
      }

      try {
        this.worker.terminate();
      } catch {
        // Ignore errors during cleanup
      }

      this.worker = null;
    }

    this.transferred = false;
    this.capabilities = null;
    this.onMetricsCallback = null;
    this.onErrorCallback = null;
    this.initPromise = null;
  }
}
