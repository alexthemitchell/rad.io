# Modulation Types

## Overview

Modulation is the process of encoding information onto a carrier wave by varying its properties. Understanding modulation types is essential for tuning to and decoding radio signals.

## Analog Modulation

### AM (Amplitude Modulation)

**How it works**: The amplitude (strength) of the carrier wave varies with the audio signal.

**Characteristics**:

- **Bandwidth**: ~10 kHz (±5 kHz from carrier)
- **Audio quality**: Moderate
- **Efficiency**: Low (carrier always present)
- **Noise sensitivity**: Moderate to high

**Common uses**:

- AM broadcast radio (530-1710 kHz)
- Aviation communication (118-137 MHz)
- Some amateur radio
- CB radio (26.965-27.405 MHz, varies by region)

**Demodulation**: Simple envelope detection

**WebSDR Settings**:

- Mode: AM
- Bandwidth: 8-10 kHz
- AGC: ON

**Visual signature**: Carrier visible even with no modulation, symmetrical sidebands

---

### DSB (Double Sideband)

**How it works**: Similar to AM but with suppressed carrier.

**Characteristics**:

- Both sidebands present
- No carrier (or reduced carrier)
- More efficient than AM

**Common uses**:

- Amateur radio experimentation
- Some military communications

**Demodulation**: Requires carrier reinsertion (BFO)

---

### SSB (Single Sideband)

**How it works**: One sideband (upper or lower) with suppressed carrier. Most efficient form of amplitude modulation.

**Characteristics**:

- **Bandwidth**: ~2.7 kHz
- **Audio quality**: Excellent for voice
- **Efficiency**: Very high
- **Frequency accuracy required**: ±50 Hz for intelligible speech

**Types**:

- **USB (Upper Sideband)**: Frequencies above carrier, standard for HF >10 MHz
- **LSB (Lower Sideband)**: Frequencies below carrier, standard for HF <10 MHz

**Common uses**:

- Amateur radio HF voice (3.5-30 MHz)
- Maritime communication
- Military/utility stations
- Aeronautical HF

**Demodulation**: Product detector with BFO (Beat Frequency Oscillator)

**WebSDR Settings**:

- Mode: USB or LSB (convention-dependent)
- Bandwidth: 2.4-3.0 kHz
- Fine tune: Critical (±50 Hz)

**Visual signature**: Single sideband visible, no carrier spike, asymmetric spectrum

---

### FM (Frequency Modulation)

**How it works**: The frequency of the carrier varies with the audio signal.

**Types**:

#### NFM (Narrowband FM)

- **Bandwidth**: 8-16 kHz deviation
- **Uses**: Two-way radio, amateur repeaters, marine VHF, PMR446
- **Deviation**: ±2.5 to ±5 kHz

#### WFM (Wideband FM)

- **Bandwidth**: 150-200 kHz deviation
- **Uses**: FM broadcast (87.5-108 MHz), weather satellites (APT)
- **Deviation**: ±75 kHz
- **Features**: Stereo (using 38 kHz pilot tone), RDS data

**Characteristics**:

- **Noise immunity**: Excellent (capture effect)
- **Audio quality**: Excellent
- **Bandwidth**: Wide compared to AM/SSB
- **SNR improvement**: High

**Common uses**:

- FM broadcast radio
- Amateur VHF/UHF repeaters
- Marine VHF (156-162 MHz)
- Business/commercial two-way radio
- Walkie-talkies (FRS/GMRS/PMR446)

**Demodulation**: Frequency discriminator or PLL detector

**WebSDR Settings**:

- Mode: NFM or WFM (bandwidth-dependent)
- Bandwidth: 8 kHz (NFM) or 200 kHz (WFM)
- Squelch: Useful for NFM

**Visual signature**: Wide spectrum spread, Carson's rule: BW = 2(Δf + fm)

---

### CW (Continuous Wave / Morse Code)

**How it works**: Carrier is turned on/off in patterns (dots and dashes).

**Characteristics**:

- **Bandwidth**: 100-200 Hz (extremely narrow)
- **Efficiency**: Very high
- **SNR advantage**: Best of any mode (~10 dB better than SSB)
- **Skill required**: Must know Morse code

**Common uses**:

- Amateur radio (especially weak signal work)
- Beacons (propagation indicators)
- Maritime communication (historical)
- Emergency/backup communication

**Demodulation**: BFO to create audible tone (typically 400-800 Hz)

**WebSDR Settings**:

- Mode: CW or USB/LSB with narrow filter
- Bandwidth: 100-500 Hz
- BFO: Adjust for comfortable pitch

**Visual signature**: Single vertical line (carrier)

---

## Digital Modulation

### FSK (Frequency Shift Keying)

**How it works**: Digital data encoded by shifting between two or more frequencies.

**Variants**:

- **BFSK**: Binary (2 tones)
- **MFSK**: Multiple frequencies
- **GFSK**: Gaussian filtered (smoother transitions)

**Characteristics**:

- **Simple implementation**
- **Moderate bandwidth**
- **Good noise immunity**

**Common uses**:

- **RTTY (Radioteletype)**: 45.45 baud, 170 Hz shift
- **Packet radio**: AX.25 protocol, 1200 baud (VHF)
- **APRS**: Position reporting, 1200 baud
- **Pagers**: POCSAG, FLEX
- **AIS**: Marine vessel tracking, GMSK 9600 baud
- **Weather satellites**: LRPT (Meteor-M)

**Demodulation**: Frequency discrimination and bit detection

**WebSDR Settings**:

- Mode: USB or dedicated digital mode
- Bandwidth: 3 kHz typical
- Use external decoder software (fldigi, direwolf)

**Visual signature**: Two or more discrete tones, parallel lines in waterfall

---

### PSK (Phase Shift Keying)

**How it works**: Digital data encoded by changing the phase of the carrier.

**Variants**:

- **BPSK**: Binary (2 phases)
- **QPSK**: Quadrature (4 phases)
- **8PSK**: 8 phases (higher data rate)

**Characteristics**:

- **Very efficient**
- **Narrow bandwidth**
- **Requires phase coherence**

**Common protocols**:

- **PSK31**: 31.25 baud, keyboard-to-keyboard chat, 60 Hz bandwidth
- **PSK63**: 62.5 baud, faster variant
- **PSKR**: Reporter modes for propagation

**Common uses**:

- Amateur radio digital communication
- Low power experimentation
- DX (long distance) contacts

**Demodulation**: Phase detection and symbol decoding

**WebSDR Settings**:

- Mode: USB
- Bandwidth: 500 Hz - 3 kHz
- Use fldigi or similar software

**Visual signature**: Constant amplitude, centered carrier, ~60-250 Hz bandwidth

---

### FT8 (Franke-Taylor 8-FSK)

**How it works**: 8-tone FSK with sophisticated error correction, time-synchronized.

**Characteristics**:

- **Time slots**: 15-second transmit periods
- **Bandwidth**: ~50 Hz
- **SNR advantage**: Decodes at -21 dB (excellent weak signal)
- **Automated**: Computer-controlled QSOs
- **Data rate**: 6.25 baud

**Common uses**:

- Amateur radio weak signal work
- DX expeditions
- Propagation studies
- Most popular digital mode currently

**Frequencies**: 1.840, 3.573, 7.074, 10.136, 14.074, 18.100, 21.074, 24.915, 28.074 MHz

**Demodulation**: WSJT-X software (time-sync required)

**WebSDR Settings**:

- Mode: USB
- Bandwidth: 3 kHz (to see multiple stations)
- Record audio for WSJT-X processing

**Visual signature**: Short 15-second bursts, multiple tones, synchronized timing

---

### FT4

**How it works**: Similar to FT8 but faster (7.5 second cycles) for contests.

**Characteristics**:

- **Time slots**: 7.5 seconds
- **Higher throughput than FT8**
- **Optimized for rapid QSOs**

---

### WSPR (Weak Signal Propagation Reporter)

**How it works**: Beacon mode transmitting callsign, location, and power.

**Characteristics**:

- **Time slots**: 2-minute transmit periods
- **SNR advantage**: -31 dB
- **Purpose**: Propagation studies only (not QSOs)
- **GPS sync**: Requires accurate time

**Common uses**: Automated propagation monitoring

---

### SSTV (Slow Scan Television)

**How it works**: Analog image transmission using FM audio tones.

**Common modes**:

- **Martin M1**: 114 seconds per image
- **Scottie S1**: 110 seconds per image
- **Robot 36**: 36 seconds per image

**Characteristics**:

- **Color images**: RGB scan lines
- **Audio tones**: 1500 Hz sync, 1200-2300 Hz video
- **Resolution**: 320x240 typically

**Common uses**:

- Amateur radio image sharing
- ISS (International Space Station) periodic events
- Special event stations

**Demodulation**: MMSSTV, QSSTV, or similar software

**WebSDR Settings**:

- Mode: USB
- Bandwidth: 3 kHz
- Record audio for decoder

**Visual signature**: Diagonal lines in waterfall, changing tones

---

### RTTY (Radioteletype)

**How it works**: FSK using Baudot or ASCII encoding.

**Characteristics**:

- **Standard**: 45.45 baud, 170 Hz shift
- **Mark/Space**: Two tones
- **Character encoding**: 5-bit Baudot or 7/8-bit ASCII

**Common uses**:

- Amateur radio contests
- Maritime communication
- Meteorological data (FAX)
- News services (historical)

**Demodulation**: fldigi, MMTTY

**WebSDR Settings**:

- Mode: USB (sometimes RTTY-specific mode)
- Bandwidth: 500 Hz
- External decoder software

---

### ADS-B (Automatic Dependent Surveillance-Broadcast)

**How it works**: Aircraft broadcast position, altitude, speed using PPM (Pulse Position Modulation).

**Characteristics**:

- **Frequency**: 1090 MHz
- **Modulation**: PPM (pulse)
- **Data rate**: 1 Mbit/s
- **Range**: Line of sight (50-250 miles depending on altitude)

**Common uses**: Aircraft tracking

**Demodulation**: dump1090, Mode-S decoder

**Required hardware**: 1090 MHz receiver or upconverter

---

## Specialized Modes

### DRM (Digital Radio Mondiale)

**How it works**: Digital encoding for AM broadcast bands.

**Characteristics**:

- **Audio quality**: Near-FM quality
- **Spectrum efficiency**: Better than analog AM
- **Robustness**: Error correction

**Common uses**: International shortwave broadcasting

---

### D-STAR, DMR, C4FM (Digital Voice)

**How it works**: Digital voice codecs for VHF/UHF communication.

**Characteristics**:

- **Voice quality**: Clear or silent (no static)
- **Data capability**: GPS, text messaging
- **Networking**: Internet linking

**Common uses**: Amateur radio repeaters

---

### APRS (Automatic Packet Reporting System)

**How it works**: AX.25 packet radio with position, weather, telemetry data.

**Characteristics**:

- **Frequency**: 144.390 MHz (North America), varies by region
- **Modulation**: 1200 baud AFSK
- **Protocol**: AX.25 frames

**Common uses**: Position reporting, weather stations, mobile tracking

**Demodulation**: direwolf, Xastir

---

## Selection Guide

| **Use Case**           | **Mode** | **Why**                       |
| ---------------------- | -------- | ----------------------------- |
| Local two-way radio    | NFM      | Best audio, noise immunity    |
| HF voice DX            | SSB      | Efficient, good audio quality |
| Weak signal HF         | FT8, CW  | Best SNR performance          |
| AM broadcast listening | AM       | Standard for these bands      |
| FM broadcast listening | WFM      | Standard, stereo capability   |
| Digital keyboard chat  | PSK31    | Narrow bandwidth, efficient   |
| Aircraft tracking      | ADS-B    | Standard for aviation         |
| Image sharing          | SSTV     | Analog image mode             |
| Marine VHF             | NFM      | Standard for maritime         |
| Aviation HF            | USB      | Standard for aeronautical     |

## Bandwidth Comparison

```
CW:           [██] ~200 Hz
PSK31:        [████] ~60 Hz
FT8:          [████] ~50 Hz
RTTY:         [████████] ~450 Hz
SSB:          [████████████████] ~2.7 kHz
NFM:          [████████████████████████] ~12 kHz
AM:           [████████████████████████████] ~10 kHz
WFM:          [████████████████████████████████████████████████] ~200 kHz
```

## Demodulation Complexity

**Simple → Complex**:

1. AM (envelope detection)
2. FM (frequency discriminator)
3. SSB (product detector + BFO)
4. CW (BFO + tone extraction)
5. FSK (frequency discrimination + bit sync)
6. PSK (phase coherent detection + symbol sync)
7. FT8/FT4 (time sync + multi-tone FSK + error correction)

## Resources

- **[sigidwiki.com](http://www.sigidwiki.com/)**: Identify unknown signals
- **fldigi**: Multi-mode digital decoder
- **WSJT-X**: FT8/FT4/WSPR decoder
- **direwolf**: Packet radio/APRS decoder
