# Phase 2 Intelligence Implementation Guide

## Overview

Phase 2 adds automated signal detection and frequency scanning capabilities to rad.io, implementing ADR-0013 (Signal Detection) and ADR-0014 (Frequency Scanning).

## Architecture

### Signal Detection System

**Components:**
- `NoiseFloorEstimator`: Tracks background noise using median-based algorithm (resistant to signals)
- `PeakDetector`: Identifies peaks above threshold with bandwidth validation
- `SignalClassifier`: Classifies signals as FM (narrow/wide), AM, digital, or unknown
- `DetectionManager`: Coordinates detection in Web Worker (non-blocking)
- `detection-worker.ts`: Performs detection in background thread

**Signal Types:**
- Narrowband FM: 12-30 kHz (e.g., 2-way radio)
- Wideband FM: 150-250 kHz (e.g., broadcast radio)
- AM: 4-11 kHz (e.g., AM broadcast)
- Digital: 1-5 kHz with sharp edges (e.g., DMR, P25)
- Unknown: Doesn't match patterns

**Detection Flow:**
1. Spectrum → NoiseFloorEstimator → noise floor estimate
2. Noise floor + threshold → PeakDetector → peaks
3. Peaks + spectrum → SignalClassifier → classified signals

### Frequency Scanning System

**Scan Strategies:**

1. **Linear Scanner** (`linear-scanner.ts`): Sequential scan through frequency range
   - Predictable, straightforward
   - Best for initial surveys

2. **Adaptive Scanner** (`adaptive-scanner.ts`): Learns from detections
   - Adds finer steps around active signals
   - Variable dwell times based on activity
   - Best for finding signals of interest

3. **Priority Scanner** (`priority-scanner.ts`): Scans bookmarks first
   - Priority frequencies scanned first
   - Then fills in full range
   - Best for monitoring known channels

**ScanManager:** Coordinates scans with configurable strategies, progress events, and optional detection integration

### React Integration

**Hooks:**

`useDetection(enableAutoDetection)`:
- Returns: signals, noiseFloor, detectionManager, isInitialized
- Methods: clearSignals(), setConfig()

`useScan(enableDetection)`:
- Returns: isScanning, scanId, results, progress, activeFrequencies
- Methods: startScan(), stopScan(), clearResults()

**UI Components:**

`SignalDetectionPanel`: Displays detected signals with:
- Signal type badges (color-coded)
- Power, SNR, bandwidth, confidence
- Click to tune functionality
- Sort by SNR (strongest first)

`ScanControl`: Scan configuration UI with:
- Start/end frequency inputs
- Step size configuration
- Strategy selection (linear/adaptive/priority)
- Progress bar with percentage
- Estimated time calculation

## Usage Examples

### Basic Detection

```typescript
import { useDetection } from './hooks/useDetection';
import { SignalDetectionPanel } from './components/SignalDetectionPanel';

function MyComponent() {
  const { signals, noiseFloor, clearSignals } = useDetection(true);
  
  return (
    <SignalDetectionPanel
      signals={signals}
      noiseFloor={noiseFloor}
      onTuneToSignal={(freq) => device.setFrequency(freq)}
      onClearSignals={clearSignals}
    />
  );
}
```

### Basic Scanning

```typescript
import { useScan } from './hooks/useScan';
import { ScanControl } from './components/ScanControl';

function MyComponent({ device }) {
  const { isScanning, progress, results, startScan, stopScan } = useScan(true);
  
  return (
    <ScanControl
      isScanning={isScanning}
      progress={progress}
      onStartScan={(config) => startScan(config, device)}
      onStopScan={stopScan}
    />
  );
}
```

### Combined Detection + Scanning

```typescript
const detection = useDetection(true);
const scan = useScan(true); // Enable detection during scan

// Start scan - signals will be detected automatically
scan.startScan({
  startFreq: 146_000_000,
  endFreq: 148_000_000,
  step: 25_000,
  strategy: 'adaptive',
}, device);

// Detected signals appear in detection.signals
```

## File Locations

**Detection:**
- `src/lib/detection/noise-floor.ts`
- `src/lib/detection/peak-detector.ts`
- `src/lib/detection/signal-classifier.ts`
- `src/lib/detection/detection-manager.ts`
- `src/workers/detection-worker.ts`

**Scanning:**
- `src/lib/scanning/linear-scanner.ts`
- `src/lib/scanning/adaptive-scanner.ts`
- `src/lib/scanning/priority-scanner.ts`
- `src/lib/scanning/scan-manager.ts`
- `src/lib/scanning/types.ts`

**React:**
- `src/hooks/useDetection.ts`
- `src/hooks/useScan.ts`
- `src/components/SignalDetectionPanel.tsx`
- `src/components/ScanControl.tsx`

## Testing

**Coverage:**
- Detection: 24 tests (noise floor, peak detection, classification)
- Scanning: 14 tests (linear, adaptive scanners)
- Hooks: 17 tests (useDetection, useScan)
- Total: 55 new tests, all passing

**Run tests:**
```bash
npm test -- src/lib/detection
npm test -- src/lib/scanning
npm test -- src/hooks/__tests__/useDetection
npm test -- src/hooks/__tests__/useScan
```

## Performance Characteristics

**Detection:**
- Target latency: <50ms per spectrum
- Noise floor history: 100 spectra (configurable)
- Worker-based: Non-blocking main thread

**Scanning:**
- Linear: 10-20 steps/second
- Adaptive: 15-30 steps/second (varies)
- Default settling time: 50ms (configurable)
- Sample count: 2048 (configurable)

## Integration Points

To integrate into existing pages:

1. Import hooks and components
2. Initialize detection/scanning with device
3. Render UI components
4. Handle tune-to-signal callbacks
5. Display scan results

See `src/pages/Scanner.tsx` and `src/pages/Analysis.tsx` for integration examples.

## Known Limitations

- Classification accuracy depends on signal quality
- AM/NFM boundary at 12 kHz (some overlap possible)
- Digital classification requires sharp edges (may miss some)
- Adaptive scanner needs initial scan to learn
- Priority scanner requires bookmarks to be effective

## Future Enhancements

- Machine learning for better classification
- More signal types (pulsed, OFDM)
- Parallel scanning using wide FFT
- Signal tracking over time
- Automatic recording of detected signals
- Export scan results to CSV/JSON
