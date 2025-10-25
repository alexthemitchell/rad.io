# Digital Mode Reference Guide

This guide provides comprehensive information about the digital communication modes supported in WebSDR Pro. Understanding these modes will help you configure decoders effectively and interpret decoded data.

## Table of Contents

- [RTTY (Radioteletype)](#rtty-radioteletype)
- [PSK31 (Phase Shift Keying)](#psk31-phase-shift-keying)
- [SSTV (Slow-Scan Television)](#sstv-slow-scan-television)

---

## RTTY (Radioteletype)

### Overview

RTTY (Radioteletype) is one of the oldest digital communication modes, dating back to the 1930s. It uses Frequency Shift Keying (FSK) to transmit text by shifting between two audio tones (mark and space frequencies).

### Technical Characteristics

**Modulation:** Frequency Shift Keying (FSK)
**Character Encoding:** Baudot (ITA2) - 5-bit code with LTRS/FIGS shifts
**Common Frequencies:**

- Amateur: 3.580, 7.040, 14.080, 21.080, 28.080 MHz
- Weather: 162.400-162.550 MHz (US NOAA stations)

### Key Parameters

#### Baud Rate

The transmission speed measured in symbols per second.

- **45.45 baud**: Most common amateur radio standard
- **50 baud**: International standard, used by commercial services
- **75 baud**: Less common, used for faster transmissions

#### Shift

The frequency difference between mark and space tones.

- **170 Hz**: Standard amateur radio shift
- **200 Hz**: Alternative amateur shift
- **425 Hz**: Commercial services
- **850 Hz**: US weather FAX stations

#### Mark and Space

- **Mark (1)**: Typically the higher frequency (e.g., 2125 Hz)
- **Space (0)**: The lower frequency (e.g., 2295 Hz with 170 Hz shift)

#### Reverse

Some stations transmit with reversed polarity (mark/space swapped). Enable "Reverse" if you see garbled text.

### Baudot Character Encoding

RTTY uses 5-bit Baudot code with two character sets:

- **LTRS (Letters)**: Lowercase letters and some punctuation
- **FIGS (Figures)**: Numbers and special characters

Special codes:

- **LTRS (11111)**: Switch to letters mode
- **FIGS (11011)**: Switch to figures mode
- **Space (00100)**: Space character (same in both modes)
- **CR (01000)**: Carriage return
- **LF (00010)**: Line feed

### Common Issues

**Garbled Text:**

- Wrong shift setting (try 170 Hz → 850 Hz)
- Wrong baud rate (try 45.45 → 50)
- Need to enable "Reverse"
- Poor signal strength or interference

**Random Characters:**

- Signal too weak (increase RF gain)
- Frequency drift (manually tune to center)
- Multi-path interference

### Usage Tips

1. **Start with presets**: Use "Standard 45.45" for amateur stations
2. **Fine-tune frequency**: RTTY is sensitive to exact tuning
3. **Watch for shift tones**: Visual markers in spectrum help alignment
4. **Be patient**: RTTY is slow - 45.45 baud ≈ 60 words per minute

---

## PSK31 (Phase Shift Keying)

### Overview

PSK31 is a modern, narrow-bandwidth digital mode developed by Peter Martinez (G3PLX) in 1998. It uses phase-shift keying with variable-length character encoding (Varicode) optimized for conversational text.

### Technical Characteristics

**Modulation:** Binary Phase Shift Keying (BPSK)
**Character Encoding:** Varicode (variable-length, 1-11 bits per character)
**Bandwidth:** ~31 Hz (extremely narrow)
**Common Frequencies:**

- 3.580, 7.070, 10.142, 14.070, 18.100, 21.080, 24.920, 28.120 MHz USB

### Key Parameters

#### Mode Variants

**PSK31** (31.25 baud)

- Original mode, most popular
- ~50 characters per minute
- ~31 Hz bandwidth
- Best for HF propagation

**PSK63** (62.5 baud)

- Twice the speed of PSK31
- ~100 characters per minute
- ~63 Hz bandwidth
- Better for strong signals

**PSK125** (125 baud)

- Four times PSK31 speed
- ~200 characters per minute
- ~125 Hz bandwidth
- Requires excellent signal quality

#### AFC (Automatic Frequency Control)

Compensates for frequency drift caused by:

- Transmitter instability
- Propagation Doppler shift
- Local oscillator drift

**Recommendation:** Keep AFC enabled for HF operation

#### Squelch

Threshold below which decoder output is suppressed.

- **-10 dB**: Good starting point
- **-15 dB**: For stronger signals (reduces false decodes)
- **-5 dB**: For weaker signals (more false decodes possible)

### Varicode Character Encoding

PSK31 uses variable-length encoding where common characters use fewer bits:

- `e` = 11 (2 bits)
- `t` = 101 (3 bits)
- `a` = 1011 (4 bits)
- `Q` = 111011101 (9 bits)

Characters are separated by two consecutive zero bits (00). This makes PSK31 very efficient for normal text but inefficient for binary data.

### Phase Modulation Details

**No Phase Change (0°):** Binary 0
**180° Phase Change:** Binary 1

The decoder analyzes IQ samples to detect phase transitions:

```
Phase difference < 90° → bit 0
Phase difference > 90° → bit 1
```

### Common Issues

**No Decode:**

- Frequency not centered on signal (tune waterfall marker to exact center)
- Wrong mode selected (PSK31 vs PSK63 vs PSK125)
- Signal too weak

**Partial Decode:**

- AFC struggling with drift (tune closer manually)
- Interference from adjacent signal
- Squelch too aggressive (lower threshold)

**Garbage Characters:**

- Multi-path propagation (wait for clearer conditions)
- Overdriven signal (reduce RF gain)

### Usage Tips

1. **Tune precisely**: PSK31's narrow bandwidth requires accurate tuning
2. **Watch the waterfall**: Look for vertical lines indicating PSK signals
3. **Start with PSK31**: Other modes are less common
4. **Enable AFC**: HF signals drift constantly
5. **Read the preamble**: Stations often send "CQ CQ CQ" or "QRL?" before transmitting

---

## SSTV (Slow-Scan Television)

### Overview

SSTV (Slow-Scan Television) transmits still images using audio frequency modulation. Popular for sending photos, weather satellite images, and commemorative event images. Transmission time ranges from 36 seconds to several minutes depending on mode.

### Technical Characteristics

**Modulation:** Frequency Modulation (FM) of luminance
**Image Format:** Sequential scan (line-by-line)
**Color Encoding:** RGB or GBR component transmission
**Common Frequencies:**

- 3.845, 7.171, 14.230, 21.340, 28.680 MHz LSB

### SSTV Modes

#### Martin M1

- **Resolution:** 320×256 pixels
- **Color Order:** GBR (Green, Blue, Red)
- **Scan Time:** ~114 seconds
- **Line Time:** 146.432 ms per color component
- **Use Case:** High quality images, standard for contests

#### Martin M2

- **Resolution:** 320×256 pixels
- **Color Order:** GBR
- **Scan Time:** ~58 seconds
- **Line Time:** 73.216 ms per color component
- **Use Case:** Faster transmission, moderate quality

#### Scottie S1

- **Resolution:** 320×256 pixels
- **Color Order:** GBR
- **Scan Time:** ~110 seconds
- **Sync:** Longer sync pulses for better stability
- **Use Case:** Poor conditions, needs strong sync

#### Scottie S2

- **Resolution:** 320×256 pixels
- **Color Order:** GBR
- **Scan Time:** ~71 seconds
- **Use Case:** Faster Scottie variant

#### Robot 36

- **Resolution:** 320×240 pixels
- **Color Order:** RGB (Red, Green, Blue)
- **Scan Time:** ~36 seconds
- **Use Case:** Fastest common mode, satellite reception

### Frequency Encoding

SSTV maps pixel brightness to audio frequency:

| Tone Frequency | Meaning     | Brightness |
| -------------- | ----------- | ---------- |
| 1200 Hz        | Sync Pulse  | -          |
| 1500 Hz        | Black Level | 0%         |
| 1900 Hz        | Mid Gray    | 50%        |
| 2300 Hz        | White Level | 100%       |

Each pixel is transmitted as a specific frequency for a precise duration (scan time). The decoder measures the frequency to determine pixel brightness.

### Transmission Structure

1. **VIS Code** (optional): Mode identification sent at beginning
2. **Sync Pulse**: 1200 Hz tone marking start of each line
3. **Porch**: Brief settling time after sync
4. **Green Scan**: Green component pixels
5. **Separator**: Brief pulse between components
6. **Blue Scan**: Blue component pixels
7. **Red Scan**: Red component pixels
8. **Repeat**: Steps 2-7 for each line

### Key Parameters

#### Auto Start

When enabled, decoder automatically begins receiving when it detects a sync pulse (1200 Hz). Disable if you want manual control over reception start time.

#### Sync

Enables automatic line synchronization. Keep enabled unless experiencing sync issues.

### Common Issues

**Slanted Image:**

- Frequency mismatch between transmitter and receiver
- Solution: Cannot fix in software - image timing is baked in

**Color Shifts:**

- Wrong mode selected (Martin vs Scottie vs Robot)
- Solution: Try different modes until colors look correct

**Noise/Static:**

- Weak signal strength
- Interference during transmission
- Solution: Wait for better propagation or stronger signal

**Missing Lines:**

- Signal faded during transmission
- Interference pulse
- Solution: None - wait for retransmission

**No Autostart:**

- Weak sync pulse
- Heavy background noise
- Solution: Manually start decoder, increase RF gain

### Usage Tips

1. **Mode identification**:
   - Listen for VIS code at start (series of tones)
   - If no VIS, try Robot 36 first (fastest decode)
   - Switch modes if colors look wrong

2. **Timing is critical**:
   - SSTV images cannot be "paused" mid-transmission
   - Start decoder before transmission begins or enable Auto Start
   - A complete transmission is required for full image

3. **Signal quality**:
   - SSTV requires stronger signals than text modes
   - Noise appears as colored pixels in image
   - Fading causes horizontal bands

4. **Frequency**:
   - Tune for cleanest audio (minimize distortion)
   - Peak of signal should be centered in passband
   - Use upper sideband (USB) on HF

5. **Saving images**:
   - Use the Save button immediately after complete reception
   - Partial images can still be saved and may contain useful information
   - Include timestamp and frequency in filename for logging

---

## General Digital Mode Tips

### Frequency Selection

- **USB (Upper Sideband)**: Used above 10 MHz
- **LSB (Lower Sideband)**: Used below 10 MHz
- **Exception**: RTTY often uses LSB regardless of band

### Signal Strength

- **RTTY**: Most tolerant of weak signals
- **PSK31**: Works well with weak signals due to narrow bandwidth
- **SSTV**: Requires stronger signals, more susceptible to noise

### Decoder Configuration Strategy

1. **Start with presets**: Use built-in presets for mode
2. **Monitor waterfall**: Look for characteristic signal patterns
3. **Tune precisely**: Center signal in decoder bandwidth
4. **Adjust squelch**: Balance between sensitivity and false decodes
5. **Check output**: Verify decoded data makes sense

### Band Conditions

Digital modes perform differently under various conditions:

- **Poor conditions**: Use RTTY (most robust) or PSK31 (narrow bandwidth)
- **Good conditions**: SSTV, PSK63, PSK125 work well
- **QRM (interference)**: PSK31's narrow bandwidth helps reject adjacent signals
- **QSB (fading)**: AFC helps PSK31 track frequency, RTTY more tolerant of brief fades

### Operating Etiquette

1. **Listen first**: Make sure frequency is clear
2. **QRL?**: Send "QRL?" (is frequency in use?) before transmitting
3. **CQ Calls**: Send "CQ" multiple times with your call sign
4. **Signal reports**: PSK31 reports typically include IMD (intermodulation distortion) info
5. **SSTV IDs**: Include callsign overlay on images where required by regulations

---

## References

- ITU-R Recommendation F.342: Characteristics of RTTY
- PSK31 Specification by G3PLX: http://www.arrl.org/psk31-spec
- SSTV Mode Specifications: https://www.sstvelectronics.com/
- Digital Modes Overview: http://www.arrl.org/digital-modes

For developers implementing or modifying decoders, see the [Signal Decoder Architecture ADR](../decisions/0016-signal-decoder-architecture.md).
