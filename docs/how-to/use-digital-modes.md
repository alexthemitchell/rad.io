# How-To: Use Digital Modes (PSK31 & FT8)

**Time to complete**: 15-30 minutes  
**Prerequisites**: rad.io installed, SDR hardware connected  
**Difficulty**: Intermediate

## Overview

This guide shows you how to use the digital mode decoders in rad.io to receive and decode PSK31 and FT8 transmissions.

## Supported Modes

- **PSK31**: Text-based digital mode, 31.25 baud, ~100 Hz bandwidth
- **FT8**: Weak-signal digital mode, 6.25 symbols/s, ~50 Hz bandwidth (stub implementation)

## Quick Start

### 1. Select Digital Mode

From the main interface:

1. Open the **Mode Selector**
2. Choose **PSK31** or **FT8**
3. The decoder will activate automatically

### 2. Tune to Digital Frequencies

**Common PSK31 Frequencies:**

- 3.580 MHz (80m)
- 7.070 MHz (40m)
- 10.142 MHz (30m)
- 14.070 MHz (20m)
- 18.100 MHz (17m)
- 21.080 MHz (15m)
- 28.120 MHz (10m)

**Common FT8 Frequencies:**

- 3.573 MHz (80m)
- 7.074 MHz (40m)
- 10.136 MHz (30m)
- 14.074 MHz (20m)
- 18.100 MHz (17m)
- 21.074 MHz (15m)
- 28.074 MHz (10m)

### 3. Adjust Settings

#### PSK31 Settings

- **AFC (Automatic Frequency Control)**: Keep enabled for best results
- **Squelch**: Start at 0, increase if too much noise
- **AGC Target**: Default 0.5 works for most signals

#### FT8 Settings (Stub)

- **Time Offset**: Adjust if UTC time sync is off
- **SNR Threshold**: -20 dB default (can decode very weak signals)
- **Auto Sync**: Enable for automatic time synchronization

### 4. View Decoded Messages

The **Digital Mode Display** component shows:

- **Timestamp**: UTC time of message
- **SNR**: Signal-to-Noise Ratio (color-coded)
- **Frequency**: Offset frequency in Hz/kHz
- **Message Text**: Decoded content

## PSK31 Details

### How PSK31 Works

PSK31 uses Binary Phase Shift Keying (BPSK) to transmit text:

1. Characters encoded with Varicode (variable-length)
2. Phase changes represent bits (0° = 0, 180° = 1)
3. Extremely narrow bandwidth (~31 Hz)
4. Very efficient for keyboard-to-keyboard contacts

### Typical PSK31 Transmissions

```
CQ CQ DE W1AW W1AW K
```

- `CQ`: Calling any station
- `DE`: "From" (from)
- `W1AW`: Callsign
- `K`: "Over" (invitation to respond)

### PSK31 Best Practices

1. **Tune Carefully**: Center signal in passband
2. **Use AFC**: Compensates for frequency drift
3. **Watch Waterfall**: Look for vertical lines indicating PSK
4. **Be Patient**: PSK31 is slow (~50 words/minute)

## FT8 Details (Stub Implementation)

### How FT8 Works

FT8 uses 8-FSK (8-tone frequency shift keying):

1. 79 symbols per message (12.64 seconds)
2. LDPC error correction
3. Can decode signals 20 dB below noise floor
4. Fixed-format messages (callsign, grid, report)

### Typical FT8 Messages

```
CQ TEST FN42        # Calling CQ from grid FN42
W1AW TEST R-15      # Reply with signal report -15 dB
TEST W1AW RRR       # Roger, received
W1AW TEST 73        # Sign-off
```

### FT8 Requirements

⚠️ **Note**: Full FT8 implementation requires:

- LDPC decoder (not yet implemented)
- UTC time sync within ±1 second
- Time-slot synchronization (15-second periods)

Current stub provides:

- Plugin architecture
- Message structure definitions
- Signal magnitude extraction
- Parameter configuration

## Troubleshooting

### No Decoded Text

**PSK31:**

- Check frequency tuning (very narrow bandwidth)
- Verify AFC is enabled
- Reduce squelch threshold
- Look for phase changes in IQ constellation

**FT8:**

- Ensure UTC time is synchronized
- Wait for full 12.64-second transmission
- Check SNR threshold setting

### Garbled Text (PSK31)

- Signal too weak (increase RF gain)
- Frequency drift (enable AFC)
- Incorrect tuning (center signal)
- Multipath interference (wait for better conditions)

### Poor Performance

- Increase sample rate (48 kHz recommended)
- Reduce CPU load (close other applications)
- Use hardware AGC on SDR
- Improve antenna system

## Advanced Usage

### Multiple Decoders

Future enhancement: Run multiple decoders simultaneously to monitor different frequencies.

### Message Logging

Future enhancement: Log decoded messages with timestamps for later analysis.

### Contact Tracking

Future enhancement: Track QSOs (contacts) and export to ADIF format.

## References

- [PSK31 Specification](http://www.arrl.org/psk31)
- [FT8 Operating Guide by Gary Hinson (PDF)](https://www.g4ifb.com/FT8_Hinson_tips_for_HF_DXers.pdf)
- [WSJT-X Documentation](https://physics.princeton.edu/pulsar/k1jt/wsjtx.html)
- [Digital Mode Reference](../reference/digital-modes.md)

## Next Steps

- Try [Creating a Demodulator Plugin](./create-demodulator-plugin.md)
- Learn about [DSP Performance Optimization](./optimize-dsp-performance.md)
- Explore [Signal Analysis](../reference/signal-analysis.md)
