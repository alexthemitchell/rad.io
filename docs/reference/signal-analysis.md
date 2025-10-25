# Signal Analysis Techniques

## Overview

Signal analysis is the process of examining radio signals to identify type, content, and characteristics. This guide covers practical techniques for SDR users.

## Visual Signal Identification

### Waterfall Patterns

The waterfall display is your primary tool for signal identification.

#### Continuous Carriers

**Appearance**: Vertical line, constant color
**Examples**: Beacons, carriers, local oscillators
**Analysis**: Check for drift, modulation

#### AM Broadcasting

**Appearance**: Thick vertical bar with symmetrical sidebands
**Bandwidth**: ~10 kHz
**Features**: Carrier visible even with no audio

#### SSB Voice

**Appearance**: Asymmetric "smear" on one side of frequency
**Bandwidth**: ~2.7 kHz
**Features**: No carrier spike, one-sided
**USB**: Energy above center frequency
**LSB**: Energy below center frequency

#### FM Voice (NFM)

**Appearance**: Wide vertical streak when transmitting, disappears when silent
**Bandwidth**: ~12.5-16 kHz
**Features**: Captures quieter signals (capture effect)

#### FM Broadcast (WFM)

**Appearance**: Very wide signal, ~200 kHz
**Features**: May see stereo pilot tone at 19 kHz offset

#### CW (Morse Code)

**Appearance**: Very narrow vertical line, turning on/off in patterns
**Bandwidth**: <500 Hz
**Features**: Extremely narrow, periodic keying

#### RTTY

**Appearance**: Two parallel vertical lines
**Spacing**: Typically 170 Hz, 425 Hz, or 850 Hz
**Features**: Marks and spaces, constant when transmitting

#### PSK31

**Appearance**: Single narrow carrier, constant amplitude
**Bandwidth**: ~60 Hz
**Features**: Very narrow, looks like weak carrier
**Pattern**: Phase changes not visible in waterfall

#### FT8

**Appearance**: Short bursts (15 seconds), multiple tones
**Timing**: Synchronized to 15-second intervals (:00, :15, :30, :45)
**Bandwidth**: ~50 Hz per signal
**Features**: Multiple stations visible simultaneously

#### SSTV

**Appearance**: Diagonal lines sweeping across frequency range
**Pattern**: Repeating scan lines
**Bandwidth**: ~3 kHz
**Duration**: 30-120 seconds per image

#### Digital Voice (DMR, D-STAR)

**Appearance**: Steady signal when transmitting, blocky pattern
**Features**: Digital artifacts, no traditional audio

## Spectrum Analysis

### Reading the Spectrum Display

**Noise Floor**: Baseline level across spectrum

- Flat = good
- Sloped = filter response or AGC issues
- Spiky = interference

**Peak Detection**: Find signals above noise floor

- Height = signal strength
- Width = bandwidth
- Shape = filter characteristics

**Dynamic Range**: Difference between strongest and weakest visible signals

### Measuring Signal Parameters

#### Center Frequency

1. Zoom in on signal
2. Find peak in spectrum
3. Read frequency at peak
4. For SSB: carrier is outside visible spectrum

#### Bandwidth

1. Note frequencies at -3 dB points (half power)
2. Calculate difference
3. Compare to expected values

#### Signal Strength

- **Absolute**: Read dBFS or dBm value
- **Relative**: Compare to noise floor (SNR)
- **S-units**: S9 = -73 dBm (HF) or -93 dBm (VHF)

## Demodulation Testing

### Choosing the Right Mode

| If you hear...                 | Try mode...                 |
| ------------------------------ | --------------------------- |
| Clear voice, local station     | FM (NFM)                    |
| Voice with background noise    | AM                          |
| Distorted/unintelligible voice | SSB (USB or LSB)            |
| Musical tones                  | Data mode (decode needed)   |
| Rhythmic beeps                 | CW (Morse code)             |
| Nothing but carrier visible    | Wrong mode or no modulation |

### Mode-Specific Tuning

#### AM

- Center on carrier spike
- Adjust bandwidth to 8-10 kHz
- Enable AGC

#### SSB

- Tune until voice sounds natural (not Donald Duck or deep)
- USB: tune slightly low, bring up
- LSB: tune slightly high, bring down
- Critical: within ±50 Hz for intelligibility

#### FM

- Center on signal
- Squelch eliminates noise between transmissions
- Should be clear or silent (no static)

#### CW

- Adjust BFO for comfortable tone (400-800 Hz)
- Very narrow filter (100-500 Hz)
- Practice reading Morse code

## Signal Quality Assessment

### Audio Quality Indicators

**Excellent**:

- Clear, no noise
- Full frequency response
- No distortion

**Good**:

- Minor background noise
- Mostly clear
- Occasional fading

**Fair**:

- Significant noise
- Readable but requires attention
- Frequent fading

**Poor**:

- Barely readable
- High noise
- Severe fading or distortion

### Digital Mode Success

**FT8/Digital Modes**:

- Check SNR values in software
- -10 dB or better = good
- -20 dB or better = excellent
- Below -24 dB = may fail to decode

**SSTV**:

- Clean diagonal lines
- No noise bands
- Sync pulses clear

### Interference Identification

#### Continuous Interference

**Pattern**: Always present, same location
**Sources**:

- Local electronics (computers, power supplies)
- Power lines (harmonics of 50/60 Hz)
- LED lights

**Solutions**:

- Turn off local devices
- Use filters
- Change antenna location

#### Intermittent Interference

**Pattern**: Comes and goes
**Sources**:

- Household appliances
- Motors
- Light dimmers

**Solutions**:

- Identify timing pattern
- Locate source
- Add filtering at source

#### Co-channel Interference

**Pattern**: Two signals on same frequency
**Result**: Heterodyne tone, distortion
**Solutions**:

- Choose stronger signal (FM capture effect)
- Narrow filter (SSB/CW)
- Change frequency

## Propagation Analysis

### Band Conditions

#### Indicators of Good Propagation

- Strong distant signals
- Many active stations
- Low noise floor
- Clear signals

#### Indicators of Poor Propagation

- Only local signals
- High noise
- Empty band
- Weak signals

### Time of Day Effects

**HF Bands**:

- **40m/80m**: Best at night, absorbed during day
- **20m**: Good day and night, best for DX
- **15m/10m**: Daytime only (solar activity dependent)

**VHF/UHF**: Generally line-of-sight

- **Tropo**: Extended range during weather inversions
- **Sporadic E**: Sudden long-distance propagation on 6m/2m

### Using Beacons

**What**: Automated transmitters for propagation testing
**Frequencies**:

- 14.100 MHz (20m)
- 18.110 MHz (17m)
- 21.150 MHz (15m)
- 24.930 MHz (12m)
- 28.200 MHz (10m)

**How to use**:

1. Listen for beacons
2. Note locations heard
3. Assess band openings
4. Predict DX opportunities

## Advanced Techniques

### Signal Direction Finding

**Single Station**:

- Rotate directional antenna
- Note strongest signal direction
- Requires calibrated setup

**Multiple Stations** (TDoA):

- Compare arrival times
- Triangulate position
- Requires synchronized receivers

### Modulation Analysis

#### Spectral Shape

- **Clean sidebands**: Good transmitter
- **Splatter**: Overmodulation or poor filtering
- **Asymmetric**: Transmitter issue

#### Time Domain

- **Envelope**: Shows AM modulation depth
- **Keying**: Check rise/fall times (CW, FSK)
- **Duty cycle**: Measure transmit/receive ratio

### Recording for Analysis

**When to Record**:

- Unknown signal types
- Brief transmissions
- Legal documentation
- Later detailed analysis

**What to Record**:

- **Audio**: WAV format, 48 kHz sampling
- **I/Q**: Raw samples for reprocessing
- **Metadata**: Frequency, time, mode, notes

**Tools**:

- SDR# record function
- HDSDR
- GNU Radio

## Signal Identification Resources

### Online Databases

**SigIDWiki**: Comprehensive signal database

- Search by frequency
- Visual examples
- Audio samples
- Demodulation info

**RadioReference**: Frequency allocations

- By location
- By service
- Trunked systems

### Classification by Characteristics

| Bandwidth | Modulation | Examples            |
| --------- | ---------- | ------------------- |
| <100 Hz   | CW         | Morse code, beacons |
| ~60 Hz    | PSK        | PSK31, PSK63        |
| ~50 Hz    | FSK        | FT8, FT4            |
| ~500 Hz   | FSK        | RTTY                |
| ~2.7 kHz  | SSB        | Voice, SSTV         |
| ~10 kHz   | AM         | Broadcast, aviation |
| ~12 kHz   | NFM        | Two-way radio       |
| ~200 kHz  | WFM        | FM broadcast        |

### Unusual Signals

#### Over-the-Horizon Radar

**Pattern**: Rapid sweeping across wide bandwidth
**Sound**: Woodpecker-like tapping
**Bandwidth**: Several MHz
**Sources**: Military surveillance

#### Numbers Stations

**Pattern**: Voice or data reading numbers/codes
**Frequencies**: Various HF
**Purpose**: Likely espionage/military

#### Time Signals

**Pattern**: Regular tones or ticks
**Frequencies**: 2.5, 5, 10, 15, 20 MHz (WWV)
**Purpose**: Time and frequency standard

## Practical Exercises

### Exercise 1: Mode Identification

1. Scan 20m band (14.000-14.350 MHz)
2. Identify at least 5 different signal types
3. Note frequency, bandwidth, modulation
4. Attempt demodulation

### Exercise 2: Band Survey

1. Choose time of day
2. Scan all amateur HF bands
3. Note which are active
4. Correlate with expected propagation

### Exercise 3: Signal Tracking

1. Find persistent signal
2. Monitor over 24 hours
3. Note times active
4. Look for patterns

### Exercise 4: Interference Hunting

1. Identify local interference
2. Use process of elimination
3. Turn off devices one by one
4. Document findings

## Troubleshooting

### "I don't see any signals"

**Check**:

- Antenna connected
- Frequency range correct
- RF gain not too low
- Not overloaded (gain too high)
- Correct band for time of day

### "Signals but no audio"

**Check**:

- Correct demodulation mode
- Audio volume
- Squelch not too high
- Bandwidth wide enough
- Actually tuned to signal

### "Distorted audio"

**Check**:

- RF gain (overload)
- Audio gain
- Correct mode selection
- AGC settings
- Signal strength indicator

### "Everything looks noisy"

**Check**:

- Antenna system
- Local interference
- Time of day / propagation
- RF gain settings
- Noise blanker/reduction

## Best Practices

1. **Take Notes**: Document interesting signals
2. **Be Patient**: Propagation varies, return later
3. **Learn Patterns**: Signal types have signatures
4. **Use References**: SigIDWiki, frequency lists
5. **Record Unknown**: Save for later analysis
6. **Practice Modes**: Try different demodulation
7. **Monitor Beacons**: Track propagation
8. **Join Community**: Share findings, learn from others

## Safety and Ethics

- **Monitor emergency frequencies carefully**: 121.5, 243, 156.8 MHz
- **Never interfere** with official communications
- **Respect privacy**: Don't record or share private communications
- **Document responsibly**: Public safety may need your logs
- **Know local laws**: Monitoring regulations vary by location
