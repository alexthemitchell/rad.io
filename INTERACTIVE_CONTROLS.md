# Interactive Visualization Controls

The rad.io SDR visualizer now supports advanced pointer and wheel events for intuitive navigation and exploration of signal data.

## Features

### 🖱️ Mouse & Pointer Controls

- **Pan**: Click and drag on any visualization to pan the view
- **Zoom**: Use mouse wheel to zoom in and out
- **Reset**: Click the "Reset View" button or press `0` to return to default view

### 📱 Touch & Multi-Touch Gestures

- **Single Finger Pan**: Touch and drag to pan the view
- **Pinch-to-Zoom**: Use two fingers to pinch and zoom
- **Tap to Focus**: Tap on specific areas to examine signal details

### ⌨️ Keyboard Navigation

For accessibility and precision control:

- **Arrow Keys**: Pan the view in any direction
  - `←` Left
  - `→` Right
  - `↑` Up
  - `↓` Down
- **Zoom Controls**:
  - `+` or `=` Zoom in
  - `-` or `_` Zoom out
  - `0` Reset to default view

## Supported Visualizations

All three main visualization components support interactive controls:

1. **IQ Constellation Diagram**
   - Pan to explore different regions of the constellation
   - Zoom to examine signal density patterns
   - Useful for identifying modulation schemes

2. **Spectrogram (Power Spectral Density)**
   - Pan to view different time periods
   - Zoom to examine specific frequency ranges
   - Ideal for spotting interference or signal variations

3. **Amplitude Waveform**
   - Pan through time-domain data
   - Zoom to analyze signal envelope details
   - Great for AM detection and signal strength monitoring

## Configuration Options

The interaction behavior can be customized via the `useVisualizationInteraction` hook:

```typescript
const { transform, handlers, resetTransform } = useVisualizationInteraction({
  panSensitivity: 1.0,      // Pan speed multiplier (default: 1.0)
  zoomSensitivity: 1.0,     // Zoom speed multiplier (default: 1.0)
  minZoom: 0.5,             // Minimum zoom level (default: 0.5)
  maxZoom: 10.0,            // Maximum zoom level (default: 10.0)
  enablePan: true,          // Enable panning (default: true)
  enableZoom: true,         // Enable zooming (default: true)
  enableMultiTouch: true,   // Enable multi-touch gestures (default: true)
  enableKeyboard: true,     // Enable keyboard navigation (default: true)
});
```

## Technical Details

### Pointer Events API

The implementation uses the modern Pointer Events API for unified handling of:
- Mouse input
- Touch input (single and multi-touch)
- Pen/stylus input
- Other pointer devices

### High-Precision Wheel Events

Wheel events provide smooth, high-precision zooming with:
- Delta-based zoom calculation
- Configurable sensitivity
- Zoom limits to prevent over-zoom

### Canvas Transformation

The pan and zoom transforms are applied directly to the canvas 2D context:

```javascript
ctx.save();
ctx.translate(transform.offsetX, transform.offsetY);
ctx.scale(transform.scale, transform.scale);
// ... render visualization ...
ctx.restore();
```

This approach ensures:
- GPU-accelerated rendering
- No re-calculation of visualization data
- Smooth 60 FPS interaction
- Minimal CPU overhead

### Accessibility

The implementation follows WCAG 2.1 guidelines:
- All interactions have keyboard alternatives
- Focus indicators on canvas elements
- ARIA labels for screen readers
- Visual feedback for current transform state

## Browser Compatibility

Interactive controls work in all browsers that support:
- Pointer Events API (Chrome 55+, Firefox 59+, Safari 13+, Edge 18+)
- Wheel Events (All modern browsers)
- Canvas 2D API (Universal support)

### Fallback Behavior

On older browsers:
- Mouse events fall back to pointer events
- Touch events work as standard
- Keyboard navigation always available

## Performance Considerations

The implementation is optimized for performance:

1. **Debouncing**: High-frequency events are batched
2. **RAF**: Rendering uses requestAnimationFrame
3. **Transform Only**: Only canvas transform changes, not data
4. **Pointer Capture**: Prevents event leakage during gestures

## Examples

### Basic Usage

```tsx
import IQConstellation from './components/IQConstellation';

function App() {
  return (
    <IQConstellation 
      samples={mySignalData}
      width={800}
      height={600}
    />
  );
}
```

The component automatically includes interaction handlers.

### Custom Sensitivity

For high-precision work, reduce sensitivity:

```tsx
const visualization = useVisualizationInteraction({
  panSensitivity: 0.5,  // Slower pan for precision
  zoomSensitivity: 0.5, // Slower zoom for precision
});
```

For quick navigation, increase sensitivity:

```tsx
const visualization = useVisualizationInteraction({
  panSensitivity: 2.0,  // Faster pan
  zoomSensitivity: 2.0, // Faster zoom
});
```

### Disable Features

For presentation mode, disable interaction:

```tsx
const visualization = useVisualizationInteraction({
  enablePan: false,
  enableZoom: false,
  enableKeyboard: false,
});
```

## Troubleshooting

### Touch Doesn't Work

Ensure `touch-action: none` is set on the canvas:

```css
canvas {
  touch-action: none;
}
```

This is automatically applied by the component.

### Zoom is Too Sensitive

Reduce the zoom sensitivity:

```tsx
useVisualizationInteraction({ zoomSensitivity: 0.3 })
```

### Can't Pan or Zoom

Check that:
1. Canvas has `tabIndex={0}` for keyboard focus
2. Handlers are properly spread: `{...handlers}`
3. Settings enable the desired features

## Future Enhancements

Planned improvements include:

- [ ] Double-click to reset
- [ ] Zoom to selection (rubber-band)
- [ ] Mini-map for navigation
- [ ] Touch gesture hints
- [ ] Undo/redo transform history
- [ ] Save/restore view presets
- [ ] Synchronized views across visualizations
- [ ] Animation when resetting view

## See Also

- [Accessibility Documentation](./ACCESSIBILITY.md)
- [Performance Monitoring](./PERFORMANCE_MONITORING.md)
- [Component API Reference](./src/components/README.md)
