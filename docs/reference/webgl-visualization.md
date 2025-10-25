# WebGL Visualization for SDR

## Overview

GPU-accelerated rendering using WebGL enables smooth, high-performance spectrum and waterfall displays capable of handling high data rates.

## Why WebGL for SDR?

### Canvas 2D Limitations

- CPU-bound rendering
- Slow for large datasets (>1000 points)
- No parallel processing
- Frame rate drops with complex visualizations

### WebGL Advantages

- GPU-accelerated
- Handle millions of points
- Smooth 60+ FPS
- Parallel processing
- Efficient memory usage

## Basic WebGL Setup

```javascript
class WebGLVisualization {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });

    if (!this.gl) {
      throw new Error("WebGL 2 not supported");
    }

    this.initGL();
  }

  initGL() {
    const gl = this.gl;

    // Set viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Clear color
    gl.clearColor(0.05, 0.05, 0.1, 1.0);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }
}
```

## Spectrum Display

### Vertex Shader

```glsl
#version 300 es
precision highp float;

in vec2 position;
in float magnitude;

uniform float minDB;
uniform float maxDB;

out float vMagnitude;

void main() {
  // Normalize magnitude to [-1, 1] range
  float normalized = (magnitude - minDB) / (maxDB - minDB);
  normalized = clamp(normalized, 0.0, 1.0);

  // Scale to screen coordinates
  vec2 pos = vec2(
    position.x * 2.0 - 1.0,  // X: 0-1 → -1 to 1
    normalized * 2.0 - 1.0    // Y: 0-1 → -1 to 1
  );

  gl_Position = vec4(pos, 0.0, 1.0);
  vMagnitude = normalized;
}
```

### Fragment Shader

```glsl
#version 300 es
precision highp float;

in float vMagnitude;
out vec4 fragColor;

uniform vec3 colorLow;
uniform vec3 colorHigh;

void main() {
  // Interpolate color based on magnitude
  vec3 color = mix(colorLow, colorHigh, vMagnitude);
  fragColor = vec4(color, 1.0);
}
```

### JavaScript Implementation

```javascript
class SpectrumDisplay extends WebGLVisualization {
  constructor(canvas, fftSize) {
    super(canvas);
    this.fftSize = fftSize;
    this.setupShaders();
    this.setupBuffers();
  }

  setupShaders() {
    const gl = this.gl;

    // Create and compile shaders
    this.program = this.createProgram(
      SPECTRUM_VERTEX_SHADER,
      SPECTRUM_FRAGMENT_SHADER,
    );

    // Get attribute locations
    this.attribs = {
      position: gl.getAttribLocation(this.program, "position"),
      magnitude: gl.getAttribLocation(this.program, "magnitude"),
    };

    // Get uniform locations
    this.uniforms = {
      minDB: gl.getUniformLocation(this.program, "minDB"),
      maxDB: gl.getUniformLocation(this.program, "maxDB"),
      colorLow: gl.getUniformLocation(this.program, "colorLow"),
      colorHigh: gl.getUniformLocation(this.program, "colorHigh"),
    };
  }

  setupBuffers() {
    const gl = this.gl;

    // Position buffer (X coordinates)
    this.positionBuffer = gl.createBuffer();
    const positions = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      positions[i] = i / (this.fftSize - 1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Magnitude buffer (Y coordinates, updated each frame)
    this.magnitudeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.magnitudeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.fftSize * 4, gl.DYNAMIC_DRAW);
  }

  render(spectrumDB, minDB = -100, maxDB = 0) {
    const gl = this.gl;

    this.clear();
    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform1f(this.uniforms.minDB, minDB);
    gl.uniform1f(this.uniforms.maxDB, maxDB);
    gl.uniform3f(this.uniforms.colorLow, 0.0, 0.3, 0.8); // Blue
    gl.uniform3f(this.uniforms.colorHigh, 1.0, 1.0, 0.0); // Yellow

    // Update magnitude buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.magnitudeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, spectrumDB);

    // Bind position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 1, gl.FLOAT, false, 0, 0);

    // Bind magnitude attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.magnitudeBuffer);
    gl.enableVertexAttribArray(this.attribs.magnitude);
    gl.vertexAttribPointer(this.attribs.magnitude, 1, gl.FLOAT, false, 0, 0);

    // Draw line strip
    gl.drawArrays(gl.LINE_STRIP, 0, this.fftSize);
  }

  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      fragmentSource,
    );

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Program link failed: " + gl.getProgramInfoLog(program));
    }

    return program;
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error("Shader compile failed: " + gl.getShaderInfoLog(shader));
    }

    return shader;
  }
}

// Usage
const canvas = document.getElementById("spectrum-canvas");
const display = new SpectrumDisplay(canvas, 2048);

function animate() {
  const spectrum = getSpectrumData(); // Your FFT data
  display.render(spectrum, -120, -20);
  requestAnimationFrame(animate);
}
animate();
```

## Waterfall Display

### Texture-Based Approach

```javascript
class WaterfallDisplay extends WebGLVisualization {
  constructor(canvas, width, height) {
    super(canvas);
    this.width = width; // FFT bins
    this.height = height; // History lines
    this.setupShaders();
    this.setupTexture();
    this.setupGeometry();
    this.lineIndex = 0;
  }

  setupTexture() {
    const gl = this.gl;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Create empty texture
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      this.width,
      this.height,
      0,
      gl.RED,
      gl.FLOAT,
      null,
    );

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  setupGeometry() {
    const gl = this.gl;

    // Full-screen quad
    const vertices = new Float32Array([
      -1,
      -1,
      0,
      0, // Bottom-left
      1,
      -1,
      1,
      0, // Bottom-right
      -1,
      1,
      0,
      1, // Top-left
      1,
      1,
      1,
      1, // Top-right
    ]);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  addLine(spectrumDB) {
    const gl = this.gl;

    // Scroll texture up
    if (this.lineIndex > 0) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.copyTexSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        1, // Destination
        0,
        0, // Source
        this.width,
        this.height - 1,
      );
    }

    // Add new line at bottom
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0, // Position
      this.width,
      1, // Size
      gl.RED,
      gl.FLOAT,
      spectrumDB,
    );

    this.lineIndex++;
  }

  render(minDB = -100, maxDB = 0) {
    const gl = this.gl;

    this.clear();
    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform1f(this.uniforms.minDB, minDB);
    gl.uniform1f(this.uniforms.maxDB, maxDB);
    gl.uniform1i(this.uniforms.texture, 0);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Bind geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.attribs.texCoord);
    gl.vertexAttribPointer(this.attribs.texCoord, 2, gl.FLOAT, false, 16, 8);

    // Draw quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
```

### Waterfall Fragment Shader (Viridis Colormap)

```glsl
#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D texture;
uniform float minDB;
uniform float maxDB;

// Viridis colormap
vec3 viridis(float t) {
  const vec3 c0 = vec3(0.2777, 0.0054, 0.3316);
  const vec3 c1 = vec3(0.1046, 1.0949, 2.3024);
  const vec3 c2 = vec3(-0.3306, 0.2252, 0.1565);
  const vec3 c3 = vec3(-4.6342, -7.1829, -19.3267);
  const vec3 c4 = vec3(6.2287, 12.1016, 27.4098);
  const vec3 c5 = vec3(-1.8718, -8.0925, -14.6542);

  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * c5))));
}

void main() {
  // Sample texture
  float value = texture(texture, vTexCoord).r;

  // Normalize to [0, 1]
  float normalized = (value - minDB) / (maxDB - minDB);
  normalized = clamp(normalized, 0.0, 1.0);

  // Apply colormap
  vec3 color = viridis(normalized);

  fragColor = vec4(color, 1.0);
}
```

## Performance Optimizations

### 1. Reduce Draw Calls

```javascript
// ❌ BAD - Multiple draw calls
for (let i = 0; i < spectrums.length; i++) {
  renderSpectrum(spectrums[i]);
}

// ✅ GOOD - Single draw call with instancing
renderAllSpectrums(spectrums);
```

### 2. Use Appropriate Data Types

```javascript
// Use R32F for high precision
gl.texImage2D(..., gl.R32F, ..., gl.RED, gl.FLOAT, data);

// Or R8 for byte data (4× less memory)
gl.texImage2D(..., gl.R8, ..., gl.RED, gl.UNSIGNED_BYTE, data);
```

### 3. Minimize State Changes

```javascript
// Batch operations
gl.bindTexture(...);
gl.texSubImage2D(...);  // Update 1
gl.texSubImage2D(...);  // Update 2
gl.texSubImage2D(...);  // Update 3
```

### 4. Use Texture Arrays for Multiple Waterfalls

```javascript
// 3D texture for multiple waterfall streams
gl.texImage3D(
  gl.TEXTURE_2D_ARRAY,
  0,
  gl.R32F,
  width,
  height,
  numStreams,
  0,
  gl.RED,
  gl.FLOAT,
  null,
);
```

## Grid and Annotations

### Frequency Grid Overlay

```glsl
// Fragment shader
uniform float frequencySpacing; // In normalized coordinates

void main() {
  vec3 color = spectrumColor;

  // Add grid lines
  float gridFreq = 100.0; // Grid lines per unit
  float grid = fract(vTexCoord.x * gridFreq);
  if (grid < 0.02) {
    color = mix(color, vec3(0.5), 0.3);
  }

  fragColor = vec4(color, 1.0);
}
```

## Complete Example

```javascript
class SDRVisualization {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.spectrum = new SpectrumDisplay(this.canvas, 2048);
    this.waterfall = new WaterfallDisplay(this.canvas, 2048, 512);
    this.mode = "spectrum";
  }

  setMode(mode) {
    this.mode = mode;
  }

  update(spectrumDB) {
    if (this.mode === "spectrum") {
      this.spectrum.render(spectrumDB);
    } else if (this.mode === "waterfall") {
      this.waterfall.addLine(spectrumDB);
      this.waterfall.render();
    }
  }
}

// Usage
const viz = new SDRVisualization("sdr-canvas");

function processSignal() {
  const spectrum = computeFFT(samples);
  const spectrumDB = toDecibels(spectrum);
  viz.update(spectrumDB);
  requestAnimationFrame(processSignal);
}
```

## Resources

- **WebGL2 Fundamentals**: webgl2fundamentals.org
- **GPU Gems**: NVIDIA GPU programming techniques
- **Shadertoy**: shadertoy.com - Examples
- **Three.js**: threejs.org - Higher-level WebGL library
