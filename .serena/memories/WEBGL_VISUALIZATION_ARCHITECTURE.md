# WebGL Visualization Architecture

## Overview
All primary visualization components (IQConstellation, WaveformVisualizer, Spectrogram) now use WebGL for high-performance rendering with graceful fallback chain:
1. **WebGL** (primary) - GPU-accelerated rendering
2. **OffscreenCanvas + Worker** (secondary) - Offscreen 2D rendering in web worker
3. **2D Canvas** (tertiary) - Main thread fallback

## Shared WebGL Utilities (`src/utils/webgl.ts`)

### Context Creation
```typescript
getGL(canvas) → {gl, isWebGL2}
```
- Prefers WebGL2, falls back to WebGL1
- Options: `{alpha: false, antialias: false, desynchronized: true}` for performance

### Shader Management
- `createShader(gl, type, source)` - Compiles GLSL with error handling
- `createProgram(gl, vsSource, fsSource)` - Links shader program
- Built-in shaders: `FULLSCREEN_VS`, `TEXTURE_FS` for textured quads

### Texture Operations
- `createTextureRGBA(gl, w, h, data)` - Creates RGBA texture (NEAREST, CLAMP_TO_EDGE)
- `updateTextureRGBA(gl, tex, w, h, data)` - Updates existing texture
- Viridis colormap: `viridisLUT256()` generates 256-point perceptually uniform LUT

### Colormap Design
- **Viridis**: 9 key stops → 256-point LUT via linear interpolation
- Mapping: `viridisMapScalarToRGBA(t)` converts [0,1] → RGBA
- Used for: Spectrograms (power → color)

## Component-Specific Patterns

### IQConstellation (Scatter Plot)
- **WebGL Rendering**: `gl.POINTS` with `gl_PointSize` from DPR
- **Density-Based Alpha**: CPU grid binning (cell size 0.003) → alpha (0.4-1.0) for overlapping points
- **Shaders**:
  - Vertex: Maps I/Q to NDC [-1,1] with padding based on min/max values
  - Fragment: Discards pixels outside circle radius for point sprites
- **Blending**: Enabled with `SRC_ALPHA`, `ONE_MINUS_SRC_ALPHA`
- **Color**: rgba(80, 200, 255, density-based-alpha)

### WaveformVisualizer (Time-Domain Line Plot)
- **WebGL Rendering**: `gl.LINE_STRIP` with `lineWidth=2.0`
- **Adaptive Scaling**: Calculates amplitude range with 10% padding
- **NDC Mapping**: x from -1 to 1 across samples, y from -1 to 1 across amplitude range
- **Shaders**:
  - Vertex: Position-only transformation
  - Fragment: rgba(100, 220, 255, 0.9)

### Spectrogram (Time-Frequency Heatmap)
- **WebGL Rendering**: Fullscreen textured quad with `gl.TRIANGLE_STRIP`
- **Texture Layout**: width = frames, height = bins (freqMax - freqMin)
- **Dynamic Range**: 5% threshold compression (effMin = min + range * 0.05)
- **Viridis Mapping**: Normalize power → index into 256-color LUT → RGBA texture
- **Texture Caching**: Create once, update only if size changes
- **Shaders**:
  - Vertex: Fullscreen quad positions + UVs
  - Fragment: Samples texture with viridis-mapped colors

## Critical Implementation Patterns

### Synchronous Canvas Sizing (TEST COMPATIBILITY)
```typescript
// BEFORE async import - enables immediate test access
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

// THEN async import
const webgl = await import("../utils/webgl");
```

### Async Import Pattern (Bundle Optimization)
```typescript
useEffect(() => {
  const run = async () => {
    const webgl = await import("../utils/webgl");
    // ... WebGL code
  };
  void run(); // Invoke immediately
}, [deps]);
```

### Resource Lifecycle
```typescript
// State ref for GL resources
const glStateRef = useRef({
  gl: null,
  program: null,
  vbo: null,
  // ... other resources
});

// Create once on first render
if (!glStateRef.current.program) {
  glStateRef.current.program = webgl.createProgram(...);
  // ... create buffers
}

// Update data each frame
gl.bufferData(gl.ARRAY_BUFFER, newData, gl.DYNAMIC_DRAW);

// Cleanup on unmount
useEffect(() => {
  const st = glStateRef.current; // Capture before return
  return () => {
    if (st.gl && st.program) st.gl.deleteProgram(st.program);
    if (st.gl && st.vbo) st.gl.deleteBuffer(st.vbo);
    // ... cleanup other resources
  };
}, []); // Empty deps - cleanup once on unmount
```

### DPR (Device Pixel Ratio) Handling
- Declare once at useEffect scope
- Reuse in all code paths (WebGL, worker, 2D) - avoid shadowing
- WebGL: `gl_PointSize = pointSize * dpr` for crisp points
- Canvas: Scale context after setting dimensions

### Fallback Chain Implementation
```typescript
try {
  const webgl = await import("../utils/webgl");
  // ... WebGL rendering
  if (success) return;
} catch (err) {
  console.warn("WebGL failed, falling back", err);
}

// Try OffscreenCanvas + Worker
if (typeof OffscreenCanvas === "function") {
  // ... worker rendering
  if (transferredRef.current) return;
}

// Final fallback: 2D canvas on main thread
const ctx = canvas.getContext("2d");
// ... 2D rendering
```

## Performance Considerations

### GPU Acceleration Hints
- Canvas context: `{desynchronized: true}` for async GPU transfer
- Texture filtering: `NEAREST` for sharp pixels in spectrograms
- Blending: Only enable when needed (IQConstellation density)

### Memory Management
- Texture caching: Avoid recreating textures on same size
- Buffer reuse: Create VBOs once, update data with `bufferData`
- Cleanup: Always delete GL resources on unmount

### Test Compatibility
- Synchronous canvas sizing enables Jest to read dimensions immediately
- Mock WebGL in jest.setup.ts for test environment
- Tests validate DPR scaling: `expect(canvas.width).toBe(width * dpr)`

## RF Visualization Best Practices (from IITM Research)

### Power Spectral Density (PSD)
- Display in dB: `20 * log10(magnitude)`
- Dynamic range compression: 5% threshold to enhance weak signals
- Center frequency at midpoint of frequency axis

### Spectrograms (STFT)
- Viridis colormap for perceptually uniform power representation
- Windowing: Applied in `dsp.ts` DFT implementation
- Time on X-axis, frequency on Y-axis (bins inverted for display)

### IQ Constellations
- Density-based rendering: Alpha based on point overlap
- Equal axis scaling to preserve phase relationships
- Grid binning for efficient density calculation

## Lessons Learned

### File Corruption Avoidance
- **apply_patch** can corrupt files with complex async transformations
- **Alternative**: Use Serena `replace_symbol_body` or `create_file` + rename
- Always capture ref values before cleanup return function for exhaustive-deps

### Synchronous Canvas Sizing Requirement
- Tests read canvas dimensions synchronously
- Async import delays WebGL code but canvas must be sized first
- Pattern: Size canvas → async import → render

### DPR Variable Scoping
- Declare once at outer scope
- Do not redeclare in fallback branches (causes shadowing/lint errors)
- Reuse same variable across WebGL, worker, 2D paths

## Status
- ✅ IQConstellation: WebGL gl.POINTS with density alpha
- ✅ WaveformVisualizer: WebGL gl.LINE_STRIP
- ✅ Spectrogram: WebGL texture-based STFT with viridis LUT
- ✅ All 26 visualization tests passing
- ✅ Build successful (npm run build)
- ✅ Lint clean, type-check passing

## References
- MDN WebGL API: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API
- IITM RF Visualization: https://varun19299.github.io/ID4100-Wireless-Lab-IITM/posts/11-visualising-rf-spectrum/
- Viridis Colormap: https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html
- Implementation: `src/utils/webgl.ts`, `src/components/IQConstellation.tsx`, `src/components/WaveformVisualizer.tsx`, `src/components/Spectrogram.tsx`
