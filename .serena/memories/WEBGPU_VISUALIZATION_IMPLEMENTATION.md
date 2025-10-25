# WebGPU Visualization Implementation — Updates (2025-10-25)

Purpose: Record stable patterns and invariants for WebGPU visualizers to avoid regressions (shader entry points, renderer lifecycle) and to guide future edits.

Key Invariants

- WGSL entry points must be distinct per stage: use `vs_main` (vertex) and `fs_main` (fragment). Do not use `main` for both; it causes shader module redeclaration errors in Chromium. See `src/utils/webgpu.ts` (POINT/LINE/TEXTURE shaders and pipelines).
- Renderer instances are memoized per component and reused across renders. Initialization is attempted once and guarded by a ref (e.g., `_webgpuInitAttemptedRef`). Cleanup must be called on unmount.

Implementation Patterns

- Spectrogram (`src/components/Spectrogram.tsx`): Uses a persistent `WebGPUTextureRenderer` via `webgpuRendererRef`. On first run (and when `isWebGPUSupported()`), initialize with the current canvas; reuse for subsequent frames; call `cleanup()` in the component’s unmount effect. Fallback chain remains: WebGPU → WebGL → OffscreenCanvas worker → 2D canvas.
- IQ Constellation (`src/components/IQConstellation.tsx`) and Waveform (`src/components/WaveformVisualizer.tsx`): Same memoized WebGPU pattern with `WebGPUPointRenderer` and `WebGPULineRenderer`, respectively, plus proper unmount cleanup.

Shader/Pipeline Contract

- Pipelines reference `entryPoint: "vs_main"` for vertex and `entryPoint: "fs_main"` for fragment across all renderers. This is required to prevent WGSL entry conflicts.

Quality Gates (current)

- Lint/Typecheck/Build: PASS
- Jest unit tests: existing speech recognition tests may fail intermittently; unrelated to WebGPU visualization changes. Track in `src/utils/__tests__/speechRecognition.test.ts`.

Useful Paths

- WebGPU utilities and renderers: `src/utils/webgpu.ts`
- Visualization components: `src/components/IQConstellation.tsx`, `src/components/WaveformVisualizer.tsx`, `src/components/Spectrogram.tsx`
- Interface contracts: `src/types/visualization.ts`

Notes

- When resizing canvas, the existing `GPUCanvasContext` updates with the new swap chain size; re-initialization is not required—just reuse the renderer and call `render()` with new RGBA data.
- Prefer optional chaining for readiness checks: `webgpuRendererRef.current?.isReady()`.
