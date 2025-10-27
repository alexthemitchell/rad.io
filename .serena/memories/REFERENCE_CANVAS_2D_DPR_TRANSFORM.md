Purpose: Prevent cumulative scaling and blurry or shrinking visuals when drawing to Canvas 2D at device pixel ratios.

Key rule (invariant)

- Always reset the 2D context transform each frame before applying devicePixelRatio scaling. Use:
  - ctx.setTransform(1, 0, 0, 1, 0, 0) then ctx.scale(dpr, dpr)
- Do this immediately after setting canvas.width/height and style.width/height.

Why

- Canvas 2D context state persists between frames. Calling ctx.scale(dpr, dpr) without resetting accumulates the transform, leading to visuals that appear to shrink/grow each frame and severe performance degradation due to out-of-bounds rasterization.

Recommended pattern

- Use alpha:false and desynchronized:true for perf.
- Set internal pixel size: canvas.width = width * dpr; height likewise.
- Set CSS size: canvas.style.width = `${width}px` ; height likewise.
- Reset transform to identity, then apply dpr scale each render.
- For additional per-frame transforms (pan/zoom), wrap in ctx.save() / ctx.restore() so only those transforms are reverted, not DPR.

References in repo

- Spectrogram Canvas2D fallback: `src/visualization/components/Spectrogram.tsx` (ensures setTransform before ctx.scale for DPR)
- Spectrum line renderer: `src/visualization/components/SpectrumExplorer.tsx` (uses ctx.setTransform followed by scale)

Related tips

- Prefer WebGL/WebGPU for heavy heatmap rendering; keep a Canvas2D fallback.
- If you see visuals getting smaller or FPS collapsing, inspect for missing ctx.setTransform() before DPR scaling.
