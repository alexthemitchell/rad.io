# Tutorial 2: Your First Visualization

In this tutorial, you'll create a simple real-time spectrum visualization from scratch. You'll learn how rad.io's visualization components work and how to connect them to data sources.

**Time to complete**: 30-40 minutes  
**Prerequisites**: Completed [Tutorial 1: Getting Started](./01-getting-started.md)  
**What you'll learn**: Visualization architecture, data flow, React hooks, Canvas rendering

## What You'll Build

A simple real-time frequency spectrum analyzer that:

- Displays frequency vs amplitude
- Updates in real-time as data arrives
- Uses Canvas 2D for rendering
- Works with simulated data (no hardware required)

## Understanding the Visualization Architecture

Before coding, let's understand how visualizations work in rad.io:

```
Data Source → DSP Processing → Visualization Component → Renderer → Canvas
```

**Key principles:**

1. **Separation of concerns**: Visualization components don't know where data comes from
2. **Renderer abstraction**: Same component works with Canvas 2D, WebGL, or WebGPU
3. **React integration**: Standard React patterns with hooks

## Step 1: Create a New Visualization Component

Create a new file: `src/components/SimpleSpectrum.tsx`

```typescript
import React, { useEffect, useRef } from 'react';

interface SimpleSpectrumProps {
  /** FFT data: array of magnitudes from 0 to 1 */
  fftData: Float32Array;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
}

/**
 * A simple spectrum visualization that displays frequency vs amplitude.
 *
 * This component demonstrates the core pattern for rad.io visualizations:
 * 1. Receive data as props
 * 2. Use a canvas for rendering
 * 3. Update on data changes
 */
export const SimpleSpectrum: React.FC<SimpleSpectrumProps> = ({
  fftData,
  width = 800,
  height = 400,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Draw the spectrum
    ctx.strokeStyle = '#0ff'; // Cyan
    ctx.lineWidth = 2;
    ctx.beginPath();

    const binWidth = width / fftData.length;

    for (let i = 0; i < fftData.length; i++) {
      const x = i * binWidth;
      // Flip Y axis (canvas origin is top-left)
      const y = height - (fftData[i] * height);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }, [fftData, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ border: '1px solid #333' }}
      aria-label="Frequency spectrum visualization"
    />
  );
};
```

**What's happening here?**

- `useRef` creates a reference to the canvas element
- `useEffect` runs when `fftData` changes, redrawing the visualization
- Canvas 2D API draws the spectrum line
- The component is accessible with ARIA labels

## Step 2: Create a Test Data Generator

Create `src/utils/testDataGenerator.ts`:

```typescript
/**
 * Generates simulated FFT data for testing visualizations.
 *
 * Creates a spectrum with a few frequency peaks to simulate signals.
 */
export function generateTestFFT(size: number = 512): Float32Array {
  const data = new Float32Array(size);

  // Add noise floor
  for (let i = 0; i < size; i++) {
    data[i] = Math.random() * 0.1; // 10% noise
  }

  // Add some signal peaks
  // Peak 1: Strong signal at 1/4 of spectrum
  const peak1 = Math.floor(size * 0.25);
  for (let i = -5; i <= 5; i++) {
    const idx = peak1 + i;
    if (idx >= 0 && idx < size) {
      data[idx] += 0.7 * Math.exp(-(i * i) / 8);
    }
  }

  // Peak 2: Weaker signal at 3/4 of spectrum
  const peak2 = Math.floor(size * 0.75);
  for (let i = -3; i <= 3; i++) {
    const idx = peak2 + i;
    if (idx >= 0 && idx < size) {
      data[idx] += 0.4 * Math.exp(-(i * i) / 4);
    }
  }

  return data;
}

/**
 * Generates animated FFT data that changes over time.
 * Useful for testing real-time visualization updates.
 */
export function generateAnimatedFFT(
  size: number = 512,
  time: number = 0,
): Float32Array {
  const data = generateTestFFT(size);

  // Animate the peaks by shifting them slightly
  const shift = Math.sin(time * 0.001) * 20;
  const result = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    const srcIdx = Math.floor(i + shift);
    if (srcIdx >= 0 && srcIdx < size) {
      result[i] = data[srcIdx];
    }
  }

  return result;
}
```

## Step 3: Integrate into Monitor (or your page)

Create a small component and integrate it into your page (the main app uses the Monitor page):

```typescript
import React, { useEffect, useState } from 'react';
import { SimpleSpectrum } from '../components/SimpleSpectrum';
import { generateAnimatedFFT } from '../utils/testDataGenerator';

export const SimpleSpectrumExample: React.FC = () => {
  const [fftData, setFftData] = useState<Float32Array>(() =>
    generateAnimatedFFT(512, 0)
  );
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!isAnimating) return;

    const startTime = Date.now();
    let animationFrameId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      setFftData(generateAnimatedFFT(512, elapsed));
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isAnimating]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#111', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff' }}>Simple Spectrum Visualization</h1>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setIsAnimating(!isAnimating)}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          {isAnimating ? 'Pause' : 'Play'}
        </button>
      </div>

      <SimpleSpectrum fftData={fftData} width={800} height={400} />

      <div style={{ color: '#888', marginTop: '20px', maxWidth: '800px' }}>
        <h2>What You're Seeing</h2>
        <p>
          This is a real-time frequency spectrum visualization. The x-axis represents
          frequency (left = low, right = high) and the y-axis represents signal amplitude.
        </p>
        <p>
          The two peaks represent simulated radio signals. In a real SDR application,
          these would be actual radio transmissions you're receiving.
        </p>
        <p>
          The animation simulates natural frequency drift that occurs in real radio systems.
        </p>
      </div>
    </div>
  );
};
```

## Step 4: Use It in the App

Option A (recommended): integrate into the Monitor page’s visualization area or behind a feature flag.

Option B: create a temporary route for local development:

```typescript
// Add import at top
import { SimpleSpectrumExample } from './pages/SimpleSpectrumExample';

// Inside your Router configuration, add:
<Route path="/examples/simple-spectrum" element={<SimpleSpectrumExample />} />
```

## Step 5: Run and Test

1. Start the development server (if not already running):

   ```bash
   npm start
   ```

2. Navigate to your example:

   ```
  https://localhost:8080/#/examples/simple-spectrum
   ```

  **Note**: The URL uses HTTPS (required for WebUSB support) and hash-based routing (`#/`). The `/examples/*` routes are for local development only and should not be committed to navigation for production.

3. You should see:
   - A black canvas with a cyan spectrum line
   - Two peaks that slowly move
   - A Play/Pause button

**Try this:**

- Click Pause - the animation stops
- Click Play - it resumes
- Open DevTools - no errors in console
- Resize window - canvas stays visible

## Step 6: Understanding What You Built

Let's break down the key concepts:

### Data Flow

```
generateAnimatedFFT()
    ↓
fftData (state)
    ↓
SimpleSpectrum component
    ↓
useEffect (on data change)
    ↓
Canvas rendering
```

### React Patterns

- **State management**: `useState` holds current FFT data
- **Side effects**: `useEffect` handles animation loop
- **Refs**: `useRef` accesses canvas DOM element
- **Cleanup**: Return function cancels animation frame

### Performance Considerations

- **requestAnimationFrame**: Syncs with browser refresh rate
- **Cleanup**: Cancels animation when component unmounts
- **Typed arrays**: `Float32Array` for efficient memory use

## Step 7: Add Interactivity (Optional Challenge)

Try adding these features on your own:

### Challenge 1: Add Grid Lines

Add frequency grid lines to help read values:

```typescript
// After clearing canvas, before drawing spectrum
ctx.strokeStyle = "#333";
ctx.lineWidth = 1;
for (let i = 0; i < 10; i++) {
  const x = (i / 10) * width;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}
```

### Challenge 2: Show Frequency Labels

Display frequency values on the x-axis:

```typescript
ctx.fillStyle = "#888";
ctx.font = "12px monospace";
for (let i = 0; i <= 10; i++) {
  const x = (i / 10) * width;
  const freq = (i / 10) * 100; // Assuming 100 MHz range
  ctx.fillText(`${freq.toFixed(1)} MHz`, x - 20, height - 5);
}
```

### Challenge 3: Add Peak Detection

Highlight the strongest signal automatically:

```typescript
// Find peak
let peakIdx = 0;
let peakValue = 0;
for (let i = 0; i < fftData.length; i++) {
  if (fftData[i] > peakValue) {
    peakValue = fftData[i];
    peakIdx = i;
  }
}

// Draw peak marker
const peakX = peakIdx * binWidth;
const peakY = height - peakValue * height;
ctx.fillStyle = "#f00";
ctx.beginPath();
ctx.arc(peakX, peakY, 5, 0, Math.PI * 2);
ctx.fill();
```

## What You've Learned

✅ How rad.io visualizations are structured  
✅ Using Canvas 2D for real-time rendering  
✅ Managing animation with React hooks  
✅ Creating test data generators  
✅ Building accessible visualizations

## Next Steps

- **[Tutorial 3: Building an FM Radio](./03-fm-radio-receiver.md)** - Add demodulation
- Explore existing visualizations in `src/components/`
- Read [Visualization Architecture](../explanation/visualization-strategy.md)
- Try the challenges above

## Troubleshooting

### Canvas is Blank

Check:

- Canvas ref is connected: `canvasRef.current !== null`
- Context exists: `getContext('2d')` returns valid context
- FFT data has values: Log `fftData` in console

### Animation is Choppy

- Check CPU usage - might be too many updates
- Reduce FFT size: Try 256 instead of 512
- Check for memory leaks with DevTools

### TypeScript Errors

Make sure all imports are correct and types match:

```bash
npm run type-check
```

**Next:** [Building an FM Radio →](./03-fm-radio-receiver.md)
