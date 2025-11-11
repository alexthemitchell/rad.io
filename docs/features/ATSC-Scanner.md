# ATSC Channel Scanner

The ATSC Channel Scanner is a comprehensive tool for discovering and monitoring ATSC (Advanced Television Systems Committee) digital television broadcasts across VHF and UHF frequencies.

## Features

### Channel Scanning

- **VHF-Low Band (Channels 2-6)**: 54-88 MHz
- **VHF-High Band (Channels 7-13)**: 174-216 MHz
- **UHF Band (Channels 14-36)**: 470-608 MHz (post-repack)

### Detection Capabilities

- **Pilot Tone Detection**: Identifies ATSC pilot tone at 309.44 kHz offset from lower band edge
- **Sync Lock Detection**: Validates segment and field sync patterns using ATSC 8-VSB demodulator
- **Signal Quality Measurement**:
  - Signal-to-Noise Ratio (SNR)
  - Modulation Error Ratio (MER)
  - Signal strength (0-100% scale)

### Storage & Export

- **IndexedDB Persistence**: Found channels are automatically saved to browser storage
- **Export/Import**: Download channel lists as JSON for backup or sharing
- **Channel Management**: Clear, view, and organize discovered channels

## Usage

### Accessing the Scanner

1. Navigate to the Scanner page in rad.io
2. Select "ATSC" from the signal type selector
3. Configure your scan parameters

### Scan Configuration

#### Bands to Scan

Choose which frequency bands to scan:
- ☑ VHF-Low (Ch 2-6): Lower VHF television channels
- ☑ VHF-High (Ch 7-13): Upper VHF television channels
- ☑ UHF (Ch 14-36): UHF television channels (post-repack)

#### Detection Settings

- **Threshold**: Signal detection threshold in dB above noise floor (5-30 dB)
  - Default: 15 dB
  - Higher values reduce false positives but may miss weak signals
  
- **Dwell Time**: Time spent analyzing each channel (100-2000 ms)
  - Default: 500 ms
  - Longer dwell times improve sync detection accuracy
  
- **Require Pilot Tone**: Only report channels with detected ATSC pilot
  - Recommended: Enabled
  - Ensures detected signals are actually ATSC broadcasts
  
- **Require Sync Lock**: Only report channels where demodulator achieves sync
  - Default: Disabled (slower but more accurate when enabled)
  - Enable for highest confidence in signal validity

### Scanning Process

1. **Configure Bands**: Select which frequency bands to scan
2. **Set Detection Parameters**: Adjust threshold and dwell time as needed
3. **Start Scan**: Click "Start Scan" to begin
4. **Monitor Progress**: Watch real-time progress and current channel
5. **Review Results**: View found channels sorted by signal strength

### Found Channels

Each discovered channel displays:
- **Channel Number**: Physical RF channel (2-36)
- **Frequency**: Center frequency in MHz
- **Band**: VHF-Low, VHF-High, or UHF
- **Strength**: Signal strength as percentage
- **SNR**: Signal-to-Noise Ratio in dB
- **Quality**: Pilot detection, sync lock, and MER (if available)
- **Discovered**: Timestamp when channel was first found

### Actions

- **Tune**: Navigate to Live Monitor with selected channel frequency
- **Export**: Download channel list as JSON file
- **Clear**: Remove all found channels from storage

## Technical Details

### ATSC Standard

ATSC (Advanced Television Systems Committee) is the digital television standard used primarily in North America. The scanner implements:

- **8-VSB Modulation**: 8-level Vestigial Sideband
- **6 MHz Channel Bandwidth**: Standard TV channel spacing
- **Pilot Tone**: 309.44 kHz offset for carrier recovery
- **Symbol Rate**: 10.76 Msymbols/sec

### Detection Algorithm

1. **Tune to Channel**: Set SDR to channel center frequency
2. **Collect IQ Samples**: Gather samples for FFT analysis
3. **FFT Analysis**: Compute power spectrum
4. **Peak Detection**: Find spectral peaks above threshold
5. **Pilot Detection**: Verify pilot tone at expected offset
6. **Demodulation**: Run ATSC 8-VSB demodulator
7. **Sync Detection**: Check for segment and field sync patterns
8. **Quality Metrics**: Calculate SNR and MER

### Storage Format

Channels are stored in IndexedDB with the following schema:

```typescript
{
  channel: {
    channel: number,        // Physical channel number
    frequency: number,      // Center frequency (Hz)
    lowerEdge: number,      // Lower band edge (Hz)
    upperEdge: number,      // Upper band edge (Hz)
    pilotFrequency: number, // Pilot tone frequency (Hz)
    band: string            // "VHF-Low" | "VHF-High" | "UHF"
  },
  strength: number,         // 0-1 signal strength
  snr: number,             // SNR in dB
  mer?: number,            // MER in dB (optional)
  pilotDetected: boolean,  // Pilot tone present
  syncLocked: boolean,     // Sync achieved
  segmentSyncCount: number,// Number of segment syncs
  fieldSyncCount: number,  // Number of field syncs
  discoveredAt: Date,      // First scan timestamp
  lastScanned: Date,       // Most recent scan
  scanCount: number        // Total scan count
}
```

## Best Practices

### Optimal Settings

- **Urban Areas**: Use higher threshold (20 dB) to reduce interference
- **Rural Areas**: Use lower threshold (10-12 dB) to find distant signals
- **Quick Scan**: Disable sync lock requirement, use 200-300ms dwell
- **Thorough Scan**: Enable sync lock, use 1000ms+ dwell time

### Troubleshooting

**No channels found:**
- Ensure SDR device is connected and antenna is attached
- Lower detection threshold
- Increase dwell time
- Check that selected bands are appropriate for your location

**Many false positives:**
- Increase detection threshold
- Enable "Require Pilot Tone"
- Enable "Require Sync Lock"

**Scan is slow:**
- Reduce dwell time
- Disable sync lock requirement
- Scan fewer bands

## Architecture

### Component Structure

```
ATSCScanner (UI Component)
    ↓
useATSCScanner (Business Logic Hook)
    ↓
├── ATSC8VSBDemodulator (Signal Processing)
├── atscChannels (Frequency Plan)
└── atscChannelStorage (IndexedDB Persistence)
```

### Data Flow

1. User configures scan parameters in `ATSCScanner` component
2. Component calls `useATSCScanner` hook methods
3. Hook manages device, demodulator, and scanning state
4. For each channel:
   - Tune device to frequency
   - Collect IQ samples
   - Perform FFT analysis
   - Detect pilot tone
   - Run demodulator for sync
   - Calculate quality metrics
5. Found channels saved to IndexedDB
6. UI updates with results

## Future Enhancements

Potential improvements for future versions:

- **PSIP Decoding**: Extract virtual channel numbers and station names
- **Program Guide**: Parse EPG data from broadcast stream
- **Closed Captions**: Decode and display CC data
- **Multi-Program Detection**: Identify sub-channels within a channel
- **Signal Logging**: Track signal quality over time
- **Geolocation Integration**: Map channels to tower locations
- **Spectrum Visualization**: Real-time spectrum display during scan

## References

- [ATSC Standard A/53](https://www.atsc.org/atsc-documents/a53-atsc-digital-television-standard/)
- [FCC TV Channel Repack](https://www.fcc.gov/about-fcc/fcc-initiatives/incentive-auctions)
- [ATSC 8-VSB Demodulator Documentation](../plugins/demodulators/ATSC8VSBDemodulator.md)

## License

Part of the rad.io project. See project LICENSE for details.
