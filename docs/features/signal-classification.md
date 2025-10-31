# Signal Classification Feature

## Overview

The frequency scanner now automatically classifies detected signals by modulation type using bandwidth analysis and spectral characteristics. This eliminates the need for manual identification of signal types.

## Implementation

### Signal Classifier

The `SignalClassifier` class (located in `src/lib/detection/signal-classifier.ts`) analyzes detected peaks and classifies them based on:

- **Bandwidth**: Width of the signal in the frequency domain
- **Edge Sharpness**: How quickly power drops at signal edges (for digital signals)
- **Spectral Characteristics**: Power distribution across frequencies

### Classification Algorithm

The classifier uses a heuristic-based approach with priority-ordered rules:

1. **Digital Signals** (1-5 kHz): Check first for sharp edges that distinguish digital from AM
2. **AM Signals** (4-12 kHz): Moderate bandwidth without sharp edges
3. **Narrowband FM** (12-30 kHz): Common for two-way radio
4. **Wideband FM** (150-250 kHz): Commercial FM broadcast

### Signal Types

| Type | Bandwidth | Confidence | Common Uses |
|------|-----------|------------|-------------|
| WFM (Wideband FM) | 150-250 kHz | 90% | Commercial FM radio (88-108 MHz) |
| NFM (Narrowband FM) | 12-30 kHz | 80% | Two-way radio, repeaters, amateur |
| AM | 4-12 kHz | 70% | AM radio, aviation, amateur bands |
| Digital | 1-5 kHz (sharp edges) | 60% | Digital voice, data modes (DMR, P25) |
| Unknown | Outside ranges | 0% | Unrecognized modulation patterns |

## UI Integration

### Active Signals Table

The scanner UI now includes a "Type" column that displays:

- **Signal Type**: Short code (WFM, NFM, AM, Digital)
- **Confidence**: Percentage indicating classification certainty (e.g., "WFM (90%)")

Example table row:
```
Frequency  | Strength | Type       | Station | RDS Info | Time
98.100 MHz | 85.0%    | WFM (90%)  | WXYZ    | Rock 98  | 12:34:56
```

### Color Coding

- Signal types are displayed in purple monospace font for consistency
- Confidence scores help users understand classification reliability

## Data Export

JSON exports now include classification data:

```json
{
  "frequency": 98100000,
  "strength": 0.85,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "type": "wideband-fm",
  "confidence": 0.9,
  "rdsData": {
    "ps": "WXYZ",
    "rt": "Rock 98"
  }
}
```

## Testing

Comprehensive test coverage includes:

- Classification algorithm tests (`src/lib/detection/__tests__/signal-classifier.test.ts`)
- UI rendering tests (`src/components/__tests__/FrequencyScanner.test.tsx`)
- Integration tests in scanner hook (`src/hooks/__tests__/useFrequencyScanner.test.ts`)

Test scenarios:
- Classification of known signal types
- Display of type and confidence in UI
- Unknown signal handling
- Edge cases and boundary conditions

## Performance

- **Minimal Overhead**: Classification happens once per detected signal
- **No Additional I/O**: Uses existing FFT data from peak detection
- **Memory Efficient**: No additional sample storage required

## Future Enhancements

Potential improvements for future releases:

1. **Machine Learning**: Train ML model on real-world signal captures
2. **Additional Types**: P25, DMR, TETRA, APCO-25
3. **Multi-Signal**: Classify overlapping signals in same bandwidth
4. **Time-Domain**: Analyze pulse patterns for pulsed signals
5. **User Feedback**: Allow manual corrections to improve classification

## References

- ADR-0013: Automatic Signal Detection System
- RTL-SDR Automatic Modulation Classification: https://www.rtl-sdr.com/simple-automatic-modulation-classification/
- Signal Processing literature on bandwidth estimation and edge detection
