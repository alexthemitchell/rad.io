# ATSC Digital TV Golden Path Guide

Welcome to rad.io's **Golden Path** for watching digital television! This guide walks you through the complete end-to-end workflow from connecting your hardware to watching ATSC broadcasts with closed captions and program information.

## What You'll Learn

By following this guide, you'll:

1. Connect your SDR hardware
2. Scan for ATSC digital TV channels in your area
3. Tune and play a channel with video and audio
4. View the Electronic Program Guide (EPG)
5. Enable closed captions
6. Monitor signal health and quality

**Estimated Time**: 15-20 minutes for your first complete workflow

## Prerequisites

### Hardware Requirements

- **SDR Device**: HackRF One or RTL-SDR (RTL2832U-based)
- **Antenna**: UHF/VHF TV antenna (indoor or outdoor)
- **Computer**: Modern laptop/desktop with USB port

### Software Requirements

- **Browser**: Google Chrome 61+, Microsoft Edge 79+, or Opera 48+
- **HTTPS**: The app must be served over HTTPS (WebUSB requirement)
- **Permissions**: Grant browser permission to access USB devices

### Knowledge Requirements

- Basic understanding of digital television (helpful but not required)
- No SDR or RF engineering knowledge needed!

## Step 1: Connect Your SDR Device

### 1.1 Physical Setup

1. **Connect Antenna**: Attach your UHF/VHF antenna to the SDR device's antenna port
2. **Connect USB**: Plug the SDR device into your computer's USB port
3. **Wait for Recognition**: Allow your operating system to recognize the device (5-10 seconds)

**Tip**: For best results, place your antenna near a window or outdoors with a clear view of broadcast towers.

### 1.2 Device Connection in rad.io

1. **Navigate to the App**: Open rad.io in your browser at `https://localhost:8080` (development) or your deployment URL
2. **Click "Connect Device"**: Located in the top-right corner of the application
3. **Browser Permission**: A dialog will appear asking to connect to a USB device
4. **Select Your Device**: Choose your SDR device from the list (e.g., "HackRF One" or "RTL2832U")
5. **Grant Permission**: Click "Connect" in the browser dialog

**Success Indicator**: You'll see a green "Connected" status in the top bar with your device name.

### Troubleshooting Device Connection

**Problem**: Device not appearing in the list

- **Solution**: Check USB cable connection, try a different USB port
- **Solution**: Ensure you're using HTTPS (WebUSB doesn't work on HTTP)
- **Solution**: Check browser console for errors

**Problem**: Permission denied

- **Solution**: Close other applications that might be using the SDR
- **Solution**: Try reconnecting the device
- **Solution**: Restart your browser

## Step 2: Scan for ATSC Channels

Now that your device is connected, let's discover what channels are available in your area.

### 2.1 Navigate to Scanner

1. **Press `2`** on your keyboard, OR
2. **Click "Scanner"** in the main navigation bar

You'll see the Scanner page with multiple scanning options.

### 2.2 Select ATSC Scanner

1. **Look for the Signal Type Selector** at the top of the page
2. **Select "ATSC"** from the dropdown
3. The ATSC Scanner panel will appear with band configuration options

### 2.3 Configure Scan Settings

**Recommended Settings for First Scan** (Best Balance of Speed and Accuracy):

- **Bands to Scan**:
  - ✅ VHF-High (Ch 7-13): 174-216 MHz
  - ✅ UHF (Ch 14-36): 470-608 MHz
  - ☐ VHF-Low (Ch 2-6): 54-88 MHz _(optional, fewer stations)_

- **Detection Threshold**: 15 dB _(default - good for most areas)_
- **Dwell Time**: 500 ms _(default - balances speed and accuracy)_
- **Require Pilot Tone**: ✅ Enabled _(reduces false positives)_
- **Require Sync Lock**: ☐ Disabled _(faster scan, still reliable)_

### 2.4 Start Scanning

1. **Click "Start Scan"** button
2. **Watch Progress**: The scanner shows:
   - Current channel being scanned (e.g., "Channel 14")
   - Progress bar and percentage
   - Number of channels found
3. **Wait for Completion**: A full scan takes 2-5 minutes depending on settings

**What's Happening**: The scanner tunes to each TV channel, analyzes the signal for ATSC pilot tones, and measures signal quality.

### 2.5 Review Found Channels

Once scanning completes, you'll see a table of discovered channels showing:

- **Channel Number**: Physical RF channel (e.g., 14, 21, 28)
- **Frequency**: Center frequency in MHz
- **Band**: VHF-High or UHF
- **Strength**: Signal strength percentage (0-100%)
- **SNR**: Signal-to-Noise Ratio in dB (higher is better)
- **Quality Indicators**: Pilot detected, sync locked

**Typical Results**: In urban/suburban areas, expect 15-30 channels. Rural areas may find 5-15 channels.

### 2.6 Save Channel List

Your found channels are automatically saved to browser storage (IndexedDB) and persist between sessions.

**Optional**: Click "Export" to download your channel list as JSON for backup or sharing.

## Step 3: Tune and Play a Channel

Now let's watch some TV!

### 3.1 Navigate to ATSC Player

1. **Press `6`** on your keyboard, OR
2. **Click "ATSC Player"** in the main navigation bar

You'll see the ATSC Player page with your scanned channels listed on the left.

### 3.2 Select a Channel

1. **Review Channel List**: Channels are sorted by signal strength (strongest first)
2. **Click on a Channel**: Select one with strong signal (green indicator, >70% strength)
3. **Wait for Tuning**: The player will show "Tuning..." status

**What's Happening**: The SDR tunes to the channel frequency, the demodulator locks onto the ATSC signal, and the transport stream parser begins extracting video and audio.

### 3.3 Understand Player Status

The player shows different states:

- **Idle**: No channel selected
- **Tuning**: Acquiring signal lock
- **Buffering**: Filling video/audio buffers
- **Playing**: Active playback (future - requires WebCodecs implementation)
- **Error**: Signal lost or demodulation failed

**Current Limitation**: Full video playback requires WebCodecs implementation (planned). You'll see signal analysis and program information, but not video yet.

### 3.4 Adjust Volume and Settings

**Playback Controls** (bottom of player):

- **Volume Slider**: Adjust audio level (0-100%)
- **Mute Button**: Quickly silence audio
- **Stop Button**: Stop playback and release resources
- **CC Toggle**: Enable/disable closed captions (when available)

## Step 4: View Electronic Program Guide (EPG)

ATSC broadcasts include rich program information via PSIP (Program and System Information Protocol).

### 4.1 Access Program Information

While tuned to a channel, the **Program Info** panel displays:

- **Program Title**: Name of current show
- **Description**: Brief synopsis
- **Start Time**: When the program began
- **Duration**: Total program length
- **Rating**: Content rating (TV-PG, TV-14, etc.)

**Data Source**: This information comes from the broadcast signal's Event Information Tables (EIT).

### 4.2 Navigate the Program Guide

**Full EPG Grid** (if implemented in your version):

1. Look for the "Program Guide" or "EPG" button/tab
2. View a grid showing:
   - Rows: Virtual channels (e.g., 7.1, 7.2, 14.1)
   - Columns: Time slots (now, next, upcoming)
3. Click on a program to see full details

**Note**: EPG data is broadcast periodically. It may take 30-60 seconds to receive complete guide information.

### 4.3 Virtual Channels

ATSC supports **virtual channel numbers** (e.g., 7.1, 7.2) that may differ from the **physical RF channel** (e.g., 29).

- **Physical Channel 29** might broadcast:
  - Virtual Channel 7.1 (main HD broadcast)
  - Virtual Channel 7.2 (sub-channel, different program)
  - Virtual Channel 7.3 (weather/news)

The EPG shows virtual channels, making it easier to find your favorite stations.

## Step 5: Enable Closed Captions

ATSC broadcasts include closed captions via CEA-608 (analog compatibility) and CEA-708 (digital) standards.

### 5.1 Turn On Captions

1. **Locate CC Toggle**: In the playback controls area
2. **Click to Enable**: Button changes to "CC: On"
3. **Captions Appear**: Text overlays on the video player (when available)

### 5.2 Caption Preferences

**Customization Options** (if available in Settings):

- **Font Size**: Small, Medium, Large
- **Background**: Opaque, Semi-transparent, Transparent
- **Color**: White, Yellow, Cyan
- **Position**: Top, Bottom, Custom

**Access Settings**: Click the gear icon or navigate to Settings → Captions

### 5.3 Caption Availability

**When Captions Are Available**:

- Live news broadcasts (usually excellent)
- Syndicated TV shows (usually present)
- Movies (usually present)

**When Captions May Be Missing**:

- Local commercials
- Low-budget programming
- Technical difficulties at the station

## Step 6: Monitor Signal Health

Understanding signal quality helps you optimize antenna placement and troubleshoot issues.

### 6.1 Signal Quality Meters

The **Signal Quality** panel shows real-time metrics:

#### SNR (Signal-to-Noise Ratio)

- **What it is**: Ratio of signal power to noise power
- **Good Values**: >20 dB
- **Fair Values**: 15-20 dB
- **Poor Values**: <15 dB
- **Impact**: Low SNR causes pixelation and audio dropouts

#### MER (Modulation Error Ratio)

- **What it is**: Measure of constellation accuracy
- **Good Values**: >25 dB
- **Fair Values**: 20-25 dB
- **Poor Values**: <20 dB
- **Impact**: Low MER indicates interference or multipath

#### BER (Bit Error Rate)

- **What it is**: Percentage of corrupted bits
- **Good Values**: <1e-6 (0.0001%)
- **Fair Values**: 1e-6 to 1e-4
- **Poor Values**: >1e-4
- **Impact**: High BER leads to video freezing

#### Signal Strength

- **What it is**: Raw received power level
- **Good Values**: 80-100%
- **Fair Values**: 60-80%
- **Poor Values**: <60%
- **Impact**: Weak signal requires antenna adjustment

### 6.2 Sync Lock Status

**Sync Lock Indicators**:

- **Green "Locked"**: Demodulator has acquired sync - stable signal
- **Yellow "Searching"**: Attempting to lock onto signal
- **Red "Lost"**: Sync lost - signal too weak or interrupted

**What Sync Lock Means**: The demodulator has aligned with the signal's segment and field sync patterns, essential for data recovery.

### 6.3 Improving Signal Quality

**If you're experiencing poor quality**:

1. **Adjust Antenna**:
   - Rotate for different orientation
   - Raise height for better line-of-sight
   - Move near window facing broadcast towers
   - Switch from indoor to outdoor antenna

2. **Reduce Interference**:
   - Move away from electronic devices (Wi-Fi routers, microwave ovens)
   - Try different USB ports on your computer
   - Use a shorter, higher-quality USB cable

3. **Amplification**:
   - Consider a low-noise amplifier (LNA) for distant signals
   - Be cautious - over-amplification can cause overload

4. **Frequency Selection**:
   - Try different channels broadcasting the same content
   - Some stations have stronger signals on different frequencies

## Advanced Tips

### Power User Shortcuts

- **Keyboard Navigation**: Press `6` from anywhere to jump to ATSC Player
- **Quick Stop**: Press `Esc` to stop playback
- **Volume Quick Adjust**: Use `+` and `-` keys (if implemented)

### Scanning Optimization

**Urban Areas (Many Stations, Strong Signals)**:

- Increase threshold to 20 dB (reduce false positives)
- Decrease dwell time to 300 ms (faster scan)
- Enable both pilot tone and sync lock requirements

**Rural Areas (Few Stations, Weak Signals)**:

- Decrease threshold to 10 dB (find distant signals)
- Increase dwell time to 1000 ms (more thorough)
- Require pilot tone only (sync lock may be unreliable)

### Recording and Time-Shifting

**Future Feature**: Recording will allow you to:

- Save programs for later viewing
- Build a personal library
- Export in standard formats

**Current Status**: Foundation is implemented; stay tuned for updates.

## Troubleshooting

### No Channels Found During Scan

**Possible Causes**:

1. **Antenna Not Connected**: Check physical connection
2. **Wrong Bands Selected**: Enable all three bands (VHF-Low, VHF-High, UHF)
3. **Threshold Too High**: Lower to 10 dB and rescan
4. **Location**: You may be too far from broadcast towers
5. **Antenna Type**: Indoor antenna may not be sufficient

**Solutions**:

- Use an outdoor antenna with higher gain
- Check AntennaWeb.org or RabbitEars.info for tower locations
- Aim antenna toward broadcast towers

### Channel Found But Won't Play

**Possible Causes**:

1. **Signal Too Weak**: SNR <15 dB is unreliable
2. **Intermittent Signal**: Multipath or obstruction
3. **WebCodecs Not Implemented**: Video playback requires browser support

**Solutions**:

- Improve antenna setup (see Signal Quality section)
- Try a different channel
- Check browser console for errors

### Choppy Audio or Video

**Possible Causes**:

1. **Low SNR**: Signal degradation
2. **CPU Overload**: Too many applications running
3. **USB Bandwidth**: Interference or slow USB connection

**Solutions**:

- Close unnecessary applications
- Use a USB 3.0 port (for HackRF)
- Lower sample rate in device settings
- Check signal quality meters

### Closed Captions Not Appearing

**Possible Causes**:

1. **Station Not Broadcasting Captions**: Some content lacks CC data
2. **Caption Service Not Selected**: Try CC1, CC2, CC3
3. **Parser Not Implemented**: CEA-708 requires complex decoding

**Solutions**:

- Verify captions are enabled (CC toggle)
- Try a different channel/program
- Check console for caption parser errors

## Next Steps

### Explore Advanced Features

Now that you've mastered the golden path, explore:

1. **Analysis Page** (`4`): Deep signal analysis with spectrum, constellation, eye diagrams
2. **Scanner** (`2`): Try scanning FM radio or P25 trunked radio
3. **Recordings** (`5`): Save IQ samples for offline analysis
4. **Bookmarks**: Mark favorite channels for quick access

### Learn More

- **[ATSC Scanner Documentation](../features/ATSC-Scanner.md)**: Detailed scanner reference
- **[ATSC Player Documentation](../atsc-player-implementation.md)**: Player architecture and API
- **[Architecture Overview](../../ARCHITECTURE.md)**: How rad.io works under the hood
- **[Contributing Guide](../../CONTRIBUTING.md)**: Help improve rad.io

### Join the Community

- **[GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)**: Ask questions and share setups
- **[Report Issues](https://github.com/alexthemitchell/rad.io/issues)**: Bug reports and feature requests
- **[Contribute](../../CONTRIBUTING.md)**: Submit improvements and new features

## Glossary

**ATSC**: Advanced Television Systems Committee - North American digital TV standard  
**8-VSB**: 8-level Vestigial Sideband modulation used by ATSC  
**BER**: Bit Error Rate - percentage of corrupted bits  
**CEA-608/708**: Closed caption standards for analog and digital TV  
**EPG**: Electronic Program Guide - TV schedule data  
**MER**: Modulation Error Ratio - signal quality metric  
**PSIP**: Program and System Information Protocol - metadata in ATSC  
**RF Channel**: Physical broadcast channel (2-36)  
**SDR**: Software-Defined Radio - radio implemented in software  
**SNR**: Signal-to-Noise Ratio - signal quality measurement  
**UHF**: Ultra High Frequency (470-608 MHz) - TV channels 14-36  
**VHF**: Very High Frequency (54-216 MHz) - TV channels 2-13  
**Virtual Channel**: Logical channel number (e.g., 7.1) distinct from RF channel

## Frequently Asked Questions

**Q: Can I watch encrypted/premium channels?**  
A: No. rad.io is for free over-the-air ATSC broadcasts only. Encrypted channels require a cable/satellite subscription and cannot be decoded.

**Q: Does rad.io work with ATSC 3.0 (NextGen TV)?**  
A: Not yet. Current implementation supports ATSC 1.0 (8-VSB). ATSC 3.0 support is on the roadmap.

**Q: Why can't I see video yet?**  
A: Full video decoding requires WebCodecs API integration. The foundation is implemented; full playback is coming soon. You can currently see program info and signal analysis.

**Q: How much bandwidth does scanning use?**  
A: Scanning itself uses minimal internet bandwidth (none if offline). The SDR receives RF signals over-the-air, not the internet.

**Q: Can I record shows?**  
A: Recording foundation exists (IQ sample recording), but scheduled recording and playback are not yet implemented. This is a high-priority feature.

**Q: Is rad.io legal?**  
A: Yes. Receiving free over-the-air broadcast television is legal. However, recording and redistributing copyrighted content may violate laws. Use responsibly.

## Conclusion

Congratulations! You've completed the **ATSC Golden Path** and learned the complete workflow from hardware connection to watching digital TV with program information and signal monitoring.

**What you accomplished**:

- ✅ Connected and configured your SDR device
- ✅ Scanned for ATSC channels in your area
- ✅ Tuned to a channel and monitored playback
- ✅ Viewed program guide information
- ✅ Enabled closed captions
- ✅ Monitored and optimized signal quality

You now have the skills to explore the full power of rad.io!

**Happy SDR-ing!** 📡📺✨
