# Marker Analysis Features Guide

## Overview

The Spectrum Explorer now includes professional-grade measurement and analysis tools for quantitative signal analysis. These tools enable precise frequency and power measurements, essential for spectrum management, interference analysis, and signal characterization.

## Interactive Markers

### Placing Markers

**Method 1: Click on Spectrum**
- Single-click anywhere on the spectrum display
- Marker automatically snaps to the nearest spectral peak
- Power level at that frequency is captured automatically

**Method 2: Double-Click to Tune**
- Double-click on spectrum to tune the radio to that frequency
- Useful for quick frequency changes during monitoring

### Marker Display

Each marker shows:
- **Frequency**: Displayed with 6 decimal places in MHz (e.g., 162.550000 MHz)
- **Power Level**: Measured in dB at the marker position
- **Delta Frequency**: Difference in Hz from the previous marker
- **Delta Power**: Difference in dB from the previous marker
  - Positive deltas (gain) shown in blue
  - Negative deltas (loss) shown in red

### Marker Management

**Individual Removal**
- Click the "Remove" button next to any marker in the table
- Useful when you only want to remove specific measurements

**Clear All Markers**
- Click the "Clear Markers" button in the controls
- Instantly removes all markers from the display and table

**Export to CSV**
- Click "Export CSV" button in the marker table
- Downloads a CSV file with all marker data:
  - `id`: Unique marker identifier
  - `freqHz`: Frequency in Hz
  - `freqMHz`: Frequency in MHz
  - `powerDb`: Power level in dB
  - `deltaFreqHz`: Frequency difference from previous marker
  - `deltaPowerDb`: Power difference from previous marker
  - `label`: Optional marker label

## Peak Hold Mode

### What is Peak Hold?

Peak Hold mode captures and displays the maximum power level detected at each frequency bin over time. This is essential for:
- Detecting intermittent signals that may not be visible in real-time
- Measuring peak power of burst transmissions
- Finding hidden signals in noisy environments
- Analyzing duty cycle and transmission patterns

### Using Peak Hold

**Enable Peak Hold**
1. Check the "Peak Hold" checkbox in the controls
2. Or press `P` on your keyboard (when spectrum has focus)

**Clear Peak Hold Data**
- Click the "Clear Peak Hold" button (appears when peak hold is active)
- Resets all accumulated peak values
- Useful when switching to a different frequency range

**Keyboard Shortcuts**
- `P`: Toggle peak hold on/off
- `G`: Toggle grid display
- `R`: Toggle RBW (resolution bandwidth) display

## Measurement Workflows

### Bandwidth Measurement

**Goal**: Measure the bandwidth of a signal

1. Enable Peak Hold to capture the full signal extent
2. Wait for the signal to transmit (if intermittent)
3. Place a marker at the lower edge of the signal
4. Place a marker at the upper edge of the signal
5. Read the delta frequency in the marker table
6. Export to CSV for documentation

**Example**: FM broadcast station
- Lower edge marker: 100.900 MHz
- Upper edge marker: 101.100 MHz
- Delta frequency: 200,000 Hz (200 kHz)
- Result: Standard FM channel bandwidth

### Channel Spacing Verification

**Goal**: Verify proper channel spacing in a communications system

1. Place markers on adjacent channel center frequencies
2. Read delta frequency values
3. Compare with specification
4. Export measurements for compliance reporting

**Example**: Amateur radio repeater band
- Channel 1: 146.520 MHz
- Channel 2: 146.535 MHz
- Delta: 15,000 Hz (15 kHz)
- Result: Standard 15 kHz spacing confirmed

### Signal Strength Comparison

**Goal**: Compare relative power levels of multiple signals

1. Place markers on each signal of interest
2. Review power levels in the marker table
3. Compare delta power values
4. Use for link budget analysis or antenna testing

**Example**: Comparing two transmitters
- Transmitter A: -45.2 dB
- Transmitter B: -50.5 dB
- Delta: -5.3 dB (Transmitter B is 5.3 dB weaker)

### Interference Analysis

**Goal**: Identify and measure interfering signals

1. Enable Peak Hold to capture intermittent interference
2. Place markers on both the desired signal and interferer
3. Measure frequency separation (delta frequency)
4. Measure relative power levels (delta power)
5. Export data for interference report

**Example**: Identifying adjacent channel interference
- Desired signal: 162.550 MHz at -40 dB
- Interferer: 162.565 MHz at -38 dB
- Frequency separation: 15,000 Hz
- Power difference: +2 dB (interferer is stronger!)
- Action: Investigate source of interference

## Best Practices

### Marker Placement
- Use Peak Hold to ensure you're marking the true peak
- Click near the signal of interest; the marker will snap to the nearest peak
- Place markers in logical order (low to high frequency) for easier delta interpretation

### Data Export
- Export marker data regularly during analysis sessions
- Include timestamp in your analysis notes (not in CSV)
- Use exported data in spreadsheet tools for graphs and reports

### Peak Hold Usage
- Clear peak hold when changing frequency ranges
- Allow sufficient time for intermittent signals to appear
- Combine with video averaging for smoother display

### Measurement Accuracy
- Larger FFT size = better frequency resolution
- Higher RBW = faster updates, lower RBW = better resolution
- Allow signal to stabilize before taking measurements

## Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| `P` | Toggle Peak Hold |
| `G` | Toggle Grid |
| `R` | Toggle RBW Display |
| Single Click | Place Marker |
| Double Click | Tune to Frequency |
| `Ctrl+Scroll` | Zoom In/Out |
| Drag | Pan View |

## Technical Details

### Marker Precision
- Frequency: 6 decimal places in MHz (1 Hz resolution)
- Power: 2 decimal places in dB (0.01 dB resolution)
- Delta calculations: Computed between consecutive markers

### Peak Hold Implementation
- Per-bin maximum tracking
- Persists across updates until cleared
- Independent of video averaging

### CSV Export Format
```csv
id,freqHz,freqMHz,powerDb,deltaFreqHz,deltaPowerDb,label
1234567890-512,162550000,162.550000,-45.20,,,
1234567891-645,162565000,162.565000,-38.15,15000,7.05,
```

## Troubleshooting

**Marker doesn't appear after clicking**
- Ensure you're clicking within the spectrum plot area
- Check that there's valid spectrum data (signal should be receiving)
- Try clicking on a visible peak

**Delta values show "—"**
- This is normal for the first marker (no previous reference)
- Ensure power data is available for both markers

**Peak hold not working**
- Verify Peak Hold checkbox is checked
- Click "Clear Peak Hold" and try again
- Check that signal is actually present

**CSV export not downloading**
- Check browser download settings
- Ensure pop-up blocker isn't active
- Try a different browser if issues persist

## Related Documentation

- [Visualization Architecture](VISUALIZATION_ARCHITECTURE.md)
- [Spectrum Explorer Component](../src/visualization/components/SpectrumExplorer.tsx)
- [Marker Table Component](../src/components/MarkerTable.tsx)
- [E2E Tests](../e2e/marker-analysis.spec.ts)
