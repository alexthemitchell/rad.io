# WebGPU Rendering Architecture

## Overview

rad.io uses a modern multi-tier rendering architecture that provides optimal performance across all browsers while maintaining a consistent visualization interface.

## Rendering Tiers

The visualization system uses a progressive enhancement approach with four rendering tiers:

### 1. WebGPU (Primary - Modern Browsers)

**Browsers**: Chrome 113+, Edge 113+

**Advantages**:

- Modern GPU API with explicit resource management
- Lower CPU overhead compared to WebGL
- Better compute shader support for future DSP offloading
- Improved memory management

**Implementation**:

- `WebGPUPointRenderer` for IQ Constellation scatter plots
- `WebGPULineRenderer` for Waveform line plots
- `WebGPUTextureRenderer` for Spectrogram heatmaps

### 2. WebGL (Secondary - Wide Support)

**Browsers**: All modern browsers, IE11+

**Advantages**:

- Mature API with broad browser support
- Hardware-accelerated rendering
- Proven performance characteristics

**Implementation**:

- Current production rendering path
- Comprehensive shader support
- Buffer and texture management

### 3. OffscreenCanvas + Worker (Tertiary)

**Browsers**: Chrome 69+, Edge 79+, Firefox 44+

**Advantages**:

- Offloads rendering to background thread
- Keeps main thread responsive
- Good for CPU-bound rendering

### 4. Canvas 2D (Fallback)

**Browsers**: Universal support

**Advantages**:

- Works everywhere
- Simple API
- No special requirements

## Standard Visualization Interface

All renderers implement the `IVisualizationRenderer` interface (`src/types/visualization.ts`):

```typescript
interface IVisualizationRenderer {
  initialize(canvas: HTMLCanvasElement): Promise<boolean>;
  render(data: unknown): boolean;
  cleanup(): void;
  isReady(): boolean;
  getName(): string;
}
```

### Data Types

- **PointData**: Scatter plot data with positions, colors, and point size
- **LineData**: Line plot data with positions, color, and line width
- **TextureData**: Heatmap data with RGBA texture, width, and height

## WebGPU Implementation Details

### Shaders (WGSL)

**Points** (IQ Constellation):

```wgsl
// Vertex shader with position and color attributes
// Point primitive topology with per-vertex coloring
// Alpha blending for density visualization
```

**Lines** (Waveform):

```wgsl
// Vertex shader with position attribute
// Fragment shader with uniform color
// Line-strip topology for connected samples
```

**Texture** (Spectrogram):

```wgsl
// Fullscreen quad vertex shader
// Fragment shader with texture sampling
// Viridis colormap applied to power values
```

### Resource Management

```typescript
// Create once, update multiple times
const renderer = new WebGPUPointRenderer();
await renderer.initialize(canvas);

// Each frame
renderer.render({
  positions: new Float32Array([...]),
  colors: new Float32Array([...]),
});

// Cleanup on unmount
renderer.cleanup();
```

### Buffer Strategy

- Create buffers with initial size
- Reuse when data size unchanged
- Recreate only when size increases
- Explicit cleanup on component unmount

### Texture Strategy

- Create texture matching frame/bin dimensions
- Update data with `writeTexture()` each frame
- Cache texture when dimensions unchanged
- NEAREST filtering for sharp pixels

## Viridis Colormap

**Implementation**: 256-color perceptually uniform lookup table

**Key Colors**:

- Dark purple (68, 1, 84) → Low power
- Blue → Cyan-green → Yellow-green (121, 209, 81) → High power

**Usage**: Maps normalized power values [0, 1] to RGBA colors

**Benefits**:

- Perceptually uniform color transitions
- Colorblind-friendly
- Excellent for scientific visualization

## Performance Characteristics

### WebGPU

- **Best for**: High sample counts, complex visualizations
- **CPU overhead**: Minimal - explicit command encoding
- **GPU utilization**: Excellent - modern pipeline
- **Memory**: Efficient buffer reuse

### WebGL

- **Best for**: Mid-range sample counts, broad compatibility
- **CPU overhead**: Low - driver-managed state
- **GPU utilization**: Good - mature driver optimization
- **Memory**: Good with manual management

### Canvas 2D

- **Best for**: Low sample counts, simple visualizations
- **CPU overhead**: Variable - depends on browser
- **GPU utilization**: None - CPU rasterization
- **Memory**: Minimal overhead

## Browser Support Matrix

| Renderer  | Chrome | Edge | Firefox | Safari |
| --------- | ------ | ---- | ------- | ------ |
| WebGPU    | 113+   | 113+ | 🚧 Flag | 🚧 TP  |
| WebGL     | ✅     | ✅   | ✅      | ✅     |
| Offscreen | 69+    | 79+  | 44+     | ❌     |
| Canvas 2D | ✅     | ✅   | ✅      | ✅     |

Legend: ✅ Supported, 🚧 Experimental, ❌ Not supported, TP = Technology Preview

## Testing

### Unit Tests

**Location**: `src/utils/__tests__/webgpu.test.ts`

**Coverage**:

- WebGPU availability detection
- Viridis LUT validation (color accuracy, endpoints)
- All three renderers (initialization, rendering, cleanup)
- Error handling and fallback scenarios

**Results**: 23 tests, 93% code coverage

### Integration Tests

**Location**: `src/components/__tests__/Accessibility.test.tsx`

**Coverage**:

- Component rendering with WebGPU
- Fallback to WebGL/Canvas when WebGPU unavailable
- Canvas dimension handling
- Accessibility attributes

**Results**: 21 tests, all passing

## Code Organization

```
src/
├── types/
│   └── visualization.ts         # Standard interface definitions
├── utils/
│   ├── webgpu.ts               # WebGPU renderers and utilities
│   ├── webgl.ts                # WebGL utilities (existing)
│   └── __tests__/
│       └── webgpu.test.ts      # WebGPU unit tests
└── components/
    ├── IQConstellation.tsx     # WebGPU → WebGL → 2D fallback
    ├── WaveformVisualizer.tsx  # WebGPU → WebGL → 2D fallback
    └── Spectrogram.tsx         # WebGPU → WebGL → 2D fallback
```

## Future Enhancements

### Short Term

- [ ] Performance benchmarking across rendering tiers
- [ ] Visual comparison screenshots
- [ ] WebGPU compute shaders for FFT acceleration

### Long Term

- [ ] DSP pipeline offloading to GPU compute
- [ ] Multi-buffer streaming for zero-copy rendering
- [ ] Ray-traced waterfall display for 3D visualization

## References

- **WebGPU Spec**: https://www.w3.org/TR/webgpu/
- **WGSL Spec**: https://www.w3.org/TR/WGSL/
- **MDN WebGPU**: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- **Viridis Colormap**: https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html

## Contributing

When adding new visualization features:

1. Implement using the `IVisualizationRenderer` interface
2. Add WebGPU renderer first for best performance
3. Ensure WebGL fallback works
4. Test with Canvas 2D fallback
5. Add comprehensive unit tests
6. Document any new shader techniques

See `src/types/visualization.ts` for the interface contract.
