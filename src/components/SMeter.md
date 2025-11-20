# SMeter Component

Professional S-Meter component for displaying signal strength in radio communications.

## Overview

The `SMeter` component provides a visual and textual representation of signal strength using the standard S-unit scale (S0-S9 with extensions above S9). It supports both bar and segmented display styles, includes color-coded zones, and is fully accessible with ARIA live region announcements.

## Features

- **Standard S-unit Scale**: S0-S9 with extensions (S9+10, S9+20, etc.)
- **Visual Styles**: 
  - Bar meter (default): smooth gradient bar
  - Segmented meter: 15-segment LED-style display
- **Color Zones**:
  - Weak (gray): S0-S3
  - Fair (cyan): S4-S6
  - Good (green): S7-S8
  - Moderate (yellow): S9+1 to S9+19
  - Strong (orange): S9+20 to S9+39
  - Very Strong (red, pulsing): S9+40+
- **Numeric Displays**: S-unit, dBm, optional dBFS
- **Band Indicator**: Shows HF or VHF/UHF band
- **Calibration Status**: Visual indicators for user or factory calibration
- **Smooth Updates**: Configurable exponential moving average
- **Accessibility**: ARIA live region with rate-limited announcements (max 1 per 2 seconds)
- **Responsive Design**: Adapts to different screen sizes

## Usage

### Basic Usage

```tsx
import { SMeter } from '@/components';
import { useSignalLevel } from '@/store';

function MyComponent() {
  const { signalLevel } = useSignalLevel();
  return <SMeter signalLevel={signalLevel} />;
}
```

### With Options

```tsx
<SMeter
  signalLevel={signalLevel}
  style="bar"           // or "segments"
  showDbm={true}        // show dBm value
  showDbfs={false}      // show dBFS value (engineering mode)
  smoothing={0.3}       // 0-1, lower = more smoothing
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `signalLevel` | `SignalLevel \| null` | required | Current signal level measurement |
| `style` | `"bar" \| "segments"` | `"bar"` | Visual display style |
| `showDbm` | `boolean` | `true` | Show dBm value alongside S-unit |
| `showDbfs` | `boolean` | `false` | Show dBFS value (engineering mode) |
| `smoothing` | `number` | `0.3` | Smoothing factor (0-1). Lower = more smoothing |

## SignalLevel Interface

The component expects a `SignalLevel` object with the following structure:

```typescript
interface SignalLevel {
  dBfs: number;                                    // Power relative to ADC full scale
  dBmApprox: number;                              // Absolute power at antenna (approx)
  sUnit: number;                                  // S-unit (0-9)
  overS9: number;                                 // dB over S9 (0 if below S9)
  band: "HF" | "VHF";                            // Frequency band
  calibrationStatus: "uncalibrated" | "factory" | "user";
  uncertaintyDb?: number;                         // Measurement uncertainty
  timestamp: number;                              // Unix timestamp (ms)
}
```

## Integration with SignalLevelService

The SMeter component is designed to work with the `SignalLevelService`:

```typescript
import { SignalLevelService } from '@/lib/measurement';
import { useSignalLevel } from '@/store';

// Create service
const service = new SignalLevelService({
  calibration: {
    kCal: -70,
    frequencyRange: { min: 88e6, max: 108e6 },
    method: 'default',
    accuracyDb: 10,
  },
  frequencyHz: 100e6,
});

// Subscribe to updates
const { setSignalLevel } = useSignalLevel();
service.subscribe((level) => {
  setSignalLevel(level);
});

// Start sampling
service.start(() => getCurrentIQSamples());
```

## Examples

### Monitor Page Integration

The SMeter is integrated into the Monitor page's Signal Information section:

```tsx
import SMeter from "../components/SMeter";
import { useSignalLevel } from "../store";

function Monitor() {
  const { signalLevel } = useSignalLevel();
  
  return (
    <section aria-label="Signal Information">
      <h3>Signal Information</h3>
      <SMeter signalLevel={signalLevel} showDbm />
    </section>
  );
}
```

### Custom Styling

The component uses CSS custom properties and can be styled:

```css
.s-meter {
  /* Override default styles */
  min-width: 320px;
}

.s-meter-bar-very-strong {
  /* Custom color for very strong signals */
  background: oklch(50% 0.25 30deg);
}
```

## Accessibility

The SMeter component is fully accessible:

- **ARIA Region**: Labeled "S-Meter signal strength"
- **ARIA Meter**: Bar has proper `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- **ARIA Live Region**: Rate-limited announcements for screen readers (max 1 per 2 seconds)
- **Keyboard Navigation**: Supports keyboard focus on interactive elements
- **Screen Reader Labels**: All visual elements have appropriate ARIA labels

### Example Screen Reader Announcement

```
"Signal strength S7, -100 dBm"
"Signal strength S9 plus 20 dB, -73 dBm"
```

## S-Meter Scale Reference

### HF Bands (< 30 MHz)

| S-Unit | Power Level | Description |
|--------|-------------|-------------|
| S0     | < -127 dBm  | No signal   |
| S1     | -121 dBm    | Barely perceptible |
| S3     | -109 dBm    | Very weak   |
| S5     | -97 dBm     | Weak        |
| S7     | -85 dBm     | Fair        |
| S9     | **-73 dBm** | **Reference** |
| S9+20  | -53 dBm     | Strong      |
| S9+40  | -33 dBm     | Very strong |
| S9+60  | -13 dBm     | Extremely strong |

### VHF/UHF Bands (≥ 30 MHz)

| S-Unit | Power Level | Description |
|--------|-------------|-------------|
| S0     | < -147 dBm  | No signal   |
| S1     | -141 dBm    | Barely perceptible |
| S3     | -129 dBm    | Very weak   |
| S5     | -117 dBm    | Weak        |
| S7     | -105 dBm    | Fair        |
| S9     | **-93 dBm** | **Reference** |
| S9+20  | -73 dBm     | Strong      |
| S9+40  | -53 dBm     | Very strong |
| S9+60  | -33 dBm     | Extremely strong |

Each S-unit below S9 represents 6 dB.

## Testing

### Unit Tests

```bash
npm test -- SMeter.test.tsx
```

39 comprehensive unit tests covering:
- Rendering (bar and segment styles)
- Signal strength indicators and color zones
- Calibration status display
- Accessibility (ARIA attributes, live regions)
- Visual updates and smoothing
- Edge cases

### E2E Tests

```bash
npm run test:e2e -- s-meter.spec.ts
```

10 E2E test scenarios with simulated signal injection:
- Rendering with different signal levels
- Color zone transitions
- S9+ format display
- dBm value display
- Band indicators (HF/VHF)
- Accessibility attributes
- Rapid signal changes
- Calibration indicators
- Segment style meter

## Performance

- **Smooth Updates**: Uses exponential moving average to prevent jitter
- **Rate-Limited Announcements**: Maximum 1 ARIA announcement per 2 seconds
- **Efficient Rendering**: Only re-renders when signal level changes
- **CSS Animations**: Uses hardware-accelerated CSS transitions

## Related Documentation

- [S-Meter Specification](../../docs/reference/s-meter-spec.md) - Complete technical specification
- [Signal Measurement](../../docs/reference/signal-analysis.md) - Signal analysis overview
- [SignalLevelService](../../src/lib/measurement/signal-level-service.ts) - Measurement service implementation

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Opera: Full support

Requires modern browser with:
- CSS custom properties
- CSS Grid
- ARIA live regions
- ES2020+ JavaScript

## License

Part of the rad.io project. See main project license.
