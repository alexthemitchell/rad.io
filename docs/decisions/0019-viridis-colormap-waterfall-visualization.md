# Viridis Colormap for Waterfall Visualization

## Context and Problem Statement

Waterfall displays in SDR applications map signal power levels to colors for time-frequency visualization. The colormap choice directly impacts users' ability to interpret signal strength, detect weak signals, and identify interference patterns. Traditional SDR applications often use rainbow or thermal colormaps, but these have known perceptual and accessibility issues. How should we map signal power to colors in waterfall visualizations to maximize interpretability, accessibility, and scientific accuracy?

## Decision Drivers

- PRD requirement for "precision" - users must accurately interpret signal strength
- PRD requirement for "professional" - colormaps used in research-grade instrumentation
- Perceptual uniformity - equal data differences should appear as equal color differences
- Accessibility - colorblind users (8% of males, 0.5% of females) must interpret data
- Dynamic range visualization - need to show both strong and weak signals clearly
- Scientific community standards - alignment with modern data visualization best practices
- Print/grayscale compatibility - documentation and publications may be monochrome
- Cross-cultural perception - color meanings vary across cultures, need universal interpretation

## Considered Options

- **Option 1**: Viridis colormap (perceptually uniform, colorblind-safe)
- **Option 2**: Jet/Rainbow colormap (traditional SDR standard)
- **Option 3**: Thermal/Hot colormap (red-yellow-white gradient)
- **Option 4**: Grayscale/Monochrome (black to white)
- **Option 5**: Custom SDR-optimized colormap (designed specifically for RF)

## Decision Outcome

Chosen option: **"Viridis colormap"**, because it provides perceptually uniform color progression, remains interpretable for all forms of colorblindness, converts gracefully to grayscale, and aligns with modern scientific visualization standards while maintaining intuitive dark-to-bright signal strength mapping.

### Consequences

- Good, because perceptually uniform mapping ensures accurate signal strength interpretation
- Good, because colorblind-safe design makes application accessible to ~8% of male users
- Good, because grayscale conversion maintains interpretability in printed documentation
- Good, because aligns with scientific community standards (matplotlib default, widely published)
- Good, because monotonically increasing luminance maps intuitively to signal strength
- Good, because smooth color transitions reduce false edge detection in visualizations
- Bad, because some users may prefer traditional rainbow colormaps (subjective preference)
- Bad, because requires shipping colormap lookup table data (~3KB)
- Neutral, because different from most existing SDR software (training curve for experienced users)

### Confirmation

Success criteria for this decision:

- User testing shows ≥95% of users (including colorblind) can correctly interpret signal strength gradients
- A/B testing shows Viridis improves weak signal detection compared to rainbow colormap
- Accessibility audit confirms WCAG compliance for colormap-based information
- User feedback indicates preference for Viridis after 1-week usage period
- Perceptual uniformity validated: ΔE2000 color difference proportional to data difference (±10%)

## Pros and Cons of the Options

### Option 1: Viridis Colormap

- Good, because perceptually uniform - equal power changes appear as equal color changes
- Good, because colorblind-safe - interpretable for deuteranopia, protanopia, tritanopia
- Good, because monotonically increasing luminance (dark purple → bright yellow)
- Good, because grayscale-compatible - luminance channel preserves information
- Good, because scientifically validated and widely published (Matplotlib, Nature journals)
- Good, because smooth color transitions reduce visual artifacts
- Good, because crosses cultural boundaries - no culture-specific color meanings
- Bad, because unfamiliar to users accustomed to rainbow colormaps
- Bad, because limited color range (blue-green-yellow) vs. full spectrum
- Neutral, because requires lookup table data (~3KB for 256-entry map)

### Option 2: Jet/Rainbow Colormap

- Good, because familiar to SDR users (traditional standard)
- Good, because uses full color spectrum (appears to show more detail)
- Good, because visually striking and colorful
- Bad, because NOT perceptually uniform - red-green transition appears sharper than blue-cyan
- Bad, because NOT colorblind-safe - deuteranopes cannot distinguish red from green
- Bad, because non-monotonic luminance creates false edges in data
- Bad, because poor grayscale conversion - red and green map to similar gray values
- Bad, because scientifically discredited (banned in many visualization contexts)
- Bad, because arbitrary color boundaries create perceptual artifacts

### Option 3: Thermal/Hot Colormap

- Good, because intuitive "temperature" metaphor (cold = weak, hot = strong)
- Good, because monotonically increasing luminance
- Good, because familiar from thermal imaging
- Neutral, because partially colorblind-safe (deuteranopes can distinguish, protanopes struggle)
- Bad, because not perceptually uniform - yellow-white transition compressed
- Bad, because red has cultural meaning (danger/warning) that may confuse interpretation
- Bad, because poor color saturation in highlights (white = no hue information)

### Option 4: Grayscale/Monochrome

- Good, because universally accessible (no color vision required)
- Good, because maximum compatibility (print, e-ink, accessibility tools)
- Good, because simple implementation (single channel)
- Good, because no perceptual uniformity issues
- Bad, because limited dynamic range compared to color (fewer distinguishable levels)
- Bad, because less engaging visually (may impact user experience)
- Bad, because cannot use color for simultaneous orthogonal data dimensions
- Bad, because lacks the information density of color (human eye distinguishes ~30 gray levels vs. millions of colors)

### Option 5: Custom SDR-Optimized Colormap

- Good, because could be designed specifically for RF signal characteristics
- Good, because could emphasize common signal types (carriers, modulation)
- Good, because opportunity to incorporate domain-specific needs
- Bad, because requires significant research and user testing
- Bad, because lacks scientific validation and peer review
- Bad, because non-standard (incompatible with publications, cross-tool comparison)
- Bad, because maintenance burden (must update based on user feedback)
- Bad, because may not generalize across different SDR use cases

## More Information

### Implementation Details

**Colormap Data Structure:**

```typescript
// src/lib/colormaps/viridis.ts

export const VIRIDIS_256: Float32Array = new Float32Array([
  // 256 RGB triplets (768 values total)
  // Normalized to [0.0, 1.0] range for GPU upload
  0.267004,
  0.004874,
  0.329415, // Entry 0 (darkest)
  0.26851,
  0.009605,
  0.335427, // Entry 1
  // ... 254 more entries ...
  0.993248,
  0.906157,
  0.143936, // Entry 255 (brightest)
]);

export interface Colormap {
  name: string;
  data: Float32Array; // RGB triplets
  range: [number, number]; // Min/max values
  reversed: boolean;
}

export function createColormap(
  scheme: "viridis" | "plasma" | "inferno" | "magma",
): Colormap {
  // Support Viridis family for future user preference
  const data =
    scheme === "viridis"
      ? VIRIDIS_256
      : scheme === "plasma"
        ? PLASMA_256
        : scheme === "inferno"
          ? INFERNO_256
          : MAGMA_256;

  return {
    name: scheme,
    data,
    range: [0, 1],
    reversed: false,
  };
}
```

**WebGL Integration:**

```typescript
// src/lib/visualizations/waterfall-renderer.ts

private uploadColormapTexture(colormap: Colormap) {
  const texture = this.gl.createTexture()
  this.gl.bindTexture(this.gl.TEXTURE_2D, texture)

  // 256x1 RGB texture
  this.gl.texImage2D(
    this.gl.TEXTURE_2D,
    0,
    this.gl.RGB32F,
    256,
    1,
    0,
    this.gl.RGB,
    this.gl.FLOAT,
    colormap.data
  )

  // Clamp to edge, linear interpolation
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)

  return texture
}
```

**Fragment Shader:**

```glsl
// Waterfall fragment shader

precision highp float;
in vec2 vTexCoord;
out vec4 fragColor;

uniform sampler2D fftData;     // Power data
uniform sampler2D colormap;    // Viridis lookup
uniform float minDB;           // Dynamic range
uniform float maxDB;

void main() {
  // Sample power value
  float power = texture(fftData, vTexCoord).r;

  // Normalize to [0, 1]
  float normalized = (power - minDB) / (maxDB - minDB);
  normalized = clamp(normalized, 0.0, 1.0);

  // Lookup color from Viridis
  vec3 color = texture(colormap, vec2(normalized, 0.5)).rgb;

  fragColor = vec4(color, 1.0);
}
```

### User Preference Support

While Viridis is the default, users may prefer alternatives:

```typescript
// User settings
interface WaterfallSettings {
  colormap:
    | "viridis"
    | "plasma"
    | "inferno"
    | "magma"
    | "grayscale"
    | "thermal";
  reversed: boolean; // Dark = strong, light = weak
  contrastBoost: number; // [1.0, 2.0] for enhanced visibility
}

// Allow power users to upload custom colormaps
function loadCustomColormap(file: File): Promise<Colormap> {
  // Parse CSV, JSON, or binary colormap formats
  // Validate: 256 entries, RGB [0-1] range, monotonic luminance
}
```

### Accessibility Testing Results

Testing with ColorOracle (colorblindness simulator):

| Vision Type             | Viridis Result     | Rainbow Result            |
| ----------------------- | ------------------ | ------------------------- |
| Normal                  | ✅ Clear gradient  | ⚠️ Visually busy          |
| Protanopia (1% males)   | ✅ Clear gradient  | ❌ Red/green identical    |
| Deuteranopia (6% males) | ✅ Clear gradient  | ❌ Red/green identical    |
| Tritanopia (0.01%)      | ✅ Clear gradient  | ⚠️ Blue/yellow compressed |
| Grayscale               | ✅ Smooth gradient | ❌ Non-monotonic bands    |

### Performance Characteristics

- **Colormap texture size**: 256 entries × 3 channels × 4 bytes = 3 KB
- **GPU upload time**: <1ms (one-time initialization)
- **Lookup performance**: O(1) hardware-accelerated texture sampling
- **Memory overhead**: Negligible (3KB GPU, 3KB CPU for multiple schemes)

### References

- [Viridis - Matplotlib Default Colormap](https://bids.github.io/colormap/) - Design rationale and perceptual testing
- [A Better Default Colormap for Matplotlib](https://www.youtube.com/watch?v=xAoljeRJ3lU) - SciPy 2015 presentation
- [Crameri et al. (2020)](https://www.nature.com/articles/s41467-020-19160-7) - "The misuse of colour in science communication"
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/) - Color contrast and accessibility requirements

### Migration from Existing Colormaps

For users migrating from other SDR software:

1. **Explain the change**: Documentation explaining why Viridis is better
2. **Side-by-side comparison**: Settings page showing Viridis vs. Rainbow with same data
3. **User preference**: Allow switching back to thermal/rainbow if strongly preferred
4. **Educational tooltips**: First-time use explains colorblind-safety benefits
5. **Tutorial mode**: Interactive demo showing perceptual uniformity

### Future Enhancements

- **Colormap library**: Support additional perceptually uniform maps (Plasma, Inferno, Magma)
- **User-uploaded colormaps**: Allow custom CSV/JSON colormap imports
- **Adaptive colormaps**: Adjust based on signal characteristics (noise floor, peak power)
- **Split colormaps**: Different colors for above/below noise floor
- **Temporal colormaps**: Color fades over time to show signal persistence
- **Categorical overlays**: Add annotation colors for identified signals

### Related ADRs

- ADR-0003: WebGL2/WebGPU GPU Acceleration - colormap implementation platform
- ADR-0015: Visualization Rendering Strategy - waterfall renderer architecture
- ADR-0017: Comprehensive Accessibility Patterns - broader accessibility context

### References

#### Academic Research on Perceptually Uniform Colormaps

- Crameri, Fabio, et al. "Scientific colour maps for geoscience." Zenodo (2023). [Scientific Colour Maps](https://www.fabiocrameri.ch/colourmaps/) - Perceptually uniform, colorblind-friendly visualization colormaps
- Nuñez, Jamie R., et al. "Optimizing colormaps with consideration for color vision deficiency to enable accurate interpretation of scientific data." PLOS ONE (2018). [Research Paper](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0199239) - Mathematical optimization of colormaps for CVD accessibility
- Moreland, Kenneth. "Color Map Advice for Scientific Visualization." Sandia National Laboratories. [Technical Guide](https://www.kennethmoreland.com/color-advice/) - Industry standard guidance on colormap selection

#### Viridis Implementation and Design

- "Introduction to the viridis color maps." GitHub Pages. [Documentation](https://sjmgarnier.github.io/viridis/articles/intro-to-viridis.html) - Design principles and mathematical properties
- arXiv. "An optimized colormap for the scientific community." (2017). [Research Paper](https://arxiv.org/pdf/1712.01662v2) - Technical details of Viridis design

#### Related Standards

- matplotlib - Default colormap library implementation
- ParaView - Scientific visualization software using Viridis
