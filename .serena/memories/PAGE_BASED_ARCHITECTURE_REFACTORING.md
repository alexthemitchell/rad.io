# Page-Based Architecture Refactoring

## Overview

Refactored monolithic Visualizer.tsx (856 lines) into three intent-based pages following common SDR user workflows: discover → monitor → analyze.

## Page Structure

### 1. LiveMonitor (/)

**Purpose**: Primary monitoring interface for active signal reception
**Key Features**:

- Device connection controls (Connect, Start/Stop Reception, Disconnect)
- Radio controls (frequency, bandwidth, signal type selection)
- Preset stations for quick tuning
- P25 trunked radio controls
- Audio playback with demodulation (FM/AM)
- Real-time visualizations:
  - IQ Constellation Diagram
  - Amplitude Waveform
  - Spectrogram (FFT)
  - Signal Strength Meter
- Device diagnostics panel

**State Management**:

- Handles location.state for frequency tuning from Scanner
- Shares device via useHackRFDevice hook
- Manages audio processing pipeline
- Sample buffer management with 30 FPS throttling

### 2. Scanner (/scanner)

**Purpose**: Frequency discovery and P25 talkgroup monitoring
**Key Features**:

- Signal type selector (FM/AM/P25)
- Frequency scanner with configurable range/step/threshold
- Active signals list with strength indicators
- "Tune" button navigates to LiveMonitor with selected frequency
- P25 talkgroup scanner
- Export scan results to JSON

**Navigation Integration**:

- onTuneToSignal prop added to FrequencyScanner component
- Navigates to "/" with { frequency, signalType } in location.state
- Scanner maintains minimal state, device shared via hook

### 3. Analysis (/analysis)

**Purpose**: Deep signal analysis and performance monitoring
**Key Features**:

- Interactive DSP Pipeline visualization
- Performance metrics (FPS, processing times)
- Future: IQ recording/export capabilities
- Auto-connects to device streaming if already receiving

**Architecture Notes**:

- Passive receiver - doesn't control device
- Monitors samples if device.isReceiving()
- Minimal state - focuses on visualization

## Technical Implementation

### Routing

- React Router v6 with BrowserRouter
- Routes defined in App.tsx
- Navigation component with NavLink for active state styling

### State Sharing

- Device state: useHackRFDevice() hook (singleton pattern)
- Sample data: Per-page buffers, not shared
- Audio processing: LiveMonitor only
- Scanner state: useFrequencyScanner() hook

### Navigation Flow

```typescript
Scanner → finds signal at 100.5 MHz
  → User clicks "Tune"
  → navigate("/", { state: { frequency: 100.5e6, signalType: "FM" } })
  → LiveMonitor receives state in useEffect
  → device.setFrequency(100.5e6)
  → User starts reception to listen
```

### Styling

- Navigation: `.main-nav`, `.nav-link`, `.nav-link.active`
- Responsive: Mobile vertical layout at 768px breakpoint
- Visual feedback: Active page highlighted with white background

## Migration Notes

- Original Visualizer.tsx preserved (not used)
- All existing components reused without modification (except FrequencyScanner)
- FrequencyScanner enhanced with optional onTuneToSignal callback
- Zero breaking changes to component APIs
- All 404 existing tests pass

## Performance Considerations

- Each page manages its own sample buffer (32768 samples max)
- Only LiveMonitor runs audio processing pipeline
- Analysis page has minimal overhead (no audio, passive sampling)
- 30 FPS throttling maintained across all pages

## Future Enhancements

- IQ data recording/export in Analysis page
- Signal bookmarking across pages
- Multi-device support with device selector
- Persistent user preferences (localStorage)
- Advanced DSP controls in Analysis page
