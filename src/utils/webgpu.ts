/**
 * WebGPU utilities for rad.io visualizations
 * - GPU device initialization and management
 * - Shader compilation (WGSL)
 * - Buffer and texture management
 * - Viridis colormap utilities
 */

/// <reference types="@webgpu/types" />

import type {
  IVisualizationRenderer,
  PointData,
  LineData,
  TextureData,
} from "../types/visualization";

/**
 * Check if WebGPU is supported in the current browser
 */
export function isWebGPUSupported(): boolean {
  return "gpu" in navigator;
}

/**
 * Initialize WebGPU device and return device and context
 */
export async function initWebGPU(
  canvas: HTMLCanvasElement,
): Promise<{ device: GPUDevice; context: GPUCanvasContext } | null> {
  if (!isWebGPUSupported()) {
    return null;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.warn("WebGPU: No adapter found");
      return null;
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context) {
      console.warn("WebGPU: Failed to get context");
      return null;
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });

    return { device, context };
  } catch (err) {
    console.warn("WebGPU initialization failed:", err);
    return null;
  }
}

/**
 * Create a GPU buffer with data
 */
export function createBuffer(
  device: GPUDevice,
  data: Float32Array | Uint8Array,
  usage: GPUBufferUsageFlags,
): GPUBuffer {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });

  if (data instanceof Float32Array) {
    new Float32Array(buffer.getMappedRange()).set(data);
  } else {
    new Uint8Array(buffer.getMappedRange()).set(data);
  }
  buffer.unmap();

  return buffer;
}

/**
 * Update an existing GPU buffer with new data
 */
export function updateBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  data: Float32Array | Uint8Array,
): void {
  device.queue.writeBuffer(buffer, 0, data as GPUAllowSharedBufferSource);
}

/**
 * Create a texture for heatmap rendering
 */
export function createTexture(
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat = "rgba8unorm",
): GPUTexture {
  return device.createTexture({
    size: { width, height },
    format,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
}

/**
 * Update texture with new data
 */
export function updateTexture(
  device: GPUDevice,
  texture: GPUTexture,
  data: Uint8Array,
  width: number,
  height: number,
): void {
  device.queue.writeTexture(
    { texture },
    data as GPUAllowSharedBufferSource,
    { bytesPerRow: width * 4 },
    { width, height },
  );
}

/**
 * Viridis colormap - 256 color lookup table
 * Returns RGBA values as Uint8Array (1024 bytes: 256 colors * 4 channels)
 */
export function getViridisLUT(): Uint8Array {
  // 9 key colors from viridis colormap
  const keyColors = [
    [68, 1, 84],
    [72, 35, 116],
    [64, 67, 135],
    [52, 94, 141],
    [41, 120, 142],
    [32, 144, 140],
    [34, 167, 132],
    [68, 190, 112],
    [121, 209, 81],
  ];

  const lut = new Uint8Array(256 * 4);

  for (let i = 0; i < 256; i++) {
    const t = i / 255.0;
    const scaledT = t * (keyColors.length - 1);
    const idx = Math.floor(scaledT);
    const frac = scaledT - idx;

    let r: number, g: number, b: number;

    if (idx >= keyColors.length - 1) {
      const lastColor = keyColors[keyColors.length - 1]!;
      r = lastColor[0]!;
      g = lastColor[1]!;
      b = lastColor[2]!;
    } else {
      const c0 = keyColors[idx]!;
      const c1 = keyColors[idx + 1]!;
      r = c0[0]! + (c1[0]! - c0[0]!) * frac;
      g = c0[1]! + (c1[1]! - c0[1]!) * frac;
      b = c0[2]! + (c1[2]! - c0[2]!) * frac;
    }

    lut[i * 4 + 0] = Math.round(r);
    lut[i * 4 + 1] = Math.round(g);
    lut[i * 4 + 2] = Math.round(b);
    lut[i * 4 + 3] = 255; // alpha
  }

  return lut;
}

/**
 * WGSL Shaders for point rendering (IQ Constellation)
 */
export const POINT_VERTEX_SHADER = `
struct VertexInput {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.color = input.color;
  return output;
}
`;

export const POINT_FRAGMENT_SHADER = `
@fragment
fn main(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}
`;

/**
 * WGSL Shaders for line rendering (Waveform)
 */
export const LINE_VERTEX_SHADER = `
struct VertexInput {
  @location(0) position: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  return output;
}
`;

export const LINE_FRAGMENT_SHADER = `
struct Uniforms {
  color: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main() -> @location(0) vec4f {
  return uniforms.color;
}
`;

/**
 * WGSL Shaders for texture rendering (Spectrogram)
 */
export const TEXTURE_VERTEX_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  
  // Fullscreen quad
  let x = f32((vertexIndex & 1u) << 1u) - 1.0;
  let y = 1.0 - f32((vertexIndex & 2u));
  
  output.position = vec4f(x, y, 0.0, 1.0);
  output.uv = vec2f((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  
  return output;
}
`;

export const TEXTURE_FRAGMENT_SHADER = `
@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var textureData: texture_2d<f32>;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(textureData, textureSampler, uv);
}
`;

/**
 * WebGPU Point Renderer for IQ Constellation
 */
export class WebGPUPointRenderer implements IVisualizationRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private colorBuffer: GPUBuffer | null = null;
  private pointCount = 0;

  getName(): string {
    return "WebGPU Point Renderer";
  }

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    const result = await initWebGPU(canvas);
    if (!result) {
      return false;
    }

    this.device = result.device;
    this.context = result.context;

    // Create render pipeline
    const shaderModule = this.device.createShaderModule({
      code: POINT_VERTEX_SHADER + "\n" + POINT_FRAGMENT_SHADER,
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 8, // 2 floats (x, y)
            attributes: [
              {
                format: "float32x2" as GPUVertexFormat,
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
          {
            arrayStride: 16, // 4 floats (r, g, b, a)
            attributes: [
              {
                format: "float32x4" as GPUVertexFormat,
                offset: 0,
                shaderLocation: 1,
              },
            ],
          },
        ] as GPUVertexBufferLayout[],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "main",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: "src-alpha" as GPUBlendFactor,
                dstFactor: "one-minus-src-alpha" as GPUBlendFactor,
              },
              alpha: {
                srcFactor: "one" as GPUBlendFactor,
                dstFactor: "one-minus-src-alpha" as GPUBlendFactor,
              },
            },
          },
        ] as GPUColorTargetState[],
      },
      primitive: {
        topology: "point-list",
      },
    });

    return true;
  }

  render(data: unknown): boolean {
    if (!this.device || !this.context || !this.pipeline) {
      return false;
    }

    const pointData = data as PointData;
    if (!pointData.positions || pointData.positions.length === 0) {
      return false;
    }

    this.pointCount = pointData.positions.length / 2;

    // Update or create vertex buffer
    if (
      !this.vertexBuffer ||
      this.vertexBuffer.size < pointData.positions.byteLength
    ) {
      this.vertexBuffer?.destroy();
      this.vertexBuffer = createBuffer(
        this.device,
        pointData.positions,
        GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      );
    } else {
      updateBuffer(this.device, this.vertexBuffer, pointData.positions);
    }

    // Update or create color buffer
    if (pointData.colors) {
      if (
        !this.colorBuffer ||
        this.colorBuffer.size < pointData.colors.byteLength
      ) {
        this.colorBuffer?.destroy();
        this.colorBuffer = createBuffer(
          this.device,
          pointData.colors,
          GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        );
      } else {
        updateBuffer(this.device, this.colorBuffer, pointData.colors);
      }
    }

    // Render
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
          loadOp: "clear" as GPULoadOp,
          storeOp: "store" as GPUStoreOp,
        },
      ] as GPURenderPassColorAttachment[],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    if (this.colorBuffer) {
      renderPass.setVertexBuffer(1, this.colorBuffer);
    }
    renderPass.draw(this.pointCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    return true;
  }

  cleanup(): void {
    this.vertexBuffer?.destroy();
    this.colorBuffer?.destroy();
    this.vertexBuffer = null;
    this.colorBuffer = null;
    this.device = null;
    this.context = null;
    this.pipeline = null;
  }

  isReady(): boolean {
    return (
      this.device !== null && this.context !== null && this.pipeline !== null
    );
  }
}

/**
 * WebGPU Line Renderer for Waveform Visualizer
 */
export class WebGPULineRenderer implements IVisualizationRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private pointCount = 0;

  getName(): string {
    return "WebGPU Line Renderer";
  }

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    const result = await initWebGPU(canvas);
    if (!result) {
      return false;
    }

    this.device = result.device;
    this.context = result.context;

    // Create uniform buffer for color
    this.uniformBuffer = this.device.createBuffer({
      size: 16, // vec4f
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create shader module
    const shaderModule = this.device.createShaderModule({
      code: LINE_VERTEX_SHADER + "\n" + LINE_FRAGMENT_SHADER,
    });

    // Create pipeline layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" as GPUBufferBindingType },
        },
      ] as GPUBindGroupLayoutEntry[],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 8, // 2 floats (x, y)
            attributes: [
              {
                format: "float32x2" as GPUVertexFormat,
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
        ] as GPUVertexBufferLayout[],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "main",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
          },
        ],
      },
      primitive: {
        topology: "line-strip",
      },
    });

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    return true;
  }

  render(data: unknown): boolean {
    if (
      !this.device ||
      !this.context ||
      !this.pipeline ||
      !this.bindGroup ||
      !this.uniformBuffer
    ) {
      return false;
    }

    const lineData = data as LineData;
    if (!lineData.positions || lineData.positions.length === 0) {
      return false;
    }

    this.pointCount = lineData.positions.length / 2;

    // Update uniform buffer with color
    const color = lineData.color ?? [0.39, 0.86, 1.0, 0.9];
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array(color),
    );

    // Update or create vertex buffer
    if (
      !this.vertexBuffer ||
      this.vertexBuffer.size < lineData.positions.byteLength
    ) {
      this.vertexBuffer?.destroy();
      this.vertexBuffer = createBuffer(
        this.device,
        lineData.positions,
        GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      );
    } else {
      updateBuffer(this.device, this.vertexBuffer, lineData.positions);
    }

    // Render
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
          loadOp: "clear" as GPULoadOp,
          storeOp: "store" as GPUStoreOp,
        },
      ] as GPURenderPassColorAttachment[],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.draw(this.pointCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    return true;
  }

  cleanup(): void {
    this.vertexBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.vertexBuffer = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
    this.device = null;
    this.context = null;
    this.pipeline = null;
  }

  isReady(): boolean {
    return (
      this.device !== null &&
      this.context !== null &&
      this.pipeline !== null &&
      this.bindGroup !== null
    );
  }
}

/**
 * WebGPU Texture Renderer for Spectrogram
 */
export class WebGPUTextureRenderer implements IVisualizationRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private texture: GPUTexture | null = null;
  private sampler: GPUSampler | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private textureWidth = 0;
  private textureHeight = 0;

  getName(): string {
    return "WebGPU Texture Renderer";
  }

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    const result = await initWebGPU(canvas);
    if (!result) {
      return false;
    }

    this.device = result.device;
    this.context = result.context;

    // Create sampler
    this.sampler = this.device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    // Create shader module
    const shaderModule = this.device.createShaderModule({
      code: TEXTURE_VERTEX_SHADER + "\n" + TEXTURE_FRAGMENT_SHADER,
    });

    // Create pipeline layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" as GPUSamplerBindingType },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" as GPUTextureSampleType },
        },
      ] as GPUBindGroupLayoutEntry[],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "main",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "main",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
          },
        ],
      },
      primitive: {
        topology: "triangle-strip",
      },
    });

    return true;
  }

  render(data: unknown): boolean {
    if (!this.device || !this.context || !this.pipeline || !this.sampler) {
      return false;
    }

    const textureData = data as TextureData;
    if (
      !textureData.data ||
      textureData.width === 0 ||
      textureData.height === 0
    ) {
      return false;
    }

    // Create or update texture if size changed
    if (
      !this.texture ||
      this.textureWidth !== textureData.width ||
      this.textureHeight !== textureData.height
    ) {
      this.texture?.destroy();
      this.texture = createTexture(
        this.device,
        textureData.width,
        textureData.height,
      );
      this.textureWidth = textureData.width;
      this.textureHeight = textureData.height;

      // Recreate bind group
      const bindGroupLayout = this.pipeline.getBindGroupLayout(0);
      this.bindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: this.sampler,
          },
          {
            binding: 1,
            resource: this.texture.createView(),
          },
        ],
      });
    }

    // Update texture data
    updateTexture(
      this.device,
      this.texture,
      textureData.data,
      textureData.width,
      textureData.height,
    );

    // Render
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
          loadOp: "clear" as GPULoadOp,
          storeOp: "store" as GPUStoreOp,
        },
      ] as GPURenderPassColorAttachment[],
    });

    renderPass.setPipeline(this.pipeline);
    if (this.bindGroup) {
      renderPass.setBindGroup(0, this.bindGroup);
    }
    renderPass.draw(4); // 4 vertices for fullscreen quad
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    return true;
  }

  cleanup(): void {
    this.texture?.destroy();
    this.texture = null;
    this.sampler = null;
    this.bindGroup = null;
    this.device = null;
    this.context = null;
    this.pipeline = null;
  }

  isReady(): boolean {
    return (
      this.device !== null && this.context !== null && this.pipeline !== null
    );
  }
}
