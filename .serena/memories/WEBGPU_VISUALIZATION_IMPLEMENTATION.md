# WebGPU Visualization Implementation

## Overview

WebGPU rendering infrastructure added to rad.io as the next-generation visualization backend, providing improved performance and modern GPU access compared to WebGL.

## Standard Visualization Interface

**Location**: `src/types/visualization.ts`

All renderers (WebGPU, WebGL, 2D Canvas) must implement `IVisualizationRenderer`:

```typescript
interface IVisualizationRenderer {
  initialize(canvas: HTMLCanvasElement): Promise<boolean>;
  render(data: unknown): boolean;
  cleanup(): void;
  isReady(): boolean;
  getName(): string;
}
```

**Data Types**:

- `PointData` - Scatter plot data (positions, colors, pointSize)
- `LineData` - Line plot data (positions, color, lineWidth)
- `TextureData` - Heatmap data (RGBA data, width, height)
- `RendererConfig` - Configuration (width, height, DPR)

## WebGPU Utilities

**Location**: `src/utils/webgpu.ts`

### Core Functions

- `isWebGPUSupported()` - Check browser support
- `initWebGPU(canvas)` - Initialize device and context
- `createBuffer()` / `updateBuffer()` - GPU buffer management
- `createTexture()` / `updateTexture()` - Texture management
- `getViridisLUT()` - 256-color perceptually uniform colormap

### WGSL Shaders

**Points** - Vertex/fragment shaders for scatter plots
**Lines** - Vertex shader + uniform color fragment shader
**Texture** - Fullscreen quad with sampled texture

### Renderer Classes

**WebGPUPointRenderer** - IQ Constellation scatter plots

- Point primitive topology
- Per-point color via vertex attribute
- Alpha blending for density visualization

**WebGPULineRenderer** - Waveform line plots

- Line-strip topology
- Uniform color binding
- Vertex-only data

**WebGPUTextureRenderer** - Spectrogram heatmaps

- Fullscreen quad (4 vertices, triangle-strip)
- Texture sampler with nearest filtering
- Dynamic texture updates

## Critical Implementation Details

### Type Safety

WebGPU types require explicit casting for enums:

```typescript
format: "float32x2" as GPUVertexFormat;
loadOp: "clear" as GPULoadOp;
```

Arrays must be explicitly typed:

```typescript
buffers: [...] as GPUVertexBufferLayout[]
```

Buffer data requires GPUAllowSharedBufferSource cast:

```typescript
device.queue.writeBuffer(buffer, 0, data as GPUAllowSharedBufferSource);
```

### WebGPU Context

Must use `canvas.getContext("webgpu")` not `"2d"` or `"webgl"`.

Context configuration:

```typescript
context.configure({
  device,
  format: navigator.gpu.getPreferredCanvasFormat(),
  alphaMode: "opaque",
});
```

### Buffer Creation Pattern

1. Create with `mappedAtCreation: true`
2. Write data to mapped range
3. Unmap before use
4. Update later with `writeBuffer()`

### Shader Module Pattern

Combine vertex + fragment shaders in single string:

```typescript
code: VERTEX_SHADER + "\n" + FRAGMENT_SHADER;
```

Separate entry points (`entryPoint: "main"`) for each stage.

### Render Pass Pattern

```typescript
const encoder = device.createCommandEncoder();
const view = context.getCurrentTexture().createView();
const pass = encoder.beginRenderPass({
  colorAttachments: [...]
});
pass.setPipeline(pipeline);
pass.setVertexBuffer(0, buffer);
pass.draw(count);
pass.end();
device.queue.submit([encoder.finish()]);
```

## Viridis Colormap

9 key colors interpolated to 256-point LUT:

- Dark purple (68,1,84) → Blue → Cyan-green → Yellow-green (121,209,81)
- Perceptually uniform for power spectral density
- Same as IITM research implementation

## Test Coverage

**Location**: `src/utils/__tests__/webgpu.test.ts`

23 tests covering:

- WebGPU availability detection
- Viridis LUT validation (RGBA values, endpoints)
- All three renderers (initialize, render, cleanup, error handling)
- Mock WebGPU API in Jest environment

93% code coverage on webgpu.ts

## Dependencies

**@webgpu/types** (0.1.66): TypeScript definitions for WebGPU API

- Installed as devDependency
- Reference via `/// <reference types="@webgpu/types" />`
- Provides GPUDevice, GPUBuffer, GPUTexture, etc.

**Jest Setup**: Mock GPUBufferUsage, GPUTextureUsage, GPUShaderStage constants

## Browser Support

WebGPU available in:

- Chrome 113+ (May 2023)
- Edge 113+ (May 2023)
- Firefox behind flag (experimental)
- Safari Technology Preview

Graceful fallback required for unsupported browsers.

## Integration Strategy (Pending)

Fallback chain order:

1. **WebGPU** (primary, modern browsers)
2. **WebGL** (current implementation, wide support)
3. **OffscreenCanvas + Worker** (secondary)
4. **2D Canvas** (tertiary, main thread)

Components to update:

- `src/components/IQConstellation.tsx` - Add WebGPU renderer
- `src/components/WaveformVisualizer.tsx` - Add WebGPU renderer
- `src/components/Spectrogram.tsx` - Add WebGPU renderer

## Performance Considerations

**Advantages over WebGL**:

- Modern API design (explicit resource management)
- Better compute shader support
- Improved memory management
- Lower CPU overhead

**Optimization**:

- Reuse buffers when size unchanged
- Batch updates with `writeBuffer()`
- Use async initialization pattern
- Cache textures between frames

## Status

- ✅ Standard interface defined
- ✅ WebGPU utilities implemented
- ✅ Three renderer classes complete
- ✅ Tests passing (23/23)
- ✅ Build successful
- ⏳ Component integration pending
- ⏳ Fallback chain update pending
- ⏳ Documentation update pending

## References

- MDN WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- WebGPU Spec: https://www.w3.org/TR/webgpu/
- WGSL Spec: https://www.w3.org/TR/WGSL/
- Implementation: `src/utils/webgpu.ts`, `src/types/visualization.ts`
