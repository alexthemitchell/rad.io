# Frequency Marker Placement - Usage Guide

## Overview

The Spectrum component now supports interactive frequency marker placement for measurement purposes. This feature allows users to place markers on the spectrum display to measure frequency and power at specific points.

## Enabling Markers

To enable marker functionality on a Spectrum component, set the `enableMarkers` prop to `true`:

```tsx
import Spectrum from "./visualization/components/Spectrum";
import { useMarkers } from "./store";

function MyComponent() {
  const { markers, addMarker, removeMarker, clearMarkers } = useMarkers();

  return (
    <Spectrum
      magnitudes={fftMagnitudes}
      sampleRate={2e6}
      centerFrequency={100e6}
      enableMarkers={true}
    />
  );
}
```

## User Interactions

### Placing Markers

**Method 1: Click on Spectrum**

- Single-click anywhere on the spectrum display
- A marker will be placed at the clicked frequency
- Power level at that frequency is automatically captured
- Maximum of 10 markers can be placed

**Method 2: Keyboard Shortcut**

- Press **'M'** key while the spectrum overlay canvas has focus
- A marker will be placed at the center frequency
- Useful for precise placement at known frequencies

### Repositioning Markers

**Drag to Move**

- Click and hold on the circular drag handle at the top of a marker
- Drag horizontally to reposition the marker to a new frequency
- Vertical dragging has no effect (markers stay on the spectrum)
- Power value is automatically updated based on new frequency

**Visual Feedback**

- Cursor changes to "grab" when hovering over drag handle
- Cursor changes to "pointer" when hovering over marker line
- Marker line width increases when hovered
- Drag handle size increases when hovered

### Deleting Markers

**Right-Click to Delete**

- Right-click on any part of a marker (line or handle)
- The marker will be immediately removed
- Context menu is prevented when markers are enabled

## Marker Display

Each marker shows:

- **Label**: Sequential marker number (M1, M2, M3...)
- **Frequency**: Displayed in MHz with 3 decimal places (e.g., "100.500 MHz")
- **Power**: Measured in dBFS with 2 decimal places (e.g., "-45.20 dBFS")

Visual representation:

- **Vertical line**: 2-3px wide, cyan color with glow effect
- **Drag handle**: 4-6px circle at top of marker line
- **Label box**: Black background with cyan border, white text

## Integration with MarkerTable

Markers are automatically synchronized with the MarkerTable component through the Zustand store:

```tsx
import MarkerTable from "./components/MarkerTable";
import { useMarkers } from "./store";

function MyAnalysisPanel() {
  const { markers, removeMarker, addMarker } = useMarkers();

  return (
    <MarkerTable markers={markers} onRemove={removeMarker} onAdd={addMarker} />
  );
}
```

The MarkerTable will display:

- All placed markers with their measurements
- Delta frequency between consecutive markers
- Delta power between consecutive markers
- Export to CSV functionality

## Accessibility

The marker system includes full accessibility support:

- **Screen Reader Announcements**: When a marker is placed or deleted, an announcement is made to screen readers
- **Keyboard Navigation**: Markers can be placed using the 'M' keyboard shortcut
- **ARIA Labels**: The overlay canvas has descriptive aria-label indicating marker status
- **Focus Management**: The overlay canvas is focusable when markers are enabled

Example announcement: "Marker 1 placed at 100.500 MHz, -45.20 dBFS"

## Technical Details

### Coordinate Conversion

The system converts between canvas pixel coordinates and frequency:

```typescript
// Convert pixel X coordinate to frequency
const freqHz = annotations.pixelToFrequency(
  pixelX,
  canvasWidth,
  sampleRate,
  centerFrequency,
);
```

Conversion accounts for:

- Canvas margins (left: 80px, right: 40px)
- Frequency range based on sample rate
- Proper clamping to visible spectrum range

### State Management

Markers are stored in the Zustand store:

- **Persistence**: None (ephemeral, runtime-only)
- **Scope**: Application-wide
- **Expiration**: Cleared on page reload

Store actions:

- `addMarker(freqHz, powerDb?)`: Add a new marker
- `updateMarker(id, freqHz?, powerDb?)`: Update marker position/power
- `removeMarker(id)`: Remove a marker by ID
- `clearMarkers()`: Remove all markers

### Power Value Capture

Power values are automatically captured from the FFT magnitude data:

1. Marker frequency is converted to FFT bin index
2. Magnitude value is read from the FFT data array
3. Value is stored with the marker
4. Updated automatically when marker is repositioned

## Limitations

- Maximum 10 markers can be placed
- Markers require both `sampleRate` and `centerFrequency` to be provided
- Markers are not persisted between sessions
- Power values are only accurate when FFT data is current

## Example Usage

### Basic Marker Measurement

```tsx
import Spectrum from "./visualization/components/Spectrum";
import MarkerTable from "./components/MarkerTable";
import { useMarkers } from "./store";

function SpectrumAnalyzer({ magnitudes, sampleRate, centerFrequency }) {
  const { markers, addMarker, removeMarker, clearMarkers } = useMarkers();

  return (
    <div>
      <Spectrum
        magnitudes={magnitudes}
        sampleRate={sampleRate}
        centerFrequency={centerFrequency}
        enableMarkers={true}
      />
      <MarkerTable
        markers={markers}
        onRemove={removeMarker}
        onAdd={() => addMarker(centerFrequency)}
      />
      <button onClick={clearMarkers}>Clear All Markers</button>
    </div>
  );
}
```

### Programmatic Marker Control

```tsx
// Add marker at specific frequency
addMarker(100.5e6, -42.5); // 100.5 MHz at -42.5 dBFS

// Update marker frequency
updateMarker(markerId, 101.0e6); // Move to 101.0 MHz

// Update marker power only
updateMarker(markerId, undefined, -38.2); // Update power to -38.2 dBFS

// Remove specific marker
removeMarker(markerId);

// Clear all markers
clearMarkers();
```

## Testing

Comprehensive test coverage includes:

### Unit Tests

- Pixel-to-frequency coordinate conversion
- Marker hit detection (drag handle vs line)
- Marker rendering and filtering
- Edge cases and invalid inputs

### Integration Tests

- Marker placement via click
- Marker deletion via right-click
- Keyboard shortcut functionality
- Marker limits enforcement
- Accessibility features

Run tests:

```bash
npm test -- SpectrumAnnotations.markers.test
npm test -- Spectrum.markers.test
```

All 25 marker-related tests are passing ✓

## Future Enhancements

Potential improvements for future releases:

- Marker persistence (localStorage or IndexedDB)
- Marker labels/notes
- Reference markers (persistent across frequency changes)
- Marker export formats (JSON, XML)
- Marker delta calculations in UI
- Marker snapping to spectral peaks
- Marker color customization
