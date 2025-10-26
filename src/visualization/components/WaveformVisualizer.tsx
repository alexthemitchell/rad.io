import { useCallback, useEffect, useRef, useMemo } from "react";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { useVisualizationInteraction } from "../../hooks/useVisualizationInteraction";
import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import { calculateWaveform, type Sample } from "../../utils/dsp";
import { performanceMonitor } from "../../utils/performanceMonitor";
import type { IVisualizationRenderer } from "../../types/visualization";
import type { GL } from "../../utils/webgl";
import type { ReactElement } from "react";

export type WaveformVisualizerProps = {
  samples: Sample[];
  width?: number;
  height?: number;
  /**
   * When true, rendering continues even when the tab is hidden or element is off-screen.
   * Defaults to false for power efficiency.
   */
  continueInBackground?: boolean;
};

export default function WaveformVisualizer({
  samples,
  width = 750,
  height = 300,
  continueInBackground = false,
}: WaveformVisualizerProps): ReactElement {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const transferredRef = useRef<boolean>(false);

  // WebGPU state (reuse renderer across renders)
  const webgpuRendererRef = useRef<IVisualizationRenderer | null>(null);
  const webgpuAttemptedRef = useRef<boolean>(false);

  // WebGL state
  const glStateRef = useRef<{
    gl: GL | null;
    program: WebGLProgram | null;
    vbo: WebGLBuffer | null;
  }>({ gl: null, program: null, vbo: null });

  // Add interaction handlers for pan, zoom, and gestures
  const {
    transform,
    handlers,
    canvasRef: interactionCanvasRef,
    resetTransform,
  } = useVisualizationInteraction();

  // Combined ref callback to handle both internal ref and interaction ref
  const canvasRef = useCallback(
    (element: HTMLCanvasElement | null) => {
      internalCanvasRef.current = element;
      interactionCanvasRef(element);
    },
    [interactionCanvasRef],
  );

  // Visibility optimization hooks
  const isPageVisible = usePageVisibility();
  const isElementVisible = useIntersectionObserver(internalCanvasRef, {
    threshold: 0.1,
  });

  // Generate accessible text description of the waveform data
  const accessibleDescription = useMemo((): string => {
    if (samples.length === 0) {
      return "No waveform data";
    }

    const waveformData = calculateWaveform(samples);
    const amplitude = waveformData.amplitude;
    if (amplitude.length === 0) {
      return "Waveform calculation failed";
    }

    const maxAmplitude = Math.max(...Array.from(amplitude));
    const minAmplitude = Math.min(...Array.from(amplitude));
    const avgAmplitude =
      Array.from(amplitude).reduce((a, b) => a + b, 0) / amplitude.length;

    return `Amplitude waveform showing ${samples.length} time-domain samples. Signal amplitude ranges from ${minAmplitude.toFixed(3)} to ${maxAmplitude.toFixed(3)} with average ${avgAmplitude.toFixed(3)}. The waveform represents signal strength variation over time.`;
  }, [samples]);

  useEffect((): void => {
    const canvas = internalCanvasRef.current;
    if (!canvas || samples.length === 0) {
      return;
    }

    // Skip rendering if not visible (unless continueInBackground is true)
    if (!continueInBackground && (!isPageVisible || !isElementVisible)) {
      return;
    }

    // Set canvas dimensions synchronously for immediate availability in tests
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const run = async (): Promise<void> => {
      const markStart = "render-waveform-start";
      performanceMonitor.mark(markStart);
      // Try WebGPU first (modern browsers)
      try {
        const webgpu = await import("../../utils/webgpu");
        if (webgpu.isWebGPUSupported()) {
          const pixelW = Math.max(1, Math.floor(width * dpr));
          const pixelH = Math.max(1, Math.floor(height * dpr));
          canvas.width = pixelW;
          canvas.height = pixelH;

          if (!webgpuRendererRef.current && !webgpuAttemptedRef.current) {
            webgpuAttemptedRef.current = true;
            const r = new webgpu.WebGPULineRenderer();
            const inited = await r.initialize(canvas);
            if (inited) {
              webgpuRendererRef.current = r;
            }
          }

          if (webgpuRendererRef.current?.isReady()) {
            // Calculate waveform data
            const { amplitude } = calculateWaveform(samples);
            if (amplitude.length === 0) {
              return;
            }

            // Calculate statistics for adaptive scaling
            const maxAmplitude = Math.max(...Array.from(amplitude));
            const minAmplitude = Math.min(...Array.from(amplitude));
            const amplitudeRange = maxAmplitude - minAmplitude || 1;
            const padding = amplitudeRange * 0.1;
            const displayMin = minAmplitude - padding;
            const displayMax = maxAmplitude + padding;
            const displayRange = displayMax - displayMin;

            // Build positions in NDC [-1,1] for LINE_STRIP
            const positions = new Float32Array(amplitude.length * 2);
            for (let i = 0; i < amplitude.length; i++) {
              const x = -1 + (2 * i) / (amplitude.length - 1);
              const amp = amplitude[i] ?? 0;
              const y = -1 + (2 * (amp - displayMin)) / displayRange;
              positions[i * 2 + 0] = x;
              positions[i * 2 + 1] = y;
            }

            const success = webgpuRendererRef.current.render({
              positions,
              color: [0.39, 0.86, 1.0, 0.9], // rgba(100,220,255,0.9)
              lineWidth: 2.0,
            });

            if (success) {
              renderTierManager.reportSuccess(RenderTier.WebGPU);
              performanceMonitor.measure("render-waveform", markStart);
              return;
            }
          }
        }
      } catch (err) {
        console.warn(
          "[WaveformVisualizer] WebGPU path failed, falling back to WebGL:",
          err,
        );
      }

      // Try WebGL next
      try {
        const webgl = await import("../../utils/webgl");
        const pixelW = Math.max(1, Math.floor(width * dpr));
        const pixelH = Math.max(1, Math.floor(height * dpr));
        canvas.width = pixelW;
        canvas.height = pixelH;

        let { gl } = glStateRef.current;
        if (!gl) {
          const got = webgl.getGL(canvas);
          gl = got.gl;
          glStateRef.current.gl = gl;
        }

        if (gl) {
          // Calculate waveform data
          const { amplitude } = calculateWaveform(samples);
          if (amplitude.length === 0) {
            return;
          }

          // Calculate statistics for adaptive scaling
          const maxAmplitude = Math.max(...Array.from(amplitude));
          const minAmplitude = Math.min(...Array.from(amplitude));
          const amplitudeRange = maxAmplitude - minAmplitude || 1;
          const padding = amplitudeRange * 0.1;
          const displayMin = minAmplitude - padding;
          const displayMax = maxAmplitude + padding;
          const displayRange = displayMax - displayMin;

          // Build positions in NDC [-1,1] for LINE_STRIP
          const positions = new Float32Array(amplitude.length * 2);
          for (let i = 0; i < amplitude.length; i++) {
            const x = -1 + (2 * i) / (amplitude.length - 1);
            const amp = amplitude[i] ?? 0;
            const y = -1 + (2 * (amp - displayMin)) / displayRange;
            positions[i * 2 + 0] = x;
            positions[i * 2 + 1] = y;
          }

          if (!glStateRef.current.program) {
            const vs = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
            const fs = `
precision mediump float;
void main() {
  gl_FragColor = vec4(0.39, 0.86, 1.0, 0.9); // rgba(100,220,255,0.9)
}`;
            const prog = webgl.createProgram(gl, vs, fs);
            glStateRef.current.program = prog;
            glStateRef.current.vbo = gl.createBuffer();
          }

          gl.viewport(0, 0, pixelW, pixelH);
          gl.disable(gl.DEPTH_TEST);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.clearColor(0.04, 0.06, 0.1, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);

          const prog = glStateRef.current.program;
          gl.useProgram(prog);
          const aPos = gl.getAttribLocation(prog, "a_position");

          gl.bindBuffer(gl.ARRAY_BUFFER, glStateRef.current.vbo);
          gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

          gl.lineWidth(2.0);
          gl.drawArrays(gl.LINE_STRIP, 0, amplitude.length);

          renderTierManager.reportSuccess(
            gl instanceof WebGL2RenderingContext
              ? RenderTier.WebGL2
              : RenderTier.WebGL1,
          );
          performanceMonitor.measure("render-waveform", markStart);

          return;
        }
      } catch (err) {
        console.warn(
          "[WaveformVisualizer] WebGL path failed, falling back:",
          err,
        );
      }

      const supportsOffscreen =
        typeof OffscreenCanvas === "function" && typeof Worker !== "undefined";
      const shouldUseWorker = supportsOffscreen;

      if (shouldUseWorker) {
        if (!workerRef.current) {
          try {
            const workerUrl =
              typeof window !== "undefined" && typeof URL !== "undefined"
                ? new URL(
                    "../workers/visualization.worker.ts",
                    window.location.href,
                  )
                : ("../workers/visualization.worker.ts" as unknown as URL);
            const worker = new Worker(workerUrl);
            workerRef.current = worker;
          } catch (e) {
            console.error("Could not create visualization worker", e);
            workerRef.current = null;
          }
          if (workerRef.current) {
            workerRef.current.onmessage = (ev): void => {
              const d = ev.data as unknown as {
                type?: string;
                viz?: string;
                renderTimeMs?: number;
              };
              if (d.type === "metrics") {
                console.warn(
                  `[viz worker] ${d.viz} render ${d.renderTimeMs?.toFixed(2)}ms`,
                );
              }
            };
          }
        }

        if (workerRef.current) {
          if (!transferredRef.current) {
            // Check if canvas already has a rendering context
            // (WebGPU/WebGL may have tried and failed above)
            const hasContext =
              canvas.getContext("2d") !== null ||
              canvas.getContext("webgl") !== null ||
              canvas.getContext("webgl2") !== null ||
              canvas.getContext("webgpu") !== null;

            const canTransfer =
              !hasContext &&
              typeof (
                canvas as HTMLCanvasElement & {
                  transferControlToOffscreen?: () => OffscreenCanvas;
                }
              ).transferControlToOffscreen === "function";
            if (canTransfer) {
              canvas.width = width * dpr;
              canvas.height = height * dpr;

              const offscreen = (
                canvas as HTMLCanvasElement & {
                  transferControlToOffscreen: () => OffscreenCanvas;
                }
              ).transferControlToOffscreen();
              transferredRef.current = true;
              renderTierManager.reportSuccess(RenderTier.Worker);
              workerRef.current.postMessage(
                {
                  type: "init",
                  canvas: offscreen,
                  vizType: "waveform",
                  width,
                  height,
                  dpr,
                },
                [offscreen],
              );
            }
          } else {
            workerRef.current.postMessage({
              type: "resize",
              width,
              height,
              dpr,
            });
          }

          if (transferredRef.current) {
            workerRef.current.postMessage({
              type: "render",
              data: { samples, transform },
            });
            return;
          }
        }
      }

      // Fallback: render on main thread (existing implementation)
      if (transferredRef.current) {
        return;
      }
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });
      if (!ctx) {
        return;
      }

      // Set up high DPI canvas
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      // Apply user interaction transform (pan and zoom)
      ctx.save();
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      // Professional dark background
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, width, height);

      const margin = { top: 60, bottom: 60, left: 70, right: 60 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      // Calculate waveform data
      const { amplitude } = calculateWaveform(samples);

      // Calculate statistics for adaptive scaling
      const maxAmplitude = Math.max(...Array.from(amplitude));
      const minAmplitude = Math.min(...Array.from(amplitude));
      const amplitudeRange = maxAmplitude - minAmplitude || 1;

      // Add padding to range
      const padding = amplitudeRange * 0.1;
      const displayMin = minAmplitude - padding;
      const displayMax = maxAmplitude + padding;
      const displayRange = displayMax - displayMin;

      // Draw a simplified waveform for fallback (keeps responsive)
      ctx.strokeStyle = "rgba(100,220,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const maxPoints = Math.max(100, Math.round(chartWidth * 2));
      const step = Math.max(1, Math.floor(amplitude.length / maxPoints));
      for (let i = 0; i < amplitude.length; i += step) {
        const x = margin.left + (i / amplitude.length) * chartWidth;
        const amp = amplitude[i] ?? 0;
        const y =
          margin.top +
          chartHeight -
          ((amp - displayMin) / displayRange) * chartHeight;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Restore context state after transform
      ctx.restore();

      renderTierManager.reportSuccess(RenderTier.Canvas2D);
      performanceMonitor.measure("render-waveform", markStart);
    };
    void run();
  }, [
    samples,
    width,
    height,
    transform,
    isPageVisible,
    isElementVisible,
    continueInBackground,
  ]);

  // Cleanup worker and GL on unmount
  useEffect((): (() => void) => {
    const st = glStateRef.current;
    return () => {
      // WebGPU cleanup
      if (webgpuRendererRef.current) {
        try {
          webgpuRendererRef.current.cleanup();
        } catch {
          // ignore cleanup errors
        }
        webgpuRendererRef.current = null;
      }

      // GL cleanup
      try {
        if (st.gl && st.vbo) {
          st.gl.deleteBuffer(st.vbo);
        }
        if (st.gl && st.program) {
          st.gl.deleteProgram(st.program);
        }
      } catch {
        // ignore cleanup errors
      }

      if (workerRef.current) {
        try {
          workerRef.current.postMessage({ type: "dispose" });
        } catch (e) {
          console.warn("dispose postMessage failed", e);
        }
        try {
          workerRef.current.terminate();
        } catch (e) {
          console.warn("worker terminate failed", e);
        }
        workerRef.current = null;
      }
      transferredRef.current = false;
    };
  }, []);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={accessibleDescription}
        {...handlers}
        onDoubleClick={(): void => resetTransform()}
      />
    </div>
  );
}
