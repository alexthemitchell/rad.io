# Runtime Diagnostics Bus Implementation

## Overview

This implementation adds a lightweight diagnostics/event bus and health overlay for real-time monitoring of the signal processing pipeline. The system tracks key runtime metrics across the demodulator, TS parser, and decoders, displaying them in a user-friendly overlay.

## Components

### 1. Diagnostics Zustand Slice (`src/store/slices/diagnosticsSlice.ts`)

Centralized event bus for runtime metrics and diagnostics:

- **Event Management**: Tracks up to 100 recent diagnostic events with source, severity, message, and timestamp
- **Metrics Storage**: Maintains current metrics for:
  - Demodulator (SNR, MER, BER, sync lock, signal strength)
  - TS Parser (packet counts, error counts, table updates)
  - Video/Audio/Caption Decoders (drop counts, error counts, state)
- **Overlay Control**: Manages visibility state of the diagnostics overlay

### 2. DiagnosticsOverlay Component (`src/components/DiagnosticsOverlay.tsx`)

Real-time visual overlay displaying pipeline health:

- **Draggable Interface**: Users can move the overlay anywhere on screen
- **Minimize/Maximize**: Compact and detailed view modes
- **Color-Coded Status**: Visual indicators for good/warn/bad/unknown states
- **Metrics Display**:
  - Demodulator sync status, SNR, MER, BER
  - TS parser error rates and packet counts
  - Decoder states and drop counts
  - Recent diagnostic events

### 3. Instrumentation

#### ATSC8VSBDemodulator (`src/plugins/demodulators/ATSC8VSBDemodulator.ts`)

- Updates metrics every 500ms during demodulation
- Tracks sync lock state, segment/field sync counts
- Calculates signal quality metrics from actual demodulator state:
  - SNR: Calculated from slicer error variance (10\*log10(signal_power/noise_variance))
  - MER: Calculated from RMS slicer error (10\*log10(signal_power/mean_square_error))
  - BER: Estimated from symbol error rate using 1.5 threshold for significant errors
  - All metrics use rolling 100-symbol window, only available when sync locked
- Emits activation/deactivation events

#### TransportStreamParser (`src/parsers/TransportStreamParser.ts`)

- Updates metrics every 1000ms during parsing
- Monitors continuity errors, TEI errors, sync errors
- Tracks PAT/PMT table updates
- Counts total packets processed

## Integration Points

### ATSCPlayer Page

- "Diagnostics" button in header to show overlay
- Detailed mode enabled for comprehensive metrics view
- Monitors full ATSC reception pipeline

### Monitor Page

- Overlay available with "Diagnostics" button
- Detailed mode enabled for comprehensive metrics view
- Useful for SDR signal quality monitoring

## Usage

### For Users

1. **Open Diagnostics**: Click the "Diagnostics" button on ATSCPlayer or Monitor pages
2. **View Metrics**: See real-time signal quality and error information
3. **Drag to Reposition**: Click and drag the header to move the overlay
4. **Minimize**: Click the "−" button to show only the header
5. **Close**: Click the "×" button to hide the overlay

### For Developers

```typescript
import { useDiagnostics } from "../store";

// In a component
const { updateDemodulatorMetrics, addDiagnosticEvent } = useDiagnostics();

// Update metrics
updateDemodulatorMetrics({
  syncLocked: true,
  snr: 18.5,
  mer: 22.3,
  ber: 0.0001,
});

// Add diagnostic event
addDiagnosticEvent({
  source: "demodulator",
  severity: "warning",
  message: "Signal degradation detected",
});
```

## Testing

Comprehensive test coverage in `src/store/slices/__tests__/diagnosticsSlice.test.ts`:

- State initialization
- Event addition and limiting (max 100 events)
- Metrics updates and merging
- Event clearing and diagnostics reset
- Overlay visibility toggle

All tests passing ✓

## Future Enhancements

The system is designed to be extensible for:

1. **Additional Decoders**: Easy to add video/audio/caption decoder metrics
2. **Scanner Integration**: Can be added to Scanner page
3. **Advanced Metrics**: Real SNR/MER calculation from demodulator state; BER is still an estimate
4. **Export Functionality**: Could add ability to export diagnostic logs
5. **Historical Graphs**: Could visualize metric trends over time
6. **Alert Thresholds**: Could add configurable alerts for error conditions

## Performance Impact

- Minimal overhead: Updates only every 500ms-1000ms
- Metrics collection wrapped in try-catch to prevent failures
- No impact when overlay is hidden
- Store updates are batched and efficient

## Browser Compatibility

- Uses Zustand for state management (no Context API overhead)
- CSS Grid and Flexbox for layout
- Modern color functions with fallbacks
- Works in all modern browsers supporting WebUSB

## Related Documentation

- Issue: #add-runtime-diagnostics-bus
- ADR: Future ADR for diagnostics architecture
- Related: Section 2.3 of codebase analysis (unify-dsp-primitives)
