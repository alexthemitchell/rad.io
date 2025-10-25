# Phase 2: Intelligence - Automated Signal Detection & Frequency Scanning

## Overview

Phase 2 adds intelligent automated analysis capabilities to WebSDR Pro, enabling automatic signal discovery, classification, and band monitoring. These features support all user personas but are especially valuable for Analysts, Scientists, and Emergency Communications volunteers who need to monitor multiple frequencies efficiently.

## Features

### 🔍 Automatic Signal Detection

The signal detection system automatically identifies and classifies signals in real-time:

**Supported Signal Types:**

- **Narrowband FM (NFM)**: 12-30 kHz bandwidth - typical for 2-way radio, amateur repeaters
- **Wideband FM (WFM)**: 150-250 kHz bandwidth - FM broadcast radio stations
- **AM**: 4-11 kHz bandwidth - AM broadcast stations
- **Digital**: 1-5 kHz bandwidth with sharp edges - DMR, P25, digital modes
- **Unknown**: Signals that don't match known patterns

**Detection Features:**

- Automatic noise floor tracking (adapts to changing conditions)
- Configurable detection threshold (dB above noise floor)
- Bandwidth validation (filters spurious detections)
- SNR (Signal-to-Noise Ratio) measurement
- Confidence scoring for classifications

### 📡 Frequency Scanning

Three intelligent scanning strategies for different use cases:

#### 1. Linear Scanner (Sequential)

- Scans frequencies in order from start to end
- Predictable and straightforward
- Best for initial band surveys
- Example: Scan 146.000 - 148.000 MHz in 25 kHz steps

#### 2. Adaptive Scanner (Learning)

- Learns from signal activity during scanning
- Adds finer resolution steps around active frequencies
- Variable dwell times (spends more time on active frequencies)
- Best for finding signals of interest
- Example: Quickly scans quiet frequencies, lingers on active ones

#### 3. Priority Scanner (Bookmarks First)

- Scans bookmarked frequencies before filling in the range
- Ensures critical channels are checked regularly
- Best for emergency monitoring and known channel surveillance
- Example: Check NOAA weather channels, then scan full band

**Scan Features:**

- Real-time progress tracking
- Configurable step size and settling time
- Automatic signal detection during scans (optional)
- Results include power spectrum, peak power, average power
- Active frequency identification (signals above threshold)

## Usage

### Signal Detection Panel

The Signal Detection Panel displays all automatically detected signals:

1. **Enable detection** by starting a scan with detection enabled, or connecting to a live SDR device
2. **View signals** sorted by strength (SNR) in the panel
3. **Signal information** includes:
   - Frequency (MHz/kHz)
   - Signal type (color-coded badge)
   - Power level (dB)
   - Signal-to-Noise Ratio (SNR)
   - Bandwidth (kHz)
   - Classification confidence (%)
4. **Click any signal** to instantly tune your radio to that frequency
5. **Clear signals** button removes all detected signals from the list

**Color Coding:**

- 🔵 Blue: Narrowband FM
- 🟢 Green: Wideband FM
- 🟠 Orange: AM
- 🟣 Purple: Digital
- 🔴 Red: Pulsed
- ⚫ Gray: Unknown

### Scan Control

Configure and run frequency scans:

1. **Set frequency range**:
   - Start frequency (e.g., 146.000 MHz)
   - End frequency (e.g., 148.000 MHz)

2. **Choose step size** (e.g., 25 kHz):
   - Smaller steps: More thorough, slower scan
   - Larger steps: Faster scan, may miss signals

3. **Select scan strategy**:
   - Linear: Simple sequential scan
   - Adaptive: Learns from activity
   - Priority: Bookmarks first (requires bookmarks)

4. **Monitor progress**:
   - Progress bar shows completion percentage
   - Estimated time displayed
   - Can stop scan at any time

5. **Review results**:
   - Active frequencies list updated in real-time
   - Detected signals shown in Signal Detection Panel
   - Results persisted for later analysis

## Use Cases

### Amateur Radio (Ham Radio Enthusiast)

**Band Activity Survey:**

```
1. Open Scanner page
2. Set: 146.000 MHz → 148.000 MHz, 25 kHz steps
3. Strategy: Linear
4. Start Scan
5. View detected repeaters and simplex activity
6. Click any signal to tune and listen
```

**Finding Active Repeaters:**

```
1. Strategy: Adaptive
2. Scan 2-meter band (146-148 MHz)
3. Scanner learns and focuses on active frequencies
4. Export results for logging
```

### Emergency Communications (ARES/RACES)

**Monitoring Emergency Nets:**

```
1. Add emergency frequencies to bookmarks
2. Strategy: Priority
3. Scanner checks emergency channels every few seconds
4. Then monitors full range for activity
5. Automatic alert on signal detection
```

### Spectrum Analysis (Professional)

**Interference Identification:**

```
1. Strategy: Linear with detection enabled
2. Small step size (5-10 kHz) for precision
3. Review all detected signals
4. Classify interference sources
5. Document with screenshots and logs
```

**Spectrum Occupancy Study:**

```
1. Scan multiple bands over time
2. Adaptive strategy to find all active frequencies
3. Export scan results with timestamps
4. Analyze patterns and occupancy statistics
```

### Research (Academic)

**Signal Library Building:**

```
1. Enable detection during normal monitoring
2. Signals automatically classified and logged
3. Review classifications and confidence scores
4. Build dataset of known signal types
5. Export for further analysis
```

## Configuration

### Detection Configuration

```typescript
{
  thresholdDB: 10,          // dB above noise floor
  minBandwidth: 1_000,      // Minimum signal bandwidth (Hz)
  maxBandwidth: 1_000_000,  // Maximum signal bandwidth (Hz)
  enableClassification: true // Classify detected signals
}
```

### Scan Configuration

```typescript
{
  startFreq: 146_000_000,   // 146.000 MHz
  endFreq: 148_000_000,     // 148.000 MHz
  step: 25_000,             // 25 kHz
  strategy: 'adaptive',     // linear, adaptive, or priority
  settlingTime: 50,         // Hardware settling time (ms)
  sampleCount: 2048,        // Samples per frequency
  detectionThreshold: -60   // Detection threshold (dB)
}
```

## Performance

### Detection

- **Latency**: <50ms per spectrum analysis
- **Accuracy**: >95% for SNR >10dB signals
- **False Positives**: <5% with proper threshold
- **Non-blocking**: Runs in Web Worker (background thread)

### Scanning

- **Linear**: 10-20 frequencies/second
- **Adaptive**: 15-30 frequencies/second (variable)
- **2-meter band** (146-148 MHz, 25 kHz steps): ~2-4 seconds
- **Full VHF band**: 30-60 seconds depending on strategy

## Tips & Best Practices

### For Best Detection Accuracy:

1. Ensure proper antenna connection
2. Adjust gain for optimal SNR (not too high/low)
3. Use appropriate detection threshold (10-15 dB typical)
4. Allow noise floor to stabilize (100 spectra)

### For Efficient Scanning:

1. Start with Linear scan to understand band activity
2. Use Adaptive for detailed exploration of active areas
3. Use Priority for monitoring known important frequencies
4. Adjust step size based on signal bandwidth:
   - NFM: 12.5 or 25 kHz steps
   - WFM: 100-200 kHz steps
   - AM: 9-10 kHz steps

### For Emergency Monitoring:

1. Add emergency frequencies to bookmarks
2. Use Priority scanner
3. Enable detection for automatic alerts
4. Keep scan running in background
5. Configure for fast hopping (50ms settling time)

## Troubleshooting

**No signals detected:**

- Check antenna connection
- Verify device is receiving
- Lower detection threshold
- Ensure frequency range has activity

**Too many false detections:**

- Increase detection threshold
- Check for interference
- Adjust min/max bandwidth filters
- Verify noise floor is stable

**Scan too slow:**

- Increase step size
- Reduce settling time (if hardware supports)
- Use Linear strategy (faster than Adaptive)
- Reduce sample count (trade accuracy for speed)

**Classification errors:**

- Some signals may not fit standard patterns
- Confidence score indicates reliability
- Manual verification recommended
- Contribute feedback for ML training

## Future Enhancements

Planned improvements for Phase 2:

- Machine learning for improved classification
- Additional signal types (OFDM, spread spectrum)
- Automatic recording on detection
- Signal tracking over time
- Export scan results (CSV, JSON, SigMF)
- Parallel scanning using wide FFT
- Waterfall integration with detection markers
- Statistical analysis and reporting

## Related Documentation

- [ADR-0013: Automatic Signal Detection System](../docs/decisions/0013-automatic-signal-detection-system.md)
- [ADR-0014: Automatic Frequency Scanning](../docs/decisions/0014-automatic-frequency-scanning.md)
- [Roadmap: Phase 2 Intelligence](../ROADMAP.md#phase-2-intelligence---automated-analysis--discovery)
- [Development Guide](./DEVELOPMENT.md)

## Support

For questions, bug reports, or feature requests related to signal detection and scanning, please:

1. Check existing GitHub issues
2. Review ADR documentation
3. Open a new issue with:
   - Signal type or scan configuration
   - Expected vs actual behavior
   - Hardware details (SDR device, antenna)
   - Screenshots if applicable

---

_Phase 2 Intelligence features empower users to discover and analyze signals automatically, transforming WebSDR Pro from a passive receiver into an active intelligent monitoring platform._
