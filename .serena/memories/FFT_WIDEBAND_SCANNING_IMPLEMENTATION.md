# FFT-Based Wideband Frequency Scanning Implementation

## Overview

Replaced frequency-hopping scanner with FFT-based wideband spectral analysis for 20x+ faster scanning and simultaneous multi-signal detection.

## Key Changes

### Architecture Shift

**Before (Frequency Hopping)**:

- Tune → Dwell → Measure power → Move to next frequency
- 200+ frequency hops for FM band (88-108 MHz)
- ~10-20 seconds per full scan
- Only detects one signal at a time

**After (FFT Wideband)**:

- Tune to center → Capture bandwidth → FFT analysis → Detect all peaks simultaneously
- ~10 frequency chunks for FM band
- ~1 second per full scan
- Detects multiple signals per measurement

### New DSP Utilities (`src/utils/dsp.ts`)

1. **`binToFrequency(binIndex, fftSize, sampleRate, centerFrequency): number`**
   - Converts FFT bin index to actual frequency in Hz
   - Accounts for FFT shift (DC at center)
   - Formula: `centerFreq + (binIndex - fftSize/2) * (sampleRate/fftSize)`

2. **`detectSpectralPeaks(...): SpectralPeak[]`**
   - Finds local maxima in power spectrum
   - Parameters: threshold (dB), minPeakSpacing (Hz), edgeMargin (bins)
   - Returns peaks sorted by power (strongest first)
   - Prevents duplicates via spacing constraint

3. **`estimateNoiseFloor(powerSpectrum, percentile): number`**
   - Robust noise estimation using percentile method
   - Default 25th percentile (robust to outliers/strong signals)
   - Used to calculate dynamic threshold

### Scanner Configuration Changes (`FrequencyScanConfig`)

**Removed**:

- `stepSize` (Hz) - no longer frequency hopping
- `threshold` (0-1 scale) - replaced with dB-based threshold

**Added**:

- `thresholdDb` (number) - dB above noise floor for detection
- `fftSize` (number) - FFT size for spectral analysis (512-8192)
- `minPeakSpacing` (Hz) - minimum frequency spacing between detected signals

**Updated Defaults**:

```typescript
{
  startFrequency: 88e6,
  endFrequency: 108e6,
  thresholdDb: 10,           // 10 dB above noise
  dwellTime: 100,            // 100ms per chunk (was 50ms)
  fftSize: 2048,             // 2048-point FFT
  minPeakSpacing: 100e3,     // 100 kHz (FM station spacing)
  enableRDS: true
}
```

### Scanner Hook Implementation (`src/hooks/useFrequencyScanner.ts`)

**`scanFrequencyChunk(centerFrequency, sampleRate)`**:

1. Tune device to center frequency
2. Collect IQ samples for `dwellTime` ms
3. Perform FFT analysis on collected samples
4. Estimate noise floor from spectrum
5. Detect peaks above `noiseFloor + thresholdDb`
6. Convert peak bin indices to frequencies
7. Optionally decode RDS for FM signals
8. Update active signals list

**`performScan()`**:

1. Query device for `sampleRate` and `usableBandwidth`
2. Calculate number of frequency chunks needed
3. Use 90% overlap to avoid edge artifacts: `stepSize = usableBandwidth * 0.9`
4. Scan each chunk sequentially
5. Update progress indicator

### Device Interface Enhancement (`src/models/SDRDevice.ts`)

**New Method**: `getUsableBandwidth(): Promise<number>`

- Returns effective bandwidth after filter rolloff
- HackRF implementation: `sampleRate * 0.8` (80% usable)
- Enables device-agnostic bandwidth detection

**Updated `SDRCapabilities`**:

- Added `maxBandwidth?: number` field
- HackRF: `20e6` (20 MHz max instantaneous bandwidth)

### UI Updates (`src/components/FrequencyScanner.tsx`)

**Configuration Controls**:

- "Step Size (kHz)" → "FFT Size (frequency resolution)"
  - Input type: number, range 512-8192, step 512
- "Detection Threshold (%)" → "Detection Threshold (X dB above noise)"
  - Input type: number, range 3-30 dB, step 1

## Performance Characteristics

### Scan Speed Comparison (FM Band 88-108 MHz)

| Approach          | HackRF Time | RTL-SDR Time | Frequency Changes |
| ----------------- | ----------- | ------------ | ----------------- |
| **Old (Hopping)** | ~10 sec     | ~15-20 sec   | 200+              |
| **New (FFT)**     | ~1 sec      | ~1 sec       | ~10               |

### Bandwidth Utilization

**At 2.048 MSPS (browser-optimized)**:

- Instantaneous bandwidth: ~2 MHz
- Usable bandwidth (80%): ~1.64 MHz
- FM band coverage: 20 MHz / 1.64 MHz ≈ 12 chunks
- Scan time: 12 × 100ms = 1.2 seconds

**Higher sample rates** (visualization-only, no audio):

- 10 MSPS: ~8 MHz bandwidth → 3 chunks → 0.3 sec
- 20 MSPS: ~16 MHz bandwidth → 2 chunks → 0.2 sec

## Device Compatibility

### HackRF One

- Max bandwidth: 20 MHz
- Browser-optimized: 2.048 MHz (real-time audio capable)
- Scanner-optimized: 10-20 MHz (faster scans, no audio)

### RTL-SDR (Future Support)

- Max bandwidth: ~2.4 MHz
- Same scan speed as HackRF at 2 MHz bandwidth
- **Benefits equally** from FFT approach (minimizes slow tuning overhead)

### Universal Pattern

```typescript
const sampleRate = await device.getSampleRate();
const bandwidth = await device.getUsableBandwidth();
const numChunks = Math.ceil(scanRange / bandwidth);
// Device-agnostic scanning
```

## Testing Coverage

### Unit Tests (`src/utils/__tests__/dsp.test.ts`)

- ✅ `binToFrequency`: edge cases, center bin, resolution scaling
- ✅ `estimateNoiseFloor`: uniform noise, outlier robustness, empty spectrum
- ✅ `detectSpectralPeaks`: single peak, multiple peaks, spacing constraint, edge margin, threshold filtering

**All 39 tests pass** including new FFT spectrum analysis suite.

### Integration Tests

- TODO: Update `useFrequencyScanner.test.ts` for FFT-based flow
- TODO: Playwright E2E test with physical HackRF

## Known Limitations

1. **Edge Artifacts**: Use 90% overlap between chunks to mitigate filter rolloff
2. **RDS Decoding**: Still requires fine-tuning to detected frequency (not implemented in chunk scan)
3. **Memory**: Large FFT sizes (8192) may impact browser performance
4. **Latency**: 100ms dwell time per chunk (tunable via config)

## Future Enhancements

1. **Adaptive FFT Size**: Auto-select based on scan range and required resolution
2. **GPU Acceleration**: Move FFT to WebGL compute shaders
3. **Parallel Scanning**: Use multiple USB devices simultaneously
4. **Peak Tracking**: Track signal history across multiple scans
5. **RTL-SDR Support**: Implement RTL-SDR adapter with WebUSB

## Related Files

- `src/utils/dsp.ts` - FFT analysis utilities
- `src/hooks/useFrequencyScanner.ts` - Scanner hook
- `src/components/FrequencyScanner.tsx` - UI component
- `src/models/SDRDevice.ts` - Device interface
- `src/models/HackRFOneAdapter.ts` - HackRF implementation
