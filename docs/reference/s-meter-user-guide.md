# S-Meter User Guide

## Overview

The S-Meter (Signal Strength Meter) is a professional-grade signal measurement tool that displays radio signal strength in real-time. This guide explains how to use, calibrate, and interpret S-Meter readings in rad.io.

## What is an S-Meter?

An S-Meter provides a standardized way to measure and report signal strength in radio communications. Instead of arbitrary numbers, it uses the **S-unit scale** (S0-S9) that is universally understood across the amateur radio and professional radio communities.

### Key Features

- **Standard S-unit Scale**: S0 (no signal) through S9 (reference level), with extensions above S9 (e.g., S9+20)
- **Dual Representations**: Both S-units and calibrated dBm measurements
- **Band Awareness**: Automatically adjusts reference levels for HF (< 30 MHz) vs VHF/UHF (≥ 30 MHz)
- **Visual Display**: Color-coded bar or segmented meter for at-a-glance signal strength assessment
- **User Calibration**: Adjustable offset for precise measurements with your specific antenna system
- **Accessibility**: Full screen reader support with live announcements

## Understanding the Display

### S-Unit Values

The S-Meter displays signal strength using the following scale:

| Reading        | Meaning                 | Typical Use                             |
| -------------- | ----------------------- | --------------------------------------- |
| S0             | No signal / Noise floor | Background noise only                   |
| S1-S3          | Very weak signal        | Barely detectable, hard to copy         |
| S4-S6          | Weak to fair signal     | Readable with some effort               |
| S7-S8          | Good signal             | Clear, readable signal                  |
| S9             | Reference level         | Strong, clear signal                    |
| S9+10 to S9+20 | Very strong signal      | Excellent reception                     |
| S9+40+         | Extremely strong signal | Very close or very powerful transmitter |

### Color Zones

The visual meter uses color coding to indicate signal quality:

- **Gray/Dim** (S0-S3): Weak signals, difficult reception
- **Cyan** (S4-S6): Fair signals, usable reception
- **Green** (S7-S8): Good signals, excellent reception
- **Yellow** (S9 to S9+19): Strong signals above reference
- **Orange** (S9+20 to S9+39): Very strong signals
- **Red** (S9+40+): Extremely strong signals (pulsing animation)

### dBm Readings

Alongside S-units, the meter displays **dBm** (decibels relative to 1 milliwatt) - an absolute power measurement at your antenna input.

**HF Bands (< 30 MHz)**:

- S9 = -73 dBm
- Each S-unit below S9 = 6 dB difference
- Above S9: reported as S9 + X dB

**VHF/UHF Bands (≥ 30 MHz)**:

- S9 = -93 dBm (20 dB lower reference due to typically higher noise floor at VHF/UHF frequencies)
- Each S-unit below S9 = 6 dB difference
- Above S9: reported as S9 + X dB

### Band Indicator

The display shows **HF** or **VHF** to indicate which calibration standard is active:

- **HF**: Frequencies below 30 MHz (amateur HF bands, shortwave, AM broadcast)
- **VHF**: Frequencies at or above 30 MHz (FM broadcast, amateur VHF/UHF, public safety)

### Calibration Status

A small icon in the corner indicates calibration status:

- **Ruler icon (📏)**: User-calibrated (most accurate)
- **Factory icon (🏭)**: Factory calibration
- **No icon**: Uncalibrated (using default values)

## Using the S-Meter

### Basic Operation

1. **Start Reception**: Begin receiving from your SDR device
2. **Tune to a Signal**: Adjust the frequency to tune to a radio signal
3. **Monitor Strength**: Watch the S-Meter update in real-time
4. **Peak Detection**: The meter automatically smooths rapid fluctuations while tracking signal changes

### Display Modes

You can choose between two visual styles:

**Bar Mode** (Default):

- Smooth gradient bar that fills horizontally
- Shows precise signal level with smooth transitions
- Best for general monitoring

**Segment Mode**:

- 15-segment LED-style display
- Discrete steps for classic analog meter appearance
- Each illuminated segment represents signal strength

To switch modes, use the settings menu (implementation depends on UI preferences).

### Engineering Mode

For advanced users, you can enable **dBFS display** to show the raw digital signal level relative to the ADC full scale. This is useful for:

- Preventing ADC clipping (keep below -3 dBFS)
- Understanding your RF gain settings
- Debugging signal path issues

## Calibration Guide

### Why Calibrate?

Out of the box, the S-Meter uses factory calibration constants that provide approximate measurements (±10 dB accuracy). User calibration can improve this to ±1-3 dB, which is important for:

- Accurate signal strength reporting
- Comparing signals across different frequencies
- Field strength measurements
- Antenna performance evaluation

### When to Calibrate

Consider calibration if:

- You need precise dBm measurements
- You're using an external antenna with known gain/loss
- You want to compare readings with other calibrated receivers
- You're performing scientific measurements

### Calibration Methods

#### Method 1: Using a Signal Generator (Most Accurate)

**What You Need**:

- Calibrated RF signal generator
- Coaxial cable
- Attenuator (optional, to prevent overload)

**Procedure**:

1. **Connect Equipment**:
   - Connect signal generator to your SDR's antenna input
   - Use high-quality coaxial cable
   - Add inline attenuator if generator output is too strong

2. **Set Reference Signal**:
   - Set generator to your target frequency (e.g., 100 MHz)
   - Set output level to -60 dBm (moderate signal)
   - Enable modulation if desired (not required)

3. **Measure Current Reading**:
   - Tune rad.io to the generator frequency
   - Note the dBm value displayed on the S-Meter
   - Example: Generator at -60 dBm, display shows -68 dBm

4. **Calculate Offset**:

   ```
   Calibration Offset = (Known Signal) - (Displayed Value)
   Example: -60 dBm - (-68 dBm) = +8 dB
   ```

5. **Apply Calibration**:
   - Open Settings → Rendering Settings → Signal Meter Calibration
   - Enter the calculated offset (+8 dB in this example)
   - Click "Apply"

6. **Verify**:
   - The display should now show -60 dBm (matching the generator)
   - Test with different signal levels to confirm accuracy

#### Method 2: Using a Reference Station

**What You Need**:

- Knowledge of a local broadcast station's power and location
- Path loss calculation tools or charts

**Procedure**:

1. **Identify Reference Station**:
   - Choose a stable local FM or AM station
   - Determine transmitter power (from FCC database or station info)
   - Measure distance from transmitter to your location

2. **Calculate Expected Signal**:
   - Use free-space path loss formula or online calculators
   - Account for antenna height and terrain
   - Example: 50 kW FM station, 10 km away ≈ -45 dBm

3. **Measure and Calibrate**:
   - Tune to the station
   - Compare displayed dBm to calculated value
   - Apply offset as in Method 1

**Note**: This method is less accurate (±5 dB) due to propagation uncertainties.

#### Method 3: Comparing with Another Calibrated Receiver

**What You Need**:

- Access to a calibrated receiver (amateur radio transceiver, spectrum analyzer, etc.)

**Procedure**:

1. **Connect Both Receivers**:
   - Use a signal splitter to connect both to the same antenna
   - Or tune both to the same strong, stable signal

2. **Compare Readings**:
   - Note the dBm reading on the reference receiver
   - Note the dBm reading on rad.io
   - Calculate offset

3. **Apply and Test**:
   - Apply offset in rad.io settings
   - Verify readings match across different signal strengths

### Band-Specific Calibration Notes

The same calibration offset applies to **both** HF and VHF bands. However, if your antenna has significantly different gain characteristics across frequency ranges, calibrate at the frequency you use most often.

**Example**: If you primarily use VHF (144 MHz), calibrate with a 144 MHz signal.

### Calibration Limits and Safety

The system enforces safe calibration ranges:

- **Minimum offset**: -50 dB
- **Maximum offset**: +50 dB
- Values outside this range are automatically clamped

### Resetting Calibration

To return to factory defaults:

1. Open Settings → Rendering Settings → Signal Meter Calibration
2. Click "Reset" or set offset to 0 dB
3. The meter will use default calibration constants

## Troubleshooting

### S-Meter Shows S0 or Very Low Reading

**Possible Causes**:

- No antenna connected
- SDR device not receiving properly
- Frequency has no active signals
- Incorrect gain settings (too low)

**Solutions**:

- Check antenna connection
- Verify SDR is connected and working
- Tune to a known active frequency (e.g., FM broadcast band)
- Increase RF gain (LNA/VGA settings)
- Check calibration offset isn't extremely negative

### S-Meter Always Shows S9+60

**Possible Causes**:

- ADC clipping (signal too strong)
- Gain settings too high
- Very close to a powerful transmitter
- Incorrect calibration offset

**Solutions**:

- Reduce RF gain (LNA/VGA settings)
- Add external attenuator
- Check dBFS reading - should be below -3 dBFS
- Verify calibration offset isn't extremely positive
- Move antenna away from strong transmitter

### S-Meter Fluctuates Rapidly

**Possible Causes**:

- Fading signal (mobile, aircraft, or HF ionospheric propagation)
- Interference or QRM
- Normal behavior for weak AM signals
- Low smoothing setting

**Solutions**:

- This may be normal for certain signal types
- Increase smoothing factor in settings (if available)
- For stable CW or FM signals, rapid fluctuation may indicate interference

### Reading Doesn't Match My Other Receiver

**Possible Causes**:

- Different calibration
- Different bandwidth settings
- One receiver has antenna preamp, other doesn't
- Cable losses not accounted for

**Solutions**:

- Perform relative calibration (Method 3 above)
- Ensure both receivers use same bandwidth
- Account for external preamps or attenuators
- Check for cable/connector losses

### Band Shows "HF" but I'm on VHF

This occurs exactly at the 30 MHz transition. The system uses:

- **HF**: Frequencies **below** 30 MHz
- **VHF**: Frequencies **at or above** 30 MHz

If you're at 29.999 MHz, it shows HF. At 30.000 MHz, it shows VHF. This is correct behavior.

## Advanced Topics

### Understanding Measurement Uncertainty

S-Meter accuracy depends on calibration:

| Calibration Method                   | Typical Accuracy |
| ------------------------------------ | ---------------- |
| Uncalibrated (default)               | ±10 dB           |
| Factory calibration                  | ±5 dB            |
| User calibration (reference station) | ±3-5 dB          |
| User calibration (signal generator)  | ±1-3 dB          |

**Sources of Uncertainty**:

- Temperature drift (±2-3 dB over operating range)
- Frequency-dependent gain variations
- Cable/connector losses
- Antenna impedance mismatch
- Quantization noise at very low signals

### Frequency-Dependent Gain

SDR devices don't have perfectly flat frequency response. Gain may vary by ±5 dB across their full range. For most accurate results:

- Calibrate near the frequencies you use most
- Re-calibrate if you change frequency bands significantly
- Consider using multiple calibration profiles for different bands (future enhancement)

### Temperature Effects

Electronic components drift with temperature:

- Oscillators shift frequency slightly
- Amplifiers change gain
- Impact: ±2-5 dB over 0°C to 40°C range

For critical work, allow the SDR to warm up (10-15 minutes) and recalibrate periodically.

### Noise Floor vs Signal Floor

The S-Meter measures **total power** in the receiver's passband, including:

- Desired signal
- Noise (thermal, atmospheric, man-made)
- Interference

For very weak signals (S1-S3), the reading is largely noise. True signal strength may be lower than displayed. Advanced signal processing can separate signal from noise.

### Using S-Meter for Antenna Tuning

The S-Meter is useful for optimizing antenna performance:

1. **Tune to a Weak, Stable Signal**: Choose a distant station or beacon
2. **Note Current Reading**: Record the S-unit and dBm value
3. **Adjust Antenna**: Change position, orientation, or tuning
4. **Compare Results**: Higher S-reading = better antenna performance
5. **Iterate**: Repeat until you find optimal configuration

**Tip**: Use a distant station, not a local one. Local signals may be too strong to show subtle differences.

### Signal Reporting

When communicating with other radio operators, report signal strength using S-units:

**Standard RST Code** (Readability-Strength-Tone):

- **Readability**: 1 (unreadable) to 5 (perfectly readable)
- **Strength**: 1 (barely perceptible) to 9 (extremely strong)
- **Tone**: 1 (very rough) to 9 (perfect) - only for CW/digital modes

**Examples**:

- "Your signal is 5-9" = Perfectly readable, S9 strength
- "You're 5-7" = Perfectly readable, S7 strength
- "RST 5-7-9" = Perfect readability, S7 strength, perfect tone (CW)

## Performance Characteristics

### Update Rate

The S-Meter updates at:

- **Default**: 10 Hz (100 ms interval, 10 updates per second)
- **Range**: Configurable from 10-1000 ms per update (1-100 Hz)
- **Smoothing**: Exponential moving average prevents jitter

### Computational Overhead

The S-Meter uses minimal CPU resources:

- **Signal measurement**: < 0.1 ms per update
- **Visual rendering**: Hardware-accelerated CSS
- **Total impact**: < 0.1% CPU on modern hardware

### Accuracy Specifications

**Dynamic Range**:

- **Measurement range**: -150 dBFS to 0 dBFS
- **Display range**: S0 to S9+60 dB
- **Resolution**: 0.1 dB internally, rounded for display

**Response Time**:

- **10-90% rise time**: ~300 ms (with default smoothing)
- **Adjustable**: Via smoothing parameter
- **Peak detection**: Optional (future enhancement)

## Accessibility Features

The S-Meter is fully accessible to users with disabilities:

### Screen Reader Support

- **ARIA Live Region**: Announces signal changes (rate-limited to 1 per 2 seconds)
- **Semantic HTML**: Proper landmarks and headings
- **Descriptive Labels**: All visual elements have text equivalents

**Example Announcement**:

> "Signal strength: S7, minus 100 dBm"

### Keyboard Navigation

- All S-Meter controls are keyboard accessible
- Tab through interactive elements
- Calibration settings accessible via keyboard

### Visual Accessibility

- **High Contrast**: Color zones remain visible in high-contrast modes
- **Color Blind Safe**: Uses color + position + text for redundancy
- **Scalable**: Works at 200% browser zoom
- **Focus Indicators**: Clear 3px cyan ring on focused elements

### Reduced Motion

Users who prefer reduced motion see:

- No pulsing animation on very strong signals
- Instant transitions instead of smooth animations
- Static display that still updates values

Enable in browser: Settings → Accessibility → Reduce Motion

## Best Practices

### For Accurate Measurements

1. **Calibrate Regularly**: Monthly for critical work, or after hardware changes
2. **Allow Warmup Time**: 10-15 minutes for thermal stability
3. **Use Appropriate Gain**: Keep dBFS between -40 and -10 for best accuracy
4. **Check for Clipping**: If dBFS approaches 0, reduce gain immediately
5. **Account for Environment**: Temperature, nearby RF sources affect readings

### For Signal Reporting

1. **Use Standard Terms**: Stick to S-units (S1-S9+) for clarity
2. **Include Band Info**: "S7 on VHF" vs "S7 on HF" have different meanings
3. **Note Calibration**: Mention if using uncalibrated or calibrated readings
4. **Context Matters**: Weak signal reports are more useful than strong ones

### For Troubleshooting

1. **Start with Known Good Signal**: Tune to local FM broadcast to verify operation
2. **Check Multiple Frequencies**: Ensure issue isn't frequency-specific
3. **Compare with Other Tools**: Use multiple measurement methods
4. **Document Changes**: Note when readings change unexpectedly

## Frequently Asked Questions

### Q: Why does my S-Meter reading differ from other receivers?

**A**: Different receivers use different calibration and bandwidth settings. A wider bandwidth receiver will show higher readings because it captures more noise. Calibration differences can account for ±10 dB or more.

### Q: Can I trust the dBm readings without calibration?

**A**: Uncalibrated readings are approximate (±10 dB accuracy). They're useful for relative comparisons (this signal is 6 dB stronger than that one) but not for absolute measurements. Calibrate for precision work.

### Q: What's the difference between S-units and dB?

**A**: Below S9, each S-unit represents 6 dB. Above S9, we report directly in dB (e.g., S9+20). So S9+20 is 20 dB stronger than S9, which would be between S12 and S13 if we continued the S-unit scale (but we don't).

### Q: Why are HF and VHF S9 levels different?

**A**: VHF/UHF uses a different S9 reference level (-93 dBm vs -73 dBm for HF) to account for different operating conditions at these frequencies, including typically higher man-made noise and different propagation characteristics. This makes S-unit reports more comparable across bands.

### Q: Can I use the S-Meter for EMC/EMI measurements?

**A**: Not directly. The S-Meter shows approximate signal strength at the antenna input but doesn't account for antenna gain/directivity or comply with EMC test standards (CISPR, FCC Part 15). Use calibrated EMI test equipment for compliance testing.

### Q: How do I export S-Meter data for logging?

**A**: Currently, S-Meter readings are displayed in real-time. For logging, use the recording feature (if available) or third-party logging software that can capture signal levels. Future versions may include built-in logging.

### Q: Does the S-Meter work with all modulation types?

**A**: Yes. The S-Meter measures total received power regardless of modulation (AM, FM, SSB, CW, digital). However, modulation type affects how the signal "looks" - FM may show steady readings, AM may fluctuate with modulation, SSB depends on voice peaks.

### Q: Can I calibrate for my antenna gain?

**A**: The calibration offset accounts for your entire signal path, including antenna gain/loss, cable losses, and SDR device characteristics. If your antenna has +3 dB gain, you'd apply a -3 dB offset to see signal strength at an isotropic antenna.

## Related Documentation

- **[S-Meter Technical Specification](./s-meter-spec.md)** - Complete engineering specification
- **[Signal Analysis](./signal-analysis.md)** - Advanced signal measurement techniques
- **[SDR Basics](./sdr-basics.md)** - Introduction to SDR concepts
- **[Frequency Allocations](./frequency-allocations.md)** - Understanding radio bands

## Glossary

- **dBFS**: Decibels relative to Full Scale (ADC maximum input)
- **dBm**: Decibels relative to 1 milliwatt (absolute power)
- **S-unit**: Standardized signal strength unit (S0-S9 scale)
- **HF**: High Frequency band (below 30 MHz)
- **VHF**: Very High Frequency band (30-300 MHz)
- **UHF**: Ultra High Frequency band (300-3000 MHz)
- **Calibration Constant (K_cal)**: Offset between dBFS and dBm
- **Band**: Frequency range (HF vs VHF/UHF)
- **ADC**: Analog-to-Digital Converter
- **LNA**: Low Noise Amplifier
- **VGA**: Variable Gain Amplifier
- **EMF**: Electromotive Force
- **QRM**: Interference from other stations
- **QRN**: Noise from natural sources

## Support and Feedback

If you encounter issues with the S-Meter:

1. Check this guide's troubleshooting section
2. Review the [HackRF Troubleshooting Guide](./hackrf-troubleshooting.md) for device-specific issues
3. Search existing GitHub issues
4. Open a new issue with:
   - SDR device model
   - Frequency and mode
   - S-Meter reading vs expected reading
   - Calibration settings
   - Screenshots if helpful

---

**Version**: 1.0  
**Last Updated**: 2025-11-21  
**Authors**: rad.io Development Team  
**License**: Same as rad.io project
