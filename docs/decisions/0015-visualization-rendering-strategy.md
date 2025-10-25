# ADR-0015: Visualization Rendering Strategy

## Status

Accepted

## Context

SDR applications require multiple high-performance visualizations:

- **Waterfall Display**: Time-frequency heatmap, 60 FPS
- **Spectrum Analyzer**: Real-time power vs frequency line plot
- **Constellation Diagram**: IQ sample scatter plot
- **Signal Strength Meter**: S-meter, signal quality indicators
- **Audio Waveform**: Time-domain audio visualization

Each visualization has different requirements:

- Update rates (1-60 FPS)
- Data volumes (102-8192 points)
- Rendering complexity
- Interaction needs (zoom, pan, click)

## Decision

Implement **specialized WebGL2 renderers** for each visualization type with shared infrastructure.

### Architecture

```typescript
// src/lib/visualizations/base-renderer.ts

export abstract class BaseWebGLRenderer {
  protected gl: WebGL2RenderingContext;
  protected program: WebGLProgram;
  protected canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;
    this.program = this.createProgram();
  }

  abstract render(data: any): void;
  protected abstract createProgram(): WebGLProgram;

  protected compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      throw new Error(`Shader compilation failed: ${info}`);
    }

    return shader;
  }

  protected linkProgram(
    vertShader: WebGLShader,
    fragShader: WebGLShader,
  ): WebGLProgram {
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      throw new Error(`Program linking failed: ${info}`);
    }

    return program;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  destroy() {
    this.gl.deleteProgram(this.program);
  }
}
```

### Waterfall Renderer

```typescript
// src/lib/visualizations/waterfall-renderer.ts

export class WaterfallRenderer extends BaseWebGLRenderer {
  private texture: WebGLTexture;
  private textureHeight = 1024;
  private currentRow = 0;
  private colormap: Float32Array;

  constructor(canvas: HTMLCanvasElement, colorScheme: string = "viridis") {
    super(canvas);
    this.texture = this.createTexture();
    this.colormap = this.loadColormap(colorScheme);
  }

  protected createProgram(): WebGLProgram {
    const vertSource = `#version 300 es
      in vec2 position;
      in vec2 texCoord;
      out vec2 vTexCoord;
      uniform float scroll;
      
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        vTexCoord = vec2(texCoord.x, mod(texCoord.y + scroll, 1.0));
      }
    `;

    const fragSource = `#version 300 es
      precision highp float;
      in vec2 vTexCoord;
      out vec4 fragColor;
      uniform sampler2D fftData;
      uniform sampler2D colormap;
      uniform float minDB;
      uniform float maxDB;
      
      void main() {
        float power = texture(fftData, vTexCoord).r;
        float normalized = (power - minDB) / (maxDB - minDB);
        normalized = clamp(normalized, 0.0, 1.0);
        fragColor = texture(colormap, vec2(normalized, 0.5));
      }
    `;

    const vert = this.compileShader(vertSource, this.gl.VERTEX_SHADER);
    const frag = this.compileShader(fragSource, this.gl.FRAGMENT_SHADER);
    return this.linkProgram(vert, frag);
  }

  private createTexture(): WebGLTexture {
    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R32F,
      2048,
      this.textureHeight,
      0,
      this.gl.RED,
      this.gl.FLOAT,
      null,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.REPEAT,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR,
    );

    return texture;
  }

  render(fftData: Float32Array) {
    // Upload new row to texture
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D,
      0,
      0,
      this.currentRow,
      fftData.length,
      1,
      this.gl.RED,
      this.gl.FLOAT,
      fftData,
    );

    // Update scroll offset
    const scrollOffset = this.currentRow / this.textureHeight;

    // Render
    this.gl.useProgram(this.program);
    const scrollLoc = this.gl.getUniformLocation(this.program, "scroll");
    this.gl.uniform1f(scrollLoc, scrollOffset);

    // Draw quad
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    // Advance row
    this.currentRow = (this.currentRow + 1) % this.textureHeight;
  }

  private loadColormap(scheme: string): Float32Array {
    // Load colormap texture (256x1 RGB)
    // Implementation depends on colormap data
    return new Float32Array(256 * 3);
  }
}
```

### Spectrum Analyzer Renderer

```typescript
// src/lib/visualizations/spectrum-renderer.ts

export class SpectrumRenderer extends BaseWebGLRenderer {
  private vbo: WebGLBuffer;
  private peakHoldData: Float32Array | null = null;

  protected createProgram(): WebGLProgram {
    const vertSource = `#version 300 es
      in float value;
      uniform int fftSize;
      uniform float minDB;
      uniform float maxDB;
      
      void main() {
        float x = (float(gl_VertexID) / float(fftSize)) * 2.0 - 1.0;
        float y = ((value - minDB) / (maxDB - minDB)) * 2.0 - 1.0;
        gl_Position = vec4(x, y, 0.0, 1.0);
      }
    `;

    const fragSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform vec3 lineColor;
      
      void main() {
        fragColor = vec4(lineColor, 1.0);
      }
    `;

    const vert = this.compileShader(vertSource, this.gl.VERTEX_SHADER);
    const frag = this.compileShader(fragSource, this.gl.FRAGMENT_SHADER);
    return this.linkProgram(vert, frag);
  }

  render(fftData: Float32Array, enablePeakHold: boolean = false) {
    // Update peak hold
    if (enablePeakHold) {
      if (!this.peakHoldData) {
        this.peakHoldData = new Float32Array(fftData);
      } else {
        for (let i = 0; i < fftData.length; i++) {
          this.peakHoldData[i] = Math.max(this.peakHoldData[i], fftData[i]);
        }
      }
    }

    // Clear
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Render spectrum line
    this.renderLine(fftData, [0.2, 0.8, 1.0]);

    // Render peak hold
    if (enablePeakHold && this.peakHoldData) {
      this.renderLine(this.peakHoldData, [1.0, 1.0, 0.0]);
    }
  }

  private renderLine(data: Float32Array, color: number[]) {
    const vbo = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STREAM_DRAW);

    this.gl.useProgram(this.program);

    const valueLoc = this.gl.getAttribLocation(this.program, "value");
    this.gl.enableVertexAttribArray(valueLoc);
    this.gl.vertexAttribPointer(valueLoc, 1, this.gl.FLOAT, false, 0, 0);

    const colorLoc = this.gl.getUniformLocation(this.program, "lineColor");
    this.gl.uniform3fv(colorLoc, color);

    this.gl.drawArrays(this.gl.LINE_STRIP, 0, data.length);

    this.gl.deleteBuffer(vbo);
  }

  resetPeakHold() {
    this.peakHoldData = null;
  }
}
```

### Constellation Diagram Renderer

```typescript
// src/lib/visualizations/constellation-renderer.ts

export class ConstellationRenderer extends BaseWebGLRenderer {
  private maxPoints = 10000;
  private pointBuffer: Float32Array;
  private pointIndex = 0;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.pointBuffer = new Float32Array(this.maxPoints * 2);
  }

  protected createProgram(): WebGLProgram {
    const vertSource = `#version 300 es
      in vec2 position;
      
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        gl_PointSize = 2.0;
      }
    `;

    const fragSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        fragColor = vec4(0.2, 0.8, 1.0, 0.6);
      }
    `;

    const vert = this.compileShader(vertSource, this.gl.VERTEX_SHADER);
    const frag = this.compileShader(fragSource, this.gl.FRAGMENT_SHADER);
    return this.linkProgram(vert, frag);
  }

  render(iqSamples: IQSamples) {
    // Add new points with persistence
    const count = Math.min(iqSamples.i.length, 1000);

    for (let i = 0; i < count; i++) {
      const idx = (this.pointIndex * 2) % this.pointBuffer.length;
      this.pointBuffer[idx] = iqSamples.i[i];
      this.pointBuffer[idx + 1] = iqSamples.q[i];
      this.pointIndex++;
    }

    // Render all points with fade
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    const vbo = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.pointBuffer,
      this.gl.STREAM_DRAW,
    );

    this.gl.useProgram(this.program);

    const posLoc = this.gl.getAttribLocation(this.program, "position");
    this.gl.enableVertexAttribArray(posLoc);
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.drawArrays(
      this.gl.POINTS,
      0,
      Math.min(this.pointIndex, this.maxPoints),
    );

    this.gl.deleteBuffer(vbo);
  }

  clear() {
    this.pointIndex = 0;
    this.pointBuffer.fill(0);
  }
}
```

## Consequences

### Positive

- 60 FPS performance for all visualizations
- Hardware-accelerated rendering
- Minimal CPU usage
- Smooth animations and transitions
- Shared WebGL infrastructure

### Negative

- WebGL complexity
- Shader debugging challenges
- Context loss must be handled
- Browser compatibility (WebGL2 not in old browsers)

## Performance Targets

- Waterfall: 60 FPS @ 2048 FFT bins
- Spectrum: 60 FPS @ 8192 bins
- Constellation: 60 FPS @ 10,000 points
- GPU memory: < 100 MB total

## References

#### WebGL Resources and Documentation

- [WebGL2 Fundamentals](https://webgl2fundamentals.org/) - Comprehensive WebGL2 tutorial and reference
- [GPU Gems - Efficient Data Textures](https://developer.nvidia.com/gpugems) - NVIDIA GPU optimization techniques

#### Academic Research (from ADR-0003)

- Springer (2025). "DECODE-3DViz: Efficient WebGL-Based High-Fidelity Visualization." [Research](https://link.springer.com/article/10.1007/s10278-025-01430-9) - 144 FPS with large datasets using LOD
- ScienceDirect (2024). "WebGL vs. WebGPU: A Performance Analysis." [Paper](https://www.sciencedirect.com/science/article/pii/S1877050924006410) - Performance benchmarks

#### Conference Papers

- "Real-Time Data Visualization in WebGL" - IEEE Vis Conference 2020 - Real-time rendering strategies

#### Related ADRs

- ADR-0003: WebGL2/WebGPU GPU Acceleration (rendering platform choice)
- ADR-0016: Viridis Colormap (colormap shader implementation)
