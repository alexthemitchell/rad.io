# System Audio Loopback Configuration Guide

## Overview

This guide explains how to route system audio (from rad.io's demodulated SDR audio) to your microphone input, enabling the Speech Recognition feature to transcribe actual radio broadcasts instead of requiring manual microphone-based transcription.

**Important**: This is an advanced configuration that requires installing additional software and configuring your operating system's audio routing.

## Understanding the Challenge

The Web Speech API's `SpeechRecognition` interface requires live microphone input via `getUserMedia()`. It cannot directly process audio from web applications. To work around this limitation, we need to create a "virtual audio cable" that routes output audio back into an input device.

## Platform-Specific Guides

### Windows

#### Option 1: VB-Audio Virtual Cable (Recommended - Free)

1. **Download and Install**
   - Visit: https://vb-audio.com/Cable/
   - Download "VB-CABLE Virtual Audio Device"
   - Run installer as Administrator
   - Restart your computer after installation

2. **Configure Windows Audio**
   - Right-click the speaker icon in the system tray
   - Select "Open Sound settings"
   - Under "Output", select "CABLE Input (VB-Audio Virtual Cable)"
   - Under "Input", verify "CABLE Output (VB-Audio Virtual Cable)" appears

3. **Configure rad.io**
   - Open rad.io in your browser
   - Start audio playback from the SDR
   - Switch to "Manual" mode in Speech Recognition
   - Allow microphone access when prompted
   - The browser will now capture the loopback audio

4. **Optional: Monitor Audio**
   - To hear audio while transcribing:
     - Open "Sound" control panel
     - Go to "Recording" tab
     - Right-click "CABLE Output", select "Properties"
     - Go to "Listen" tab
     - Check "Listen to this device"
     - Select your speakers/headphones as playback device

#### Option 2: Voicemeeter (Free - More Features)

1. **Download and Install**
   - Visit: https://vb-audio.com/Voicemeeter/
   - Download Voicemeeter (standard version works fine)
   - Install and restart

2. **Configure Voicemeeter**
   - Set Hardware Input 1 to your physical microphone (if needed)
   - Set Hardware Out A1 to your speakers/headphones
   - Enable "B1" virtual output

3. **Configure Windows Audio**
   - Set system default output to "Voicemeeter Input"
   - Set rad.io browser to use "Voicemeeter Input"

4. **Configure Browser**
   - In rad.io, select "Voicemeeter Output" as microphone
   - Enable speech recognition

### macOS

#### Option 1: BlackHole (Recommended - Free, Open Source)

1. **Install BlackHole**

   ```bash
   brew install blackhole-2ch
   # Or download from: https://existential.audio/blackhole/
   ```

2. **Create Multi-Output Device**
   - Open "Audio MIDI Setup" (in /Applications/Utilities/)
   - Click "+" at bottom left, select "Create Multi-Output Device"
   - Check both "BlackHole 2ch" and your speakers/headphones
   - This allows you to hear audio while routing it

3. **Create Aggregate Device** (for input)
   - In Audio MIDI Setup, click "+" again
   - Select "Create Aggregate Device"
   - Check "BlackHole 2ch"
   - This creates the virtual microphone input

4. **Configure System Audio**
   - Set Multi-Output Device as your system output
   - rad.io audio will now play through speakers AND BlackHole

5. **Configure Browser**
   - In rad.io Speech Recognition, select "BlackHole 2ch" as microphone
   - Allow microphone access
   - Audio will be captured for transcription

#### Option 2: Loopback by Rogue Amoeba (Paid - $99)

1. **Install Loopback**
   - Purchase and download from: https://rogueamoeba.com/loopback/
   - Install the application

2. **Create Virtual Device**
   - Open Loopback
   - Create new virtual device
   - Add "Chrome" (or your browser) as source
   - Name it "rad.io Loopback"

3. **Configure Browser**
   - In rad.io, set system audio to use the Loopback device
   - Select the Loopback device as microphone input
   - Enable speech recognition

### Linux

#### Option 1: PulseAudio Loopback Module (Built-in)

1. **Enable Loopback Module**

   ```bash
   # Load the module
   pactl load-module module-loopback latency_msec=1

   # To make permanent, add to /etc/pulse/default.pa:
   # load-module module-loopback latency_msec=1
   ```

2. **Configure with pavucontrol**

   ```bash
   # Install if not present
   sudo apt-get install pavucontrol  # Debian/Ubuntu
   sudo dnf install pavucontrol       # Fedora

   # Launch
   pavucontrol
   ```

3. **Route Audio**
   - In pavucontrol, go to "Recording" tab
   - Find your browser's audio input
   - Set it to "Monitor of [your output device]"

4. **Configure rad.io**
   - In Speech Recognition, select "Monitor of [device]" as microphone
   - Enable speech recognition

#### Option 2: PipeWire (Modern Linux)

If you're using PipeWire (default on newer Fedora, Ubuntu 22.04+):

1. **Check if PipeWire is running**

   ```bash
   systemctl --user status pipewire pipewire-pulse
   ```

2. **Use pw-loopback**

   ```bash
   # Create a loopback
   pw-loopback -P "rad.io-loopback" -C "rad.io-source"
   ```

3. **Configure with qpwgraph**

   ```bash
   # Install if not present
   sudo apt-get install qpwgraph  # Ubuntu/Debian

   # Launch and visually connect audio paths
   qpwgraph
   ```

## Browser-Specific Configuration

### Google Chrome / Microsoft Edge

1. **Access Site Settings**
   - Click the lock icon in address bar
   - Select "Site settings"
   - Or navigate to: `chrome://settings/content/microphone`

2. **Allow Microphone Access**
   - Ensure rad.io is allowed to use microphone
   - Select the virtual audio device from the dropdown

3. **Test Configuration**
   - Go to `chrome://settings/content/microphone`
   - Test your virtual device to ensure it's receiving audio

### Firefox

1. **Access Permissions**
   - Click the lock icon in address bar
   - Select "Connection secure" → "More information"
   - Go to "Permissions" tab

2. **Configure Microphone**
   - Allow microphone access for the site
   - Select your virtual audio device

3. **Advanced Configuration** (if needed)
   - Navigate to `about:config`
   - Search for `media.navigator.permission.disabled`
   - Can be used to test without permission prompts (not recommended for production)

### Safari

1. **System Preferences**
   - Go to System Preferences → Security & Privacy
   - Go to "Microphone" tab
   - Ensure Safari has permission

2. **Safari Settings**
   - Safari → Preferences → Websites → Microphone
   - Set rad.io to "Allow"
   - Select your virtual audio device

## Troubleshooting

### No Audio in Transcription

**Symptoms**: Speech recognition starts but produces no transcripts

**Solutions**:

1. Verify virtual audio device is selected as browser microphone
2. Check system volume levels (both output and input)
3. Test virtual device in system sound settings
4. Ensure rad.io audio playback is active
5. Try restarting the browser after audio configuration changes

### Hearing Echo or Feedback

**Symptoms**: Audio loops or echoes through speakers

**Solutions**:

1. Use multi-output device (macOS) or Voicemeeter (Windows)
2. Mute system audio monitoring
3. Reduce buffer sizes in virtual audio device settings
4. Use headphones instead of speakers

### Poor Transcription Quality

**Symptoms**: Many incorrect transcriptions or "[no-speech]" errors

**Solutions**:

1. Increase audio buffer size in rad.io (better stability)
2. Adjust input gain on virtual device
3. Enable noise suppression in browser (if available)
4. Ensure signal strength is good (check waveform visualization)
5. Use FM broadcasts (generally clearer than AM)
6. Avoid times with heavy atmospheric interference

### Latency Issues

**Symptoms**: Noticeable delay between audio and transcription

**Solutions**:

1. Reduce buffer sizes in virtual audio device (increases CPU usage)
2. Use PipeWire instead of PulseAudio (Linux)
3. Use dedicated virtual audio device (not system loopback)
4. Close other audio applications
5. Use lower sample rate (2.048 MSPS instead of 20 MSPS)

### Browser Can't Find Virtual Device

**Symptoms**: Virtual audio device doesn't appear in browser microphone list

**Solutions**:

1. Restart browser completely (close all windows)
2. Check device appears in system sound settings
3. Reinstall virtual audio driver
4. Restart computer after driver installation
5. Grant browser permission to access microphone at system level

## Security Considerations

### Privacy

- Virtual audio devices route ALL system audio to the microphone input
- Be aware of what's playing when speech recognition is active
- Other applications may access the virtual microphone

### Recommendations

1. **Dedicated Browser Profile**: Create a separate browser profile for rad.io
2. **Selective Routing**: Use Voicemeeter (Windows) or Loopback (macOS) to route only specific applications
3. **Temporary Configuration**: Disable virtual audio devices when not using rad.io
4. **Review Permissions**: Regularly check which sites have microphone access

## Performance Impact

### CPU Usage

- Virtual audio routing: Minimal (< 1% CPU)
- Speech recognition: Moderate (5-10% CPU)
- Combined impact: Generally acceptable on modern systems

### Memory Usage

- Virtual audio buffer: ~10-50 MB
- Speech recognition: ~50-100 MB
- Total additional: ~100-150 MB

### Recommended Specifications

- **Minimum**: Dual-core CPU, 4GB RAM
- **Recommended**: Quad-core CPU, 8GB RAM
- **Optimal**: Six-core+ CPU, 16GB RAM

## Testing Your Setup

### Quick Test Procedure

1. **Install and configure virtual audio device** (following OS-specific guide above)
2. **Open rad.io** in your browser
3. **Start audio playback** from SDR
4. **Verify audio is audible** (through speakers or monitoring)
5. **Enable Speech Recognition** (Manual mode)
6. **Grant microphone permission** and select virtual device
7. **Tune to a station** with clear voice content (news, talk radio)
8. **Watch for transcripts** to appear in real-time

### Verification Steps

- [ ] System audio plays through speakers/headphones
- [ ] Virtual audio device appears in system sound settings
- [ ] Browser can access virtual device as microphone
- [ ] rad.io audio playback is active
- [ ] Speech recognition mode is set to "Manual"
- [ ] Transcripts appear with reasonable accuracy
- [ ] No audio feedback or echo
- [ ] Latency is acceptable (< 2 seconds)

## Alternative Approaches

### Server-Side Speech Recognition

If system audio loopback is too complex, consider server-side alternatives:

1. **Google Cloud Speech-to-Text**
   - More accurate than Web Speech API
   - Requires backend server
   - Costs: $0.006 per 15 seconds

2. **Amazon Transcribe**
   - Real-time streaming support
   - Multiple language support
   - Costs: $0.0004 per second

3. **OpenAI Whisper**
   - Open-source, can self-host
   - Very accurate
   - Requires GPU for real-time

**Note**: Server-side solutions require backend infrastructure and are beyond the scope of this browser-only implementation.

## Support Resources

### Virtual Audio Software

- **VB-Audio**: https://vb-audio.com/Cable/
- **BlackHole**: https://existential.audio/blackhole/
- **Loopback**: https://rogueamoeba.com/loopback/
- **PulseAudio**: https://www.freedesktop.org/wiki/Software/PulseAudio/
- **PipeWire**: https://pipewire.org/

### Community Help

- rad.io GitHub Issues: Report problems or ask questions
- Audio routing forums: Check OS-specific audio communities
- Browser documentation: Refer to browser-specific WebRTC guides

## Summary

System audio loopback enables true radio-to-text transcription by routing rad.io's demodulated audio to the browser's microphone input. While this requires additional software and configuration, it unlocks the full potential of the Speech Recognition feature for monitoring and logging radio communications.

The setup difficulty varies by platform:

- **Easiest**: Linux (built-in PulseAudio loopback)
- **Moderate**: Windows (requires VB-Cable or Voicemeeter)
- **Advanced**: macOS (requires BlackHole or paid Loopback app)

Once configured, the system works seamlessly and provides near-real-time transcription of radio broadcasts directly from the SDR signal chain.
