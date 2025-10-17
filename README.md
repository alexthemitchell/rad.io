# rad.io - Software-Defined Radio Visualizer

A professional browser-based SDR application with industry-standard visualizations, universal device support, and comprehensive testing.

![rad.io Screenshot](https://github.com/user-attachments/assets/f86b68ed-3a56-4090-8b41-aaf0bf22e47d)

## Features

### 🎛️ Signal Control

- **AM/FM/P25 Band Selection**: Toggle between FM (88.1-107.9 MHz), AM (530-1700 kHz), and P25 Phase 2 (700-800 MHz, 150-174 MHz)
- **Preset Stations**: One-click tuning to popular stations
- **Manual Frequency Control**: Precise frequency adjustment
- **Device Configuration**: LNA gain, amplifier control, sample rate

### 📊 Professional Visualizations

- **IQ Constellation Diagram**: Density-based heat mapping with Z-ordering
- **Amplitude Waveform**: Time-domain envelope with reference lines
- **Power Spectral Density**: Viridis colormap spectrogram
- **Interactive Controls**: Pan, zoom, and multi-touch gestures for all visualizations
- **Keyboard Navigation**: Accessible controls for precision signal analysis

### 🎤 Speech Recognition & P25 Decoding

- **Browser-Native Transcription**: Web Speech API integration for real-time speech-to-text
- **AI-Ready Audio Stream**: Clean demodulated audio optimized for recognition
- **Multiple Language Support**: Transcribe communications in various languages
- **Robust Error Handling**: Gracefully handles noisy/distorted radio audio
- **P25 Phase 2 Decoder**: H-DQPSK demodulation, TDMA slot extraction, frame synchronization
- **Trunked Radio Support**: Monitor talkgroups, control channels, and encrypted transmissions

### 🔌 Universal Device Support

- **HackRF One**: Native implementation
- **RTL-SDR**: Format conversion utilities
- **Airspy**: Database support
- **Custom SDRs**: Implement `ISDRDevice` interface

### ✅ Quality Assurance

- **171+ Unit Tests**: Comprehensive coverage including accessibility tests
- **CI/CD Pipeline**: Automated lint, test, format, build, type-check
- **Zero External Dependencies**: Native WebAudio API and Canvas rendering

### ♿ Accessibility

- **WCAG 2.1 Level AA**: Comprehensive screen reader support
- **Keyboard Navigation**: Full keyboard control with arrow keys and shortcuts
- **ARIA Labels**: Descriptive text alternatives for all visualizations
- **Focus Management**: Clear visual indicators and logical tab order
- See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for complete documentation

## Quick Start

### Prerequisites

- Modern web browser with WebUSB support (Chrome 61+, Edge 79+, Opera 48+)
- HTTPS context (required for WebUSB)
- Compatible SDR device (HackRF One, RTL-SDR, etc.)

### Installation

```bash
# Clone repository
git clone https://github.com/alexthemitchell/rad.io.git
cd rad.io

# Install dependencies
npm install

# Start development server (HTTPS)
npm start
```

The application will be available at `https://localhost:8080`

### Building for Production

```bash
# Build optimized bundle
npm run build

# Output in dist/ directory
```

## Usage Guide

### Connecting Your SDR Device

1. **Connect Hardware**: Plug in your SDR device via USB
2. **Click "Connect Device"**: Browser will show device selection dialog
3. **Select Your Device**: Choose your SDR from the list
4. **Grant Permission**: Allow the web app to access the device

### Tuning to a Station

**Method 1: Preset Stations**

1. Select signal type (FM/AM)
2. Click a preset station button
3. Device automatically tunes to the frequency

**Method 2: Manual Entry**

1. Enter frequency in the input field
2. Units automatically adjust (MHz for FM, kHz for AM)
3. Press Enter or click away to apply

### Starting Reception

1. Ensure device is connected
2. Click "Start Reception" button
3. Visualizations update with live data
4. Click "Stop Reception" to pause

### Understanding the Visualizations

**IQ Constellation Diagram**

- Shows I (in-phase) and Q (quadrature) signal components
- Density-based coloring: blue (sparse) → cyan → white (dense)
- Circular pattern = FM signal
- Varying magnitude = AM modulation
- Distinct points = Digital modulation

**Amplitude Waveform**

- Time-domain signal envelope
- Red line = Maximum amplitude
- Orange line = Average amplitude
- Green line = Minimum amplitude
- Useful for: AM detection, signal strength monitoring

**Spectrogram (Power Spectral Density)**

- Frequency spectrum over time
- Color scale: Purple (low power) → Yellow (high power)
- Horizontal axis = Time
- Vertical axis = Frequency
- Bright bands = Strong signals

### Interactive Visualization Controls

All visualizations support advanced pointer and wheel events for intuitive exploration:

**Mouse & Pointer:**

- **Pan**: Click and drag to move the view
- **Zoom**: Use mouse wheel to zoom in/out
- **Reset**: Click "Reset View" button when transformed

**Touch & Multi-Touch:**

- **Pan**: Single finger drag
- **Pinch-to-Zoom**: Two finger pinch gesture
- **Tap**: Focus on specific signal features

**Keyboard Navigation** (for accessibility):

- **Arrow Keys**: Pan in any direction (←, →, ↑, ↓)
- **+/-**: Zoom in and out
- **0**: Reset to default view

See [Interactive Controls Documentation](./INTERACTIVE_CONTROLS.md) for detailed usage and configuration.

### Speech Recognition

**Basic Transcription**

1. Tune to a voice transmission (FM/AM)
2. Ensure good signal strength
3. Speech recognition automatically transcribes audio
4. View transcripts in real-time

**Supported Use Cases:**

- Public safety radio monitoring
- Aviation communications
- Amateur radio logging
- Emergency broadcast transcription
- Multi-language monitoring

**Note**: Web Speech API requires Chrome/Edge browsers and may request microphone permission.

### P25 Phase 2 Digital Radio

**Monitoring P25 Systems**

1. Select "P25" signal type
2. Configure system parameters:
   - Control Channel frequency (e.g., 770.95625 MHz)
   - NAC (Network Access Code)
   - System ID
   - WACN (Wide Area Communications Network)
3. Add talkgroups to monitor
4. Start reception to decode transmissions

**Understanding P25 Indicators**

- **Phase**: Shows P25 Phase 2 when decoding TDMA signals
- **TDMA Slot**: Indicates which time slot (1 or 2) is active
- **Signal Quality**: 0-100% based on constellation accuracy
- **Encryption**: Shows if transmission is encrypted
- **Talkgroup**: Active talkgroup ID and name

**P25 Features:**

- **H-DQPSK Demodulation**: Differential QPSK with 6000 symbols/sec
- **TDMA Slot Extraction**: Separates two simultaneous voice channels
- **Frame Synchronization**: Detects P25 frame boundaries
- **Signal Quality Metrics**: Real-time constellation analysis
- **Talkgroup Scanning**: Monitor multiple talkgroups simultaneously

**Frequency Bands:**

- **700 MHz Band**: 764-776 MHz, 794-806 MHz (most common)
- **800 MHz Band**: 851-870 MHz (also common)
- **VHF Band**: 150-174 MHz (rural/legacy systems)
- **UHF Band**: 450-470 MHz (some regions)

See [P25_DECODER.md](./P25_DECODER.md) for technical details and API documentation.

### Digital Signal Processing Pipeline

The DSP pipeline visualization shows the complete signal flow:

1. **RF Input**: Antenna signal reception
2. **Tuner**: Frequency selection
3. **I/Q Sampling**: Digital conversion
4. **FFT**: Frequency analysis
5. **Demodulation**: Signal extraction
6. **Audio Output**: Speaker/headphones

## Architecture

### Technology Stack

- **React 19**: UI framework
- **TypeScript**: Type-safe development
- **WebUSB API**: Hardware communication
- **WebAudio API**: DSP processing
- **HTML Canvas**: High-performance rendering
- **Jest**: Testing framework
- **Webpack**: Build tooling
- **GitHub Actions**: CI/CD pipeline

## Browser Compatibility

### Supported Browsers

- ✅ Google Chrome 61+
- ✅ Microsoft Edge 79+
- ✅ Opera 48+

### Not Supported

- ❌ Firefox (WebUSB not implemented)
- ❌ Safari (WebUSB not implemented)

**Note**: HTTPS context is required for WebUSB access.
