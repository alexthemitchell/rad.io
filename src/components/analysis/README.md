# ATSC Signal Analysis Components

A comprehensive suite of visualization and analysis tools for ATSC 8-VSB digital television signals.

## Components

### ATSCConstellation

Displays a constellation diagram specifically designed for ATSC 8-VSB signals, showing the 8 discrete amplitude levels used in digital television.

**Features:**
- Shows constellation points for received symbols
- Optional reference grid for ideal 8-VSB levels (-7, -5, -3, -1, +1, +3, +5, +7)
- Density-based coloring for better visualization
- Accessibility support with detailed descriptions

**Usage:**
```tsx
import { ATSCConstellation } from './components/analysis';

<ATSCConstellation
  samples={iqSamples}
  width={750}
  height={400}
  showReferenceGrid={true}
/>
```

### ATSCSpectrum

Visualizes the frequency spectrum of an ATSC signal with special markers for the pilot tone and channel bandwidth.

**Features:**
- Pilot tone marker at 309.44 kHz offset
- Channel bandwidth indicators (6 MHz)
- Frequency and power axis labels
- Customizable display options

**Usage:**
```tsx
import { ATSCSpectrum } from './components/analysis';

<ATSCSpectrum
  fftData={fftMagnitudes}
  centerFrequency={533e6}
  sampleRate={10e6}
  showPilotMarker={true}
  showBandwidthMarkers={true}
/>
```

### MERDisplay

Calculates and displays Modulation Error Ratio (MER) with quality assessment.

**Features:**
- Real-time MER calculation in dB
- Quality indicator (Excellent, Good, Fair, Poor, Very Poor)
- Optional detailed statistics (error power, signal power)
- Color-coded quality levels

**Usage:**
```tsx
import { MERDisplay } from './components/analysis';

<MERDisplay
  samples={iqSamples}
  referenceSymbols={idealLevels}
  showDetails={true}
/>
```

### BERCounter

Tracks and displays Bit Error Rate (BER) measurement.

**Features:**
- BER display in scientific notation
- Quality assessment based on error rate
- Optional detailed statistics (bit rate, error rate)
- Supports duration-based metrics

**Usage:**
```tsx
import { BERCounter } from './components/analysis';

<BERCounter
  totalBits={1000000}
  errorBits={100}
  duration={10}
  showDetails={true}
/>
```

### EqualizerVisualizer

Visualizes adaptive equalizer tap coefficients used for multipath correction.

**Features:**
- Bar chart of tap coefficients
- Color-coded taps (main signal vs. multipath echoes)
- Time-scale axis (in microseconds)
- Identifies significant multipath components

**Usage:**
```tsx
import { EqualizerVisualizer } from './components/analysis';

<EqualizerVisualizer
  taps={equalizerCoefficients}
  symbolRate={10.76e6}
  showTimeAxis={true}
/>
```

### ATSCEyeDiagram

Specialized eye diagram for ATSC 8-VSB signals showing symbol timing and quality.

**Features:**
- Overlaid symbol periods showing timing quality
- 8-VSB level markers for reference
- Sampling point indicator
- Customizable overlay count

**Usage:**
```tsx
import { ATSCEyeDiagram } from './components/analysis';

<ATSCEyeDiagram
  samples={iqSamples}
  periodSamples={128}
  maxOverlays={50}
  showLevelMarkers={true}
/>
```

### DataSegmentMonitor

Monitors ATSC data segment synchronization status.

**Features:**
- Sync lock status indicator
- Segment and field sync counters
- Sync confidence display
- Progress bar to next segment sync
- Detailed ATSC structure information

**Usage:**
```tsx
import { DataSegmentMonitor } from './components/analysis';

<DataSegmentMonitor
  syncLocked={true}
  segmentSyncCount={100}
  fieldSyncCount={3}
  syncConfidence={0.85}
  symbolsSinceSync={416}
  showDetails={true}
/>
```

## Integration Example

Here's a complete example integrating multiple analysis components:

```tsx
import React from 'react';
import {
  ATSCConstellation,
  ATSCSpectrum,
  MERDisplay,
  BERCounter,
  EqualizerVisualizer,
  ATSCEyeDiagram,
  DataSegmentMonitor,
} from './components/analysis';

function ATSCAnalysisDashboard({ demodulator, samples, fftData }) {
  return (
    <div className="atsc-analysis">
      <div className="row">
        <ATSCConstellation samples={samples} showReferenceGrid={true} />
        <ATSCEyeDiagram samples={samples} showLevelMarkers={true} />
      </div>
      
      <div className="row">
        <ATSCSpectrum
          fftData={fftData}
          centerFrequency={533e6}
          sampleRate={10e6}
        />
      </div>
      
      <div className="row">
        <MERDisplay samples={samples} showDetails={true} />
        <BERCounter
          totalBits={1000000}
          errorBits={100}
          duration={10}
          showDetails={true}
        />
        <DataSegmentMonitor
          syncLocked={demodulator.isSyncLocked()}
          segmentSyncCount={demodulator.getSegmentSyncCount()}
          fieldSyncCount={demodulator.getFieldSyncCount()}
          showDetails={true}
        />
      </div>
      
      <div className="row">
        <EqualizerVisualizer
          taps={demodulator.equalizer.taps}
          showTimeAxis={true}
        />
      </div>
    </div>
  );
}
```

## Technical Specifications

All components are built following these principles:

- **Performance**: Optimized canvas rendering with device pixel ratio support
- **Accessibility**: ARIA labels and semantic HTML for screen readers
- **Responsiveness**: Customizable dimensions for different layouts
- **Type Safety**: Full TypeScript type definitions
- **Testing**: Comprehensive test coverage (60 tests, 100% pass rate)

## ATSC 8-VSB Background

ATSC (Advanced Television Systems Committee) 8-VSB is the modulation scheme used for digital television broadcasting in North America:

- **Symbol Rate**: 10.76 Msymbols/sec
- **Channel Bandwidth**: 6 MHz
- **Pilot Tone**: 309.44 kHz offset from lower band edge
- **Symbol Levels**: 8 discrete amplitude levels (-7, -5, -3, -1, +1, +3, +5, +7)
- **Data Segment**: 832 symbols (4 sync + 828 data)
- **Field**: 313 data segments

These components are designed to help users analyze and debug ATSC reception by providing visual feedback on signal quality, timing, and demodulation performance.

## References

- ATSC Standard A/53: Digital Television Standard
- ATSC Recommended Practice A/54: Guide to the Use of the ATSC Digital Television Standard
- [ATSC8VSBDemodulator Documentation](../../plugins/demodulators/ATSC8VSBDemodulator.md)
