import { useCallback, useEffect, useRef, useMemo } from "react";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { useVisualizationInteraction } from "../../hooks/useVisualizationInteraction";
import { renderTierManager } from "../../lib/render/RenderTierManager";
import { RenderTier } from "../../types/rendering";
import { performanceMonitor } from "../../utils/performanceMonitor";
import { DEFAULT_MARGIN } from "../grid";
import type { IVisualizationRenderer } from "../../types/visualization";
import type { GL } from "../../utils/webgl";
import type { ReactElement } from "react";

export type Sample = {
  I: number;
  Q: number;
};

export type IQConstellationProps = {
  samples: Sample[];
  width?: number;
  height?: number;
  /**
   * When true, rendering continues even when the tab is hidden or element is off-screen.
   * Defaults to false for power efficiency.
   */
  continueInBackground?: boolean;
};

export default function IQConstellation({
  samples,
  width = 750,
  height = 400,
  continueInBackground = false,
}: IQConstellationProps): ReactElement {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  // Track whether this canvas element has been transferred to OffscreenCanvas
  const transferredRef = useRef<boolean>(false);

  // WebGPU state (memoize renderer to avoid re-initializing every frame)
  const webgpuRendererRef = useRef<IVisualizationRenderer | null>(null);
  const webgpuAttemptedRef = useRef<boolean>(false);

  // WebGL state
  const glStateRef = useRef<{
    gl: GL | null;
    program: WebGLProgram | null;
    vbo: WebGLBuffer | null;
    colorVBO: WebGLBuffer | null;
    pointSize: number;
  }>({ gl: null, program: null, vbo: null, colorVBO: null, pointSize: 2.0 });

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

  // Generate accessible text description of the constellation data
  const accessibleDescription = useMemo((): string => {
    if (samples.length === 0) {
      return "No IQ constellation data";
    }

    const iValues = samples.map((s) => s.I);
    const qValues = samples.map((s) => s.Q);
    const iMin = Math.min(...iValues);
    const iMax = Math.max(...iValues);
    const qMin = Math.min(...qValues);
    const qMax = Math.max(...qValues);
    const iRange = (iMax - iMin).toFixed(3);
    const qRange = (qMax - qMin).toFixed(3);

    return `IQ Constellation diagram showing ${samples.length} signal samples. In-phase (I) component ranges from ${iMin.toFixed(3)} to ${iMax.toFixed(3)} with range ${iRange}. Quadrature (Q) component ranges from ${qMin.toFixed(3)} to ${qMax.toFixed(3)} with range ${qRange}. The pattern represents the modulation scheme and signal quality.`;
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
      const markStart = "render-iq-constellation-start";
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
            const r = new webgpu.WebGPUPointRenderer();
            const inited = await r.initialize(canvas);
            if (inited) {
              webgpuRendererRef.current = r;
            }
          }

          if (webgpuRendererRef.current?.isReady()) {
            // Build positions in NDC [-1,1] using min/max
            const iValues = samples.map((s) => s.I);
            const qValues = samples.map((s) => s.Q);
            const iMin = Math.min(...iValues, -0.1);
            const iMax = Math.max(...iValues, 0.1);
            const qMin = Math.min(...qValues, -0.1);
            const qMax = Math.max(...qValues, 0.1);
            const padI = (iMax - iMin) * 0.1;
            const padQ = (qMax - qMin) * 0.1;
            const sI = 2 / (iMax - iMin + 2 * padI);
            const sQ = 2 / (qMax - qMin + 2 * padQ);
            const oI = -1 - sI * (iMin - padI);
            const oQ = -1 - sQ * (qMin - padQ);

            const positions = new Float32Array(samples.length * 2);
            for (let i = 0; i < samples.length; i++) {
              const s = samples[i];
              if (!s) {
                continue;
              }
              positions[i * 2 + 0] = sI * s.I + oI;
              positions[i * 2 + 1] = sQ * s.Q + oQ;
            }

            // Density-based alpha calculation
            const gridSize = 0.003;
            const densityMap = new Map<string, number>();
            const MAX_DENSITY_SAMPLES = 8192;
            const densitySamples =
              samples.length > MAX_DENSITY_SAMPLES
                ? samples.filter(
                    (_, i) =>
                      i % Math.ceil(samples.length / MAX_DENSITY_SAMPLES) === 0,
                  )
                : samples;

            for (const s of densitySamples) {
              const gi = Math.round(s.I / gridSize) * gridSize;
              const gq = Math.round(s.Q / gridSize) * gridSize;
              const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
              densityMap.set(key, (densityMap.get(key) ?? 0) + 1);
            }
            const maxDensity = Math.max(...Array.from(densityMap.values()), 1);

            const colors = new Float32Array(samples.length * 4);
            for (let i = 0; i < samples.length; i++) {
              const s = samples[i];
              if (!s) {
                continue;
              }
              const gi = Math.round(s.I / gridSize) * gridSize;
              const gq = Math.round(s.Q / gridSize) * gridSize;
              const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
              const dens = (densityMap.get(key) ?? 1) / maxDensity;
              const alpha = Math.min(1, 0.4 + dens * 0.8);
              colors[i * 4 + 0] = 0.31; // r ~ 80/255
              colors[i * 4 + 1] = 0.78; // g ~ 200/255
              colors[i * 4 + 2] = 1.0; // b ~ 255/255
              colors[i * 4 + 3] = alpha;
            }

            const success = webgpuRendererRef.current.render({
              positions,
              colors,
              pointSize: Math.max(2, Math.round(2 * dpr)),
            });

            if (success) {
              renderTierManager.reportSuccess(RenderTier.WebGPU);
              performanceMonitor.measure("render-iq-constellation", markStart);
              return;
            }
          }
        }
      } catch (err) {
        console.warn(
          "IQConstellation: WebGPU rendering failed, falling back to WebGL",
          err,
        );
      }

      // Try WebGL next
      try {
        // Use shared WebGL utilities
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
          // Optimize: downsample for density calculation if too many samples
          // Rendering all points is fine, but density calc can be expensive
          const MAX_DENSITY_SAMPLES = 8192;
          const densitySamples =
            samples.length > MAX_DENSITY_SAMPLES
              ? samples.filter(
                  (_, i) =>
                    i % Math.ceil(samples.length / MAX_DENSITY_SAMPLES) === 0,
                )
              : samples;

          // Build positions in NDC [-1,1] using min/max
          const iValues = samples.map((s) => s.I);
          const qValues = samples.map((s) => s.Q);
          const iMin = Math.min(...iValues, -0.1);
          const iMax = Math.max(...iValues, 0.1);
          const qMin = Math.min(...qValues, -0.1);
          const qMax = Math.max(...qValues, 0.1);
          const padI = (iMax - iMin) * 0.1;
          const padQ = (qMax - qMin) * 0.1;
          const sI = 2 / (iMax - iMin + 2 * padI);
          const sQ = 2 / (qMax - qMin + 2 * padQ);
          const oI = -1 - sI * (iMin - padI);
          const oQ = -1 - sQ * (qMin - padQ);

          const positions = new Float32Array(samples.length * 2);
          for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            if (!s) {
              continue;
            }
            positions[i * 2 + 0] = sI * s.I + oI;
            positions[i * 2 + 1] = sQ * s.Q + oQ;
          }

          // Density-based alpha (approximate) on CPU
          const gridSize = 0.003;
          const densityMap = new Map<string, number>();
          // Use downsampled set for density calculation
          for (const s of densitySamples) {
            const gi = Math.round(s.I / gridSize) * gridSize;
            const gq = Math.round(s.Q / gridSize) * gridSize;
            const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
            densityMap.set(key, (densityMap.get(key) ?? 0) + 1);
          }
          const maxDensity = Math.max(...Array.from(densityMap.values()), 1);

          // But use full sample set for rendering colors
          const colors = new Float32Array(samples.length * 4);
          for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            if (!s) {
              continue;
            }
            const gi = Math.round(s.I / gridSize) * gridSize;
            const gq = Math.round(s.Q / gridSize) * gridSize;
            const key = `${gi.toFixed(4)},${gq.toFixed(4)}`;
            const dens = (densityMap.get(key) ?? 1) / maxDensity;
            const alpha = Math.min(1, 0.4 + dens * 0.8);
            colors[i * 4 + 0] = 0.31; // r ~ 80/255
            colors[i * 4 + 1] = 0.78; // g ~ 200/255
            colors[i * 4 + 2] = 1.0; // b ~ 255/255
            colors[i * 4 + 3] = alpha;
          }

          if (!glStateRef.current.program) {
            const vs = `
attribute vec2 a_position;
attribute vec4 a_color;
varying vec4 v_color;
void main() {
  v_color = a_color;
  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = ${Math.max(2, Math.round(2 * dpr))}.0;
}`;
            const fs = `
precision mediump float;
varying vec4 v_color;
void main() {
  // circular point
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  gl_FragColor = v_color;
}`;
            const prog = webgl.createProgram(gl, vs, fs);
            glStateRef.current.program = prog;
            glStateRef.current.vbo = gl.createBuffer();
            glStateRef.current.colorVBO = gl.createBuffer();
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
          const aCol = gl.getAttribLocation(prog, "a_color");

          gl.bindBuffer(gl.ARRAY_BUFFER, glStateRef.current.vbo);
          gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, glStateRef.current.colorVBO);
          gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(aCol);
          gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 0, 0);

          gl.drawArrays(gl.POINTS, 0, samples.length);

          renderTierManager.reportSuccess(
            gl instanceof WebGL2RenderingContext
              ? RenderTier.WebGL2
              : RenderTier.WebGL1,
          );
          performanceMonitor.measure("render-iq-constellation", markStart);
          return;
        }
      } catch (err) {
        // fall back
        console.warn(
          "IQConstellation: WebGL rendering failed, falling back to worker/2D",
          err,
          {
            canvasSize: { width, height },
            sampleCount: samples.length,
            errorType: err instanceof Error ? err.name : typeof err,
          },
        );
      }

      const supportsOffscreen =
        typeof OffscreenCanvas === "function" && typeof Worker !== "undefined";

      if (supportsOffscreen) {
        // Create worker if needed
        if (!workerRef.current) {
          try {
            // Use webpack's worker-loader syntax for production builds
            // For tests, this will be mocked
            // Avoid import.meta.url to keep TS compatible with Jest/commonjs
            // Use a relative URL based on window location; bundlers can rewrite in prod
            const workerUrl =
              typeof window !== "undefined" && typeof URL !== "undefined"
                ? new URL(
                    "../workers/visualization.worker.ts",
                    window.location.href,
                  )
                : ("../workers/visualization.worker.ts" as unknown as URL);
            const worker = new Worker(workerUrl);
            workerRef.current = worker as unknown as Worker;
          } catch (e1) {
            console.error(
              "IQConstellation: Worker creation failed, falling back to main thread",
              e1,
              {
                supportsOffscreen: typeof OffscreenCanvas === "function",
                supportsWorker: typeof Worker !== "undefined",
              },
            );
            workerRef.current = null;
          }
          if (workerRef.current) {
            // Worker metrics logging removed to reduce noise
          }
        }

        if (workerRef.current) {
          // Only transfer once; never call getContext on a transferred canvas
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
              // Set canvas dimensions BEFORE transferring to OffscreenCanvas
              const dpr2 = window.devicePixelRatio || 1;
              canvas.width = width * dpr2;
              canvas.height = height * dpr2;

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
                  vizType: "constellation",
                  width,
                  height,
                  dpr: dpr2,
                },
                [offscreen],
              );
            }
          } else {
            // Notify worker about size changes
            const dpr2 = window.devicePixelRatio || 1;
            workerRef.current.postMessage({
              type: "resize",
              width,
              height,
              dpr: dpr2,
            });
          }

          if (transferredRef.current) {
            workerRef.current.postMessage({
              type: "render",
              data: { samples, transform },
            });
            return; // Important: don't attempt main-thread rendering after transfer
          }
        }
        // If worker couldn't be created or transfer failed, fall through to main-thread render
      }

      // Fallback: render on main thread
      // Never attempt to getContext if the canvas was transferred
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

      // Set up high DPI canvas for crisp rendering
      const dpr3 = window.devicePixelRatio || 1;
      canvas.width = width * dpr3;
      canvas.height = height * dpr3;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr3, dpr3);

      // Apply user interaction transform (pan and zoom)
      ctx.save();
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      // --- original rendering logic (kept minimal here) ---
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, width, height);
      // draw simple points for fallback (keeps UI responsive)
      const margin = DEFAULT_MARGIN;
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;
      const iValues2 = samples.map((s) => s.I);
      const qValues2 = samples.map((s) => s.Q);
      const iMin2 = Math.min(...iValues2, -0.1);
      const iMax2 = Math.max(...iValues2, 0.1);
      const qMin2 = Math.min(...qValues2, -0.1);
      const qMax2 = Math.max(...qValues2, 0.1);
      const iPadding = (iMax2 - iMin2) * 0.1;
      const qPadding = (qMax2 - qMin2) * 0.1;
      const scaleI = (i: number): number =>
        margin.left +
        ((i - (iMin2 - iPadding)) / (iMax2 - iMin2 + 2 * iPadding)) *
          chartWidth;
      const scaleQ = (q: number): number =>
        margin.top +
        chartHeight -
        ((q - (qMin2 - qPadding)) / (qMax2 - qMin2 + 2 * qPadding)) *
          chartHeight;

      ctx.fillStyle = "rgba(100,200,255,0.6)";
      for (const s of samples) {
        const x = scaleI(s.I);
        const y = scaleQ(s.Q);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Restore context state after transform
      ctx.restore();

      renderTierManager.reportSuccess(RenderTier.Canvas2D);
      performanceMonitor.measure("render-iq-constellation", markStart);
    };
    // Kick off async rendering
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
    // Capture ref value to satisfy exhaustive-deps
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
        if (st.gl && st.colorVBO) {
          st.gl.deleteBuffer(st.colorVBO);
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
        tabIndex={0}
        {...handlers}
        onDoubleClick={(): void => resetTransform()}
      />
    </div>
  );
}
