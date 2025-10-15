# rad.io - Software-Defined Radio Visualizer

A professional browser-based SDR application with industry-standard visualizations, universal device support, and comprehensive testing.

![rad.io Screenshot](https://github.com/user-attachments/assets/f86b68ed-3a56-4090-8b41-aaf0bf22e47d)

## Features

### 🎛️ Signal Control
- **AM/FM Band Selection**: Toggle between FM (88.1-107.9 MHz) and AM (530-1700 kHz)
- **Preset Stations**: One-click tuning to popular stations
- **Manual Frequency Control**: Precise frequency adjustment
- **Device Configuration**: LNA gain, amplifier control, sample rate

### 📊 Professional Visualizations
- **IQ Constellation Diagram**: Density-based heat mapping with Z-ordering
- **Amplitude Waveform**: Time-domain envelope with reference lines
- **Power Spectral Density**: Viridis colormap spectrogram

### 🔌 Universal Device Support
- **HackRF One**: Native implementation
- **RTL-SDR**: Format conversion utilities
- **Airspy**: Database support
- **Custom SDRs**: Implement `ISDRDevice` interface

### ✅ Quality Assurance
- **122+ Unit Tests**: Comprehensive coverage with realistic signal data
- **CI/CD Pipeline**: Automated lint, test, format, build, type-check
- **Zero External Dependencies**: Native WebAudio API and Canvas rendering

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

### Digital Signal Processing Pipeline

The DSP pipeline visualization shows the complete signal flow:

1. **RF Input**: Antenna signal reception
2. **Tuner**: Frequency selection
3. **I/Q Sampling**: Digital conversion
4. **FFT**: Frequency analysis
5. **Demodulation**: Signal extraction
6. **Audio Output**: Speaker/headphones

## Development

### Project Structure

```
src/
├── components/     # UI components and visualizations
├── models/         # SDR device implementations  
├── hooks/          # React hooks for device management
├── utils/          # DSP algorithms and utilities
├── pages/          # Top-level page components
└── styles/         # CSS styling
```

### Available Scripts

```bash
# Development
npm start              # HTTPS dev server with HMR
npm run dev            # Alias for npm start

# Quality Control
npm run lint           # ESLint validation
npm run lint:fix       # Auto-fix linting issues
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting
npm run type-check     # TypeScript validation
npm run validate       # Run all quality checks + build
npm run self-assess    # Run comprehensive self-assessment

# Testing
npm test               # Run all tests
npm run test:unit      # Run unit tests (DSP, memory, device)
npm run test:components # Run component tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report

# Build
npm run build          # Development build
npm run build:prod     # Production build

# Cleanup
npm run clean          # Remove build artifacts and dependencies
```

### Running Tests

```bash
# Run all 122+ tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only (faster)
npm run test:components  # Component tests only

# Test suites:
# - DSP Utilities (29 tests)
# - IQ Constellation (11 tests)
# - Spectrogram (13 tests)
# - SDR Device Interface (43 tests)
# - Realistic SDR Data (26 tests)
# - Memory Management (10 tests)
```

### Code Quality Standards

All pull requests must pass:
- ✅ ESLint validation
- ✅ Prettier formatting
- ✅ TypeScript type checking
- ✅ Jest test suite (100% pass rate)
- ✅ Webpack build

### Self-Assessment Agent

The repository includes an automated self-assessment agent that performs comprehensive quality checks:

```bash
# Run self-assessment
npm run self-assess

# View assessment reports
cat .serena/memories/index.md
```

**Features:**
- Code quality verification (lint, format, type-check)
- Build validation
- Test execution with coverage analysis
- Categorized improvement suggestions (critical, high, medium, low)
- Detailed markdown reports saved to `.serena/memories/`
- Automatic tracking and indexing of assessments

**When to use:**
- After completing a task or feature
- Before creating a pull request
- To verify quality standards are met
- To get constructive feedback on changes

See `.github/agents/README.md` for detailed documentation.

## Architecture

### Universal SDR Interface

All SDR devices implement the `ISDRDevice` interface:

```typescript
interface ISDRDevice {
  // Lifecycle
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;
  
  // Configuration
  setFrequency(frequencyHz: number): Promise<void>;
  setSampleRate(sampleRateHz: number): Promise<void>;
  setLNAGain(gainDb: number): Promise<void>;
  setAmpEnable(enabled: boolean): Promise<void>;
  
  // Streaming
  receive(callback?: IQSampleCallback): Promise<void>;
  stopRx(): Promise<void>;
  isReceiving(): boolean;
  
  // Metadata
  getDeviceInfo(): Promise<SDRDeviceInfo>;
  getCapabilities(): SDRCapabilities;
}
```

### Visualization Pipeline

1. **Raw IQ Samples**: Int8/Uint8/Int16 from device
2. **Format Conversion**: Convert to Float32Array
3. **DSP Processing**: FFT, magnitude calculation, dB conversion
4. **Canvas Rendering**: GPU-accelerated with high-DPI support

### Technology Stack

- **React 19**: UI framework
- **TypeScript**: Type-safe development
- **WebUSB API**: Hardware communication
- **WebAudio API**: DSP processing
- **HTML Canvas**: High-performance rendering
- **Jest**: Testing framework
- **Webpack**: Build tooling
- **GitHub Actions**: CI/CD pipeline

## Adding New SDR Devices

To add support for a new SDR device:

1. **Implement `ISDRDevice` interface**:
```typescript
export class YourSDRDevice implements ISDRDevice {
  // Implement all interface methods
}
```

2. **Add device to known devices database**:
```typescript
export const KNOWN_SDR_DEVICES: SDRUSBFilter[] = [
  { vendorId: 0xYOUR_VID, productId: 0xYOUR_PID, type: SDRDeviceType.YOUR_DEVICE }
];
```

3. **Create device hook**:
```typescript
export function useYourSDRDevice() {
  const { device: usbDevice, requestDevice } = useUSBDevice([
    { vendorId: 0xYOUR_VID }
  ]);
  // ... setup logic
}
```

4. **Add tests**: Create test suite in `src/models/__tests__/YourSDRDevice.test.ts`

## Browser Compatibility

### Supported Browsers
- ✅ Google Chrome 61+
- ✅ Microsoft Edge 79+
- ✅ Opera 48+

### Not Supported
- ❌ Firefox (WebUSB not implemented)
- ❌ Safari (WebUSB not implemented)

**Note**: HTTPS context is required for WebUSB access.

## Troubleshooting

### Device Not Detected

**Problem**: "No device found" when connecting

**Solutions**:
1. Verify USB connection
2. Check device is powered on
3. Try different USB port/cable
4. Ensure browser supports WebUSB
5. Grant USB permissions at OS level

### Connection Drops

**Problem**: Device disconnects during use

**Solutions**:
1. Check USB cable quality
2. Reduce USB cable length
3. Use powered USB hub
4. Update device firmware
5. Check for USB port power issues

### Slow Visualizations

**Problem**: Choppy or lagging displays

**Solutions**:
1. Reduce sample rate
2. Close other browser tabs
3. Enable hardware acceleration in browser
4. Update graphics drivers
5. Use smaller visualization windows

### Build Errors

**Problem**: `npm install` or `npm run build` fails

**Solutions**:
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Ensure Node.js version >= 16
4. Check for port conflicts (8080)
5. Clear npm cache: `npm cache clean --force`

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/your-feature`
3. **Make changes**: Follow code style and add tests
4. **Run quality checks**:
   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   npm test
   npm run build
   ```
5. **Commit changes**: `git commit -m "Add your feature"`
6. **Push to branch**: `git push origin feature/your-feature`
7. **Create Pull Request**: Automated checks will run

### Code Style Guidelines

- Use TypeScript strict mode
- Follow existing component patterns
- Add JSDoc comments for public APIs
- Write tests for new features
- Keep changes minimal and focused
- Update documentation

## Performance

### Bundle Size
- Production build: 4.9 MB (gzipped: ~1.2 MB)
- Zero external visualization dependencies
- Native WebAudio API and Canvas rendering

### Rendering Performance
- 60 FPS visualization updates
- GPU-accelerated canvas rendering
- Adaptive downsampling for large datasets
- High-DPI support for retina displays

### Test Coverage
- 122+ unit tests across 5 test suites
- 100% pass rate
- Mathematical accuracy validation
- Realistic signal data testing

## License

This project is open source. Please check the LICENSE file for details.

## Acknowledgments

- **Industry Standards**: IQ constellation best practices from UVic ECE Communications Labs
- **Scientific Colormaps**: Viridis from matplotlib project
- **WebUSB API**: W3C Web Incubator Community Group
- **Signal Processing**: DSP literature and research papers

## Support

For issues, questions, or feature requests:
- **GitHub Issues**: https://github.com/alexthemitchell/rad.io/issues
- **Documentation**: See `.github/copilot-instructions.md` for detailed technical docs
- **Examples**: Check test files for usage examples

## Roadmap

### Planned Features
- Real-time audio demodulation
- Waterfall display mode
- Recording and playback
- Additional device support (SDRPlay, BladeRF)
- Frequency scanning
- Signal strength meter
- Bandwidth filtering controls

### Performance Enhancements
- WebGL rendering for large datasets
- Web Workers for DSP processing
- OffscreenCanvas for background rendering
- **✅ WASM FFT implementations** (Implemented - see WASM_DSP.md)

---

**Built with ❤️ for the SDR community**
