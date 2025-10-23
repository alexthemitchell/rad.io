import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useIntersectionObserver } from "../hooks/useIntersectionObserver";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useVisualizationInteraction } from "../hooks/useVisualizationInteraction";
import { performanceMonitor } from "../utils/performanceMonitor";
import type { ReactElement } from "react";

type SpectrogramProps = {
  fftData: Float32Array[];
  width?: number;
  height?: number;
  freqMin?: number;
  freqMax?: number;
  /**
   * When true, rendering continues even when the tab is hidden or element is off-screen.
   * Defaults to false for power efficiency.
   */
  continueInBackground?: boolean;
  /**
   * Display mode: "spectrogram" shows all frames statically, "waterfall" scrolls new data from top
   * Defaults to "spectrogram" for backward compatibility.
   */
  mode?: "spectrogram" | "waterfall";
  /**
   * Maximum number of frames to show in waterfall mode. Older frames are discarded.
   * Only used when mode is "waterfall". Defaults to 100.
   */
  maxWaterfallFrames?: number;
};

export default function Spectrogram({
  fftData,
  width = 750,
  height = 800,
  freqMin = 1000,
  freqMax = 1100,
  continueInBackground = false,
  mode = "spectrogram",
  maxWaterfallFrames = 100,
}: SpectrogramProps): ReactElement {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const transferredRef = useRef<boolean>(false);

  // Waterfall mode: maintain a rolling buffer of frames using state
  const [waterfallBuffer, setWaterfallBuffer] = useState<Float32Array[]>([]);

  // Visibility optimization hooks
  const isPageVisible = usePageVisibility();
  const isElementVisible = useIntersectionObserver(internalCanvasRef, {
    threshold: 0.1,
  });

  // WebGL resources
  const glStateRef = useRef<{
    gl: import("../utils/webgl").GL | null;
    isWebGL2: boolean;
    program: WebGLProgram | null;
    quadVBO: WebGLBuffer | null;
    uvVBO: WebGLBuffer | null;
    texture: WebGLTexture | null;
    lastTexSize: { w: number; h: number } | null;
  }>({
    gl: null,
    isWebGL2: false,
    program: null,
    quadVBO: null,
    uvVBO: null,
    texture: null,
    lastTexSize: null,
  });

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

  // Update the waterfall buffer when fftData, mode, or maxWaterfallFrames change
  useEffect(() => {
    if (mode === "waterfall") {
      // Append new frames to buffer
      setWaterfallBuffer((prevBuffer) => {
        const newBuffer = [...prevBuffer, ...fftData];
        // Keep only the most recent maxWaterfallFrames
        return newBuffer.slice(-maxWaterfallFrames);
      });
    } else {
      // Reset buffer when not in waterfall mode
      setWaterfallBuffer([]);
    }
  }, [fftData, mode, maxWaterfallFrames]);

  // Compute display data based on mode (pure, no side effects)
  const displayData = useMemo((): Float32Array[] => {
    if (mode === "waterfall") {
      return waterfallBuffer;
    }
    // Static spectrogram mode: show all data as-is
    return fftData;
  }, [waterfallBuffer, fftData, mode]);

  // Generate accessible text description of the spectrogram data
  const accessibleDescription = useMemo((): string => {
    if (displayData.length === 0) {
      return "No spectrogram data";
    }

    const numFrames = displayData.length;
    const binCount = freqMax - freqMin;
    const modeDescription =
      mode === "waterfall" ? "Waterfall display" : "Spectrogram";

    // Find peak power and its frequency
    let maxPower = -Infinity;
    let maxPowerBin = 0;
    displayData.forEach((row) => {
      for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
        const value = row[bin]!;
        if (isFinite(value) && value > maxPower) {
          maxPower = value;
          maxPowerBin = bin;
        }
      }
    });

    return `${modeDescription} showing ${numFrames} time frames across ${binCount} frequency bins (${freqMin} to ${freqMax}). Peak power of ${maxPower.toFixed(2)} dB detected at frequency bin ${maxPowerBin}. Colors represent signal strength from low (dark) to high (bright).`;
  }, [displayData, freqMin, freqMax, mode]);

  useEffect((): void => {
    const canvas = internalCanvasRef.current;
    if (!canvas || displayData.length === 0) {
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
      const markStart = "render-spectrogram-start";
      performanceMonitor.mark(markStart);

      // Try WebGPU first (modern browsers)
      try {
        const webgpu = await import("../utils/webgpu");
        if (webgpu.isWebGPUSupported()) {
          const pixelW = Math.max(1, Math.floor(width * dpr));
          const pixelH = Math.max(1, Math.floor(height * dpr));
          canvas.width = pixelW;
          canvas.height = pixelH;

          const renderer = new webgpu.WebGPUTextureRenderer();
          const initialized = await renderer.initialize(canvas);
          
          if (initialized) {
            const bins = Math.max(
              1,
              Math.min(displayData[0]?.length || 0, freqMax - freqMin),
            );
            const frames = displayData.length;

            // Compute dynamic range
            let gmin = Infinity;
            let gmax = -Infinity;
            for (const row of displayData) {
              for (let b = freqMin; b < freqMax && b < row.length; b++) {
                const v = row[b]!;
                if (isFinite(v)) {
                  if (v < gmin) {
                    gmin = v;
                  }
                  if (v > gmax) {
                    gmax = v;
                  }
                }
              }
            }
            if (!isFinite(gmin)) {
              gmin = 0;
            }
            if (!isFinite(gmax)) {
              gmax = 1;
            }

            // Adaptive dynamic range compression
            const allPowers: number[] = [];
            for (const row of displayData) {
              for (let b = freqMin; b < freqMax && b < row.length; b++) {
                const v = row[b]!;
                if (isFinite(v)) {
                  allPowers.push(v);
                }
              }
            }

            let adaptiveThreshold = 0.05;
            if (allPowers.length > 0) {
              allPowers.sort((a, b) => a - b);
              const p10 = allPowers[Math.floor(allPowers.length * 0.1)]!;
              const dataSpread = (p10 - gmin) / Math.max(1e-9, gmax - gmin);
              adaptiveThreshold = Math.max(0.05, Math.min(0.2, dataSpread));
            }

            const effMin = gmin + (gmax - gmin) * adaptiveThreshold;
            const range = Math.max(1e-9, gmax - effMin);

            // Build RGBA texture data
            const texW = Math.max(1, frames);
            const texH = Math.max(1, bins);
            const lut = webgpu.getViridisLUT();
            const rgba = new Uint8Array(texW * texH * 4);
            for (let x = 0; x < texW; x++) {
              const row = displayData[x]!;
              for (let y = 0; y < texH; y++) {
                const bin = freqMin + y;
                const v = row && bin < row.length ? row[bin]! : 0;
                const norm = Math.max(0, Math.min(1, (v - effMin) / range));
                const idx = (norm * 255) | 0;
                const base = (x + y * texW) * 4;
                const lbase = idx << 2;
                rgba[base + 0] = lut[lbase] ?? 0;
                rgba[base + 1] = lut[lbase + 1] ?? 0;
                rgba[base + 2] = lut[lbase + 2] ?? 0;
                rgba[base + 3] = 255;
              }
            }

            const success = renderer.render({
              data: rgba,
              width: texW,
              height: texH,
            });

            if (success) {
              performanceMonitor.measure("render-spectrogram", markStart);
              return;
            }
          }
        }
      } catch (err) {
        console.warn(
          "[Spectrogram] WebGPU path failed, falling back to WebGL:",
          err,
        );
      }

      // Try WebGL next for high-performance rendering
      try {
        const webgl = await import("../utils/webgl");
        const pixelW = Math.max(1, Math.floor(width * dpr));
        const pixelH = Math.max(1, Math.floor(height * dpr));
        canvas.width = pixelW;
        canvas.height = pixelH;

        let { gl, isWebGL2 } = glStateRef.current;
        if (!gl) {
          const got = webgl.getGL(canvas);
          gl = got.gl;
          isWebGL2 = got.isWebGL2;
          glStateRef.current.gl = gl;
          glStateRef.current.isWebGL2 = isWebGL2;
        }

        if (gl) {
          const bins = Math.max(
            1,
            Math.min(displayData[0]?.length || 0, freqMax - freqMin),
          );
          const frames = displayData.length;

          // Compute dynamic range
          let gmin = Infinity;
          let gmax = -Infinity;
          for (const row of displayData) {
            for (let b = freqMin; b < freqMax && b < row.length; b++) {
              const v = row[b]!;
              if (isFinite(v)) {
                if (v < gmin) {
                  gmin = v;
                }
                if (v > gmax) {
                  gmax = v;
                }
              }
            }
          }
          if (!isFinite(gmin)) {
            gmin = 0;
          }
          if (!isFinite(gmax)) {
            gmax = 1;
          }

          // Adaptive dynamic range compression threshold
          // Instead of fixed 5%, use percentile-based threshold for better weak signal visibility
          // Collect all finite power values
          const allPowers: number[] = [];
          for (const row of displayData) {
            for (let b = freqMin; b < freqMax && b < row.length; b++) {
              const v = row[b]!;
              if (isFinite(v)) {
                allPowers.push(v);
              }
            }
          }

          // Calculate adaptive threshold based on 10th percentile
          // This adapts to signal strength: strong signals compress more, weak signals less
          let adaptiveThreshold = 0.05; // Default 5% fallback
          if (allPowers.length > 0) {
            allPowers.sort((a, b) => a - b);
            const p10 = allPowers[Math.floor(allPowers.length * 0.1)]!;
            // Normalize threshold based on data distribution
            const dataSpread = (p10 - gmin) / Math.max(1e-9, gmax - gmin);
            // Clamp between 5% and 20% for stability
            adaptiveThreshold = Math.max(0.05, Math.min(0.2, dataSpread));
          }

          const effMin = gmin + (gmax - gmin) * adaptiveThreshold;
          const range = Math.max(1e-9, gmax - effMin);

          // Build RGBA texture data: width = frames, height = bins
          const texW = Math.max(1, frames);
          const texH = Math.max(1, bins);
          const lut = webgl.viridisLUT256();
          const rgba = new Uint8Array(texW * texH * 4);
          for (let x = 0; x < texW; x++) {
            const row = displayData[x]!;
            for (let y = 0; y < texH; y++) {
              const bin = freqMin + y;
              const v = row && bin < row.length ? row[bin]! : 0;
              const norm = Math.max(0, Math.min(1, (v - effMin) / range));
              const idx = (norm * 255) | 0;
              const base = (x + y * texW) * 4;
              const lbase = idx << 2;
              rgba[base + 0] = lut[lbase] ?? 0;
              rgba[base + 1] = lut[lbase + 1] ?? 0;
              rgba[base + 2] = lut[lbase + 2] ?? 0;
              rgba[base + 3] = 255;
            }
          }

          // Init GL resources once
          if (!glStateRef.current.program) {
            const prog = webgl.createProgram(
              gl,
              webgl.FULLSCREEN_VS,
              webgl.TEXTURE_FS,
            );
            glStateRef.current.program = prog;
            const quad = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, quad);
            gl.bufferData(gl.ARRAY_BUFFER, webgl.QUAD_VERTICES, gl.STATIC_DRAW);
            glStateRef.current.quadVBO = quad;
            const uv = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, uv);
            gl.bufferData(gl.ARRAY_BUFFER, webgl.TEX_COORDS, gl.STATIC_DRAW);
            glStateRef.current.uvVBO = uv;
          }

          // Create or update texture
          const lastSize = glStateRef.current.lastTexSize;
          if (
            !glStateRef.current.texture ||
            !lastSize ||
            lastSize.w !== texW ||
            lastSize.h !== texH
          ) {
            if (glStateRef.current.texture) {
              gl.deleteTexture(glStateRef.current.texture);
            }
            const tex = webgl.createTextureRGBA(gl, texW, texH, rgba);
            glStateRef.current.texture = tex;
            glStateRef.current.lastTexSize = { w: texW, h: texH };
          } else {
            webgl.updateTextureRGBA(
              gl,
              glStateRef.current.texture,
              texW,
              texH,
              rgba,
            );
          }

          // Draw fullscreen textured quad
          gl.viewport(0, 0, pixelW, pixelH);
          gl.disable(gl.DEPTH_TEST);
          gl.disable(gl.BLEND);
          gl.clearColor(0.04, 0.06, 0.1, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          const prog = glStateRef.current.program;
          gl.useProgram(prog);
          const aPos = gl.getAttribLocation(prog, "a_position");
          const aUV = gl.getAttribLocation(prog, "a_texCoord");
          const uTex = gl.getUniformLocation(prog, "u_texture");

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, glStateRef.current.texture);
          gl.uniform1i(uTex, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, glStateRef.current.quadVBO);
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, glStateRef.current.uvVBO);
          gl.enableVertexAttribArray(aUV);
          gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          performanceMonitor.measure("render-spectrogram", markStart);
          return;
        }
      } catch (err) {
        console.warn("[Spectrogram] WebGL path failed, falling back:", err);
      }

      const supportsOffscreen =
        typeof OffscreenCanvas === "function" && typeof Worker !== "undefined";
      if (supportsOffscreen) {
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
            const w = workerRef.current;
            if (w) {
              w.onmessage = (ev): void => {
                const d = ev.data as unknown as {
                  type?: string;
                  viz?: string;
                  renderTimeMs?: number;
                };
                if (d?.type === "metrics") {
                  console.warn(
                    `[viz worker] ${d.viz} render ${d.renderTimeMs?.toFixed(2)}ms`,
                  );
                }
              };
            }
          } catch (e) {
            console.error("Could not create visualization worker", e);
            workerRef.current = null;
          }
        }

        if (workerRef.current) {
          if (!transferredRef.current) {
            const canTransfer =
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
              workerRef.current.postMessage(
                {
                  type: "init",
                  canvas: offscreen,
                  vizType: "spectrogram",
                  width,
                  height,
                  dpr,
                  freqMin,
                  freqMax,
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
              data: { fftData: displayData, freqMin, freqMax, transform },
            });
            return;
          }
        }
      }

      // Fallback: original rendering on main thread
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

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      ctx.save();
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);

      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, width, height);

      const margin = { top: 70, bottom: 70, left: 80, right: 120 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      const numFrames = displayData.length;
      const frameWidth = Math.max(1, chartWidth / numFrames);
      const binHeight = chartHeight / (freqMax - freqMin);

      let globalMin = Infinity;
      let globalMax = -Infinity;

      displayData.forEach((row) => {
        for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
          const value = row[bin]!;
          if (isFinite(value)) {
            globalMin = Math.min(globalMin, value);
            globalMax = Math.max(globalMax, value);
          }
        }
      });

      const range = globalMax - globalMin;
      const effectiveMin = globalMin + range * 0.05;
      const effectiveMax = globalMax;

      displayData.forEach((row, frameIdx) => {
        const x = margin.left + frameIdx * frameWidth;

        for (let bin = freqMin; bin < freqMax && bin < row.length; bin++) {
          const value = row[bin]!;
          if (!isFinite(value)) {
            continue;
          }

          const normalized =
            (value - effectiveMin) / (effectiveMax - effectiveMin);

          const t = Math.max(0, Math.min(1, normalized));
          const r = Math.round(68 + 185 * t);
          const g = Math.round(1 + 220 * t);
          const b = Math.round(84 - 50 * t);

          const y = margin.top + chartHeight - (bin - freqMin) * binHeight;
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, y - binHeight, frameWidth + 0.5, binHeight + 0.5);
        }
      });

      ctx.restore();

      performanceMonitor.measure("render-spectrogram", markStart);
    };

    void run();
  }, [
    displayData,
    width,
    height,
    freqMin,
    freqMax,
    transform,
    isPageVisible,
    isElementVisible,
    continueInBackground,
  ]);

  // Cleanup worker and GL on unmount
  useEffect((): (() => void) => {
    const st = glStateRef.current;
    return () => {
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

      // GL cleanup
      try {
        if (st.gl && st.texture) {
          st.gl.deleteTexture(st.texture);
        }
        if (st.gl && st.quadVBO) {
          st.gl.deleteBuffer(st.quadVBO);
        }
        if (st.gl && st.uvVBO) {
          st.gl.deleteBuffer(st.uvVBO);
        }
        if (st.gl && st.program) {
          st.gl.deleteProgram(st.program);
        }
      } catch {
        // ignore cleanup errors
      }
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
