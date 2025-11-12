/**
 * Video Renderer
 *
 * Renders decoded video frames to an HTML canvas element with:
 * - Aspect ratio preservation
 * - Resolution scaling
 * - Frame timing and synchronization
 */

/**
 * Video renderer options
 */
export interface VideoRendererOptions {
  canvas: HTMLCanvasElement;
  maintainAspectRatio?: boolean;
  scaleMode?: "fit" | "fill" | "stretch";
}

/**
 * Video Renderer
 *
 * Handles rendering of decoded VideoFrame objects to a canvas element.
 */
export class VideoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private maintainAspectRatio: boolean;
  private scaleMode: "fit" | "fill" | "stretch";

  // Frame timing
  private lastFrameTime = 0;
  private frameCount = 0;
  private currentFPS = 0;

  // Current video dimensions
  private videoWidth = 0;
  private videoHeight = 0;

  constructor(options: VideoRendererOptions) {
    this.canvas = options.canvas;
    this.maintainAspectRatio = options.maintainAspectRatio ?? true;
    this.scaleMode = options.scaleMode ?? "fit";

    // Get 2D context
    this.ctx = this.canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });

    if (!this.ctx) {
      throw new Error("Failed to get 2D context from canvas");
    }
  }

  /**
   * Render a video frame to the canvas
   */
  public renderFrame(frame: VideoFrame): void {
    if (!this.ctx) {
      frame.close();
      return;
    }

    // Update video dimensions if changed
    if (
      frame.displayWidth !== this.videoWidth ||
      frame.displayHeight !== this.videoHeight
    ) {
      this.videoWidth = frame.displayWidth;
      this.videoHeight = frame.displayHeight;
      this.updateCanvasSize();
    }

    // Calculate scaling and positioning
    const { dx, dy, dWidth, dHeight } = this.calculateDrawRect();

    // Clear canvas
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw frame
    try {
      this.ctx.drawImage(frame, dx, dy, dWidth, dHeight);
    } catch (error) {
      console.error("Failed to render video frame:", error);
    } finally {
      // Always close the frame to free resources
      frame.close();
    }

    // Update frame timing
    this.updateFrameTiming();
  }

  /**
   * Update canvas size based on video dimensions
   */
  private updateCanvasSize(): void {
    if (this.videoWidth === 0 || this.videoHeight === 0) {
      return;
    }

    // Set canvas resolution
    if (this.scaleMode === "stretch") {
      // Keep current canvas size
      return;
    }

    const aspectRatio = this.videoWidth / this.videoHeight;
    const canvasAspect = this.canvas.clientWidth / this.canvas.clientHeight;

    // Guard against division by zero or invalid aspect ratios
    if (
      !isFinite(aspectRatio) ||
      !isFinite(canvasAspect) ||
      aspectRatio <= 0 ||
      canvasAspect <= 0
    ) {
      return;
    }

    if (this.maintainAspectRatio) {
      if (this.scaleMode === "fit") {
        // Fit video inside canvas
        if (aspectRatio > canvasAspect) {
          this.canvas.width = this.canvas.clientWidth;
          this.canvas.height = this.canvas.clientWidth / aspectRatio;
        } else {
          this.canvas.height = this.canvas.clientHeight;
          this.canvas.width = this.canvas.clientHeight * aspectRatio;
        }
      } else {
        // Fill canvas with video
        if (aspectRatio > canvasAspect) {
          this.canvas.height = this.canvas.clientHeight;
          this.canvas.width = this.canvas.clientHeight * aspectRatio;
        } else {
          this.canvas.width = this.canvas.clientWidth;
          this.canvas.height = this.canvas.clientWidth / aspectRatio;
        }
      }
    } else {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
    }
  }

  /**
   * Calculate drawing rectangle for frame
   */
  private calculateDrawRect(): {
    dx: number;
    dy: number;
    dWidth: number;
    dHeight: number;
  } {
    if (this.scaleMode === "stretch" || !this.maintainAspectRatio) {
      return {
        dx: 0,
        dy: 0,
        dWidth: this.canvas.width,
        dHeight: this.canvas.height,
      };
    }

    const aspectRatio = this.videoWidth / this.videoHeight;
    const canvasAspect = this.canvas.width / this.canvas.height;

    // Guard against division by zero or invalid aspect ratios
    if (
      !isFinite(aspectRatio) ||
      !isFinite(canvasAspect) ||
      aspectRatio <= 0 ||
      canvasAspect <= 0
    ) {
      return {
        dx: 0,
        dy: 0,
        dWidth: this.canvas.width,
        dHeight: this.canvas.height,
      };
    }

    let dx = 0;
    let dy = 0;
    let dWidth = this.canvas.width;
    let dHeight = this.canvas.height;

    if (this.scaleMode === "fit") {
      if (aspectRatio > canvasAspect) {
        // Video is wider than canvas
        dHeight = this.canvas.width / aspectRatio;
        dy = (this.canvas.height - dHeight) / 2;
      } else {
        // Video is taller than canvas
        dWidth = this.canvas.height * aspectRatio;
        dx = (this.canvas.width - dWidth) / 2;
      }
    } else {
      // fill mode
      if (aspectRatio > canvasAspect) {
        // Video is wider than canvas
        dWidth = this.canvas.height * aspectRatio;
        dx = (this.canvas.width - dWidth) / 2;
      } else {
        // Video is taller than canvas
        dHeight = this.canvas.width / aspectRatio;
        dy = (this.canvas.height - dHeight) / 2;
      }
    }

    return { dx, dy, dWidth, dHeight };
  }

  /**
   * Update frame timing metrics
   */
  private updateFrameTiming(): void {
    const now = performance.now();
    this.frameCount++;

    // Calculate FPS every second
    if (this.lastFrameTime > 0 && now - this.lastFrameTime >= 1000) {
      this.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    } else if (this.lastFrameTime === 0) {
      this.lastFrameTime = now;
    }
  }

  /**
   * Get current FPS
   */
  public getFPS(): number {
    return this.currentFPS;
  }

  /**
   * Get current video dimensions
   */
  public getVideoDimensions(): { width: number; height: number } {
    return {
      width: this.videoWidth,
      height: this.videoHeight,
    };
  }

  /**
   * Clear the canvas
   */
  public clear(): void {
    if (this.ctx) {
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Reset renderer state
   */
  public reset(): void {
    this.clear();
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.currentFPS = 0;
    this.videoWidth = 0;
    this.videoHeight = 0;
  }
}
