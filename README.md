# rad.io - Software-Defined Radio Visualizer

[![codecov](https://codecov.io/gh/alexthemitchell/rad.io/branch/main/graph/badge.svg)](https://codecov.io/gh/alexthemitchell/rad.io)
[![Quality Checks](https://github.com/alexthemitchell/rad.io/actions/workflows/quality-checks.yml/badge.svg)](https://github.com/alexthemitchell/rad.io/actions/workflows/quality-checks.yml)

A professional browser-based SDR application with industry-standard visualizations, universal device support, and comprehensive testing.

## 🎯 New to rad.io? Start with the Golden Path

**Want to watch digital TV with your SDR?** Follow our step-by-step [**ATSC Digital TV Golden Path Guide**](docs/tutorials/atsc-golden-path.md) to learn the complete end-to-end workflow:

1. 🔌 **Connect** your SDR device
2. 🔍 **Scan** for ATSC channels in your area
3. 📺 **Tune and Play** a channel
4. 📋 **View** the Electronic Program Guide (EPG)
5. 💬 **Enable** closed captions
6. 📊 **Monitor** signal health and quality

**Estimated time**: 15-20 minutes | **No SDR experience required!**

[**→ Start the ATSC Golden Path Guide**](docs/tutorials/atsc-golden-path.md)

---

## Common Usecases

### Live FM Radio

### Live AM Radio

### Police Scanner

### Listening to Walkie Talkies

## Features

### Signal Control 🎛️

- **AM/FM/P25/Digital Mode Selection**: Toggle between FM (88.1-107.9 MHz), AM (530-1700 kHz), P25 Phase 2 (700-800 MHz, 150-174 MHz), PSK31, and FT8
- **Preset Stations**: One-click tuning to popular stations
- **Manual Frequency Control**: Precise frequency adjustment
- **Frequency Scanner**: Automated scanning across user-defined ranges with signal detection and logging
- **Device Configuration**: LNA gain, amplifier control, sample rate

### Professional Visualizations 📊

- **IQ Constellation Diagram**: Density-based heat mapping with Z-ordering
- **Amplitude Waveform**: Time-domain envelope with reference lines
- **Power Spectral Density**: Viridis colormap spectrogram
- **Waterfall Display**: Real-time scrolling frequency spectrum over time - perfect for identifying transient signals
- **Interactive Controls**: Pan, zoom, and multi-touch gestures for all visualizations
- **Keyboard Navigation**: Accessible controls for precision signal analysis

**Modern GPU Acceleration**:

- **WebGPU Rendering**: Modern GPU API for maximum performance (Chrome 113+, Edge 113+)
- **WebGL Fallback**: Wide browser support with hardware acceleration
- **Progressive Enhancement**: Graceful degradation to Canvas 2D for older browsers
- **Zero Dependencies**: Native browser APIs only - no external visualization libraries

### Speech Recognition & P25 Decoding 🎤

- **Browser-Native Transcription**: Web Speech API integration for real-time speech-to-text
- **AI-Ready Audio Stream**: Clean demodulated audio optimized for recognition
- **Multiple Language Support**: Transcribe communications in various languages
- **Robust Error Handling**: Gracefully handles noisy/distorted radio audio
- **P25 Phase 2 Decoder**: H-DQPSK demodulation, TDMA slot extraction, frame synchronization
- **Trunked Radio Support**: Monitor talkgroups, control channels, and encrypted transmissions
- **Digital Mode Decoders**: PSK31 (BPSK/QPSK with Varicode), FT8 (stub with full architecture)
- **Real-Time Text Display**: Auto-scrolling message history with SNR and frequency indicators

### Universal Device Support 🔌

rad.io features a **comprehensive device integration framework** that enables plug-and-play support for multiple SDR hardware platforms.

**Supported Devices:**

- **HackRF One**: Native WebUSB implementation (1 MHz - 6 GHz)
- **RTL-SDR**: Full support for RTL2832U-based devices (24-1766 MHz)
- **Airspy**: Database support (coming soon)
- **Custom SDRs**: Extensible architecture via `ISDRDevice` interface

**Framework Features:**

- **Universal Interface**: All devices implement the same `ISDRDevice` interface
- **Type-Safe Integration**: Strict TypeScript with comprehensive type checking
- **Plug-and-Play**: Automatic device detection and configuration
- **Memory Management**: Built-in buffer tracking and cleanup
- **Comprehensive Testing**: Full test coverage for device implementations

**Developer Resources:**

- 📖 [Add a New SDR Device Guide](docs/how-to/add-new-sdr-device.md) - Step-by-step instructions
- 📚 [Architecture Documentation](ARCHITECTURE.md) - Framework design and patterns
- 🗄️ [State & Persistence Guide](ARCHITECTURE.md#state--persistence) - Managing state across the app
- 📝 See existing device implementations in `src/models/` for reference

Adding a new device takes ~200 lines of code following the patterns in existing implementations.

### Plugin System 🔌

rad.io features an **extensible plugin architecture** that allows developers to add custom features without modifying the core codebase.

**Plugin Types:**

- **Demodulator Plugins**: Custom signal demodulation (FM, AM, SSB, digital modes)
- **Visualization Plugins**: Custom displays for signal analysis
- **Device Driver Plugins**: Add support for new SDR hardware
- **Utility Plugins**: General integrations and tools

**Framework Features:**

- **Type-Safe**: Full TypeScript support with strict type checking
- **Lifecycle Management**: Automated initialization, activation, and cleanup
- **Configuration**: Schema-based plugin configuration
- **Event System**: Plugin state change notifications
- **Testing**: Easy to unit test with Jest

**Developer Resources:**

- 📖 [Creating Your First Plugin Tutorial](docs/tutorials/03-creating-plugins.md) - Step-by-step guide
- 📚 [Plugin Developer How-To Guides](docs/how-to/) - Demodulator, Visualization, and Device Driver plugins
- 🎨 [Plugin Templates](templates/plugin-templates/) - Starter templates with examples
- 📐 [Plugin System Architecture (ADR-0024)](docs/decisions/0024-plugin-system-architecture.md) - Design decisions
- 💡 [Example Plugins](src/plugins/) - Reference implementations

Creating a plugin takes ~100-200 lines of code using the provided templates and following established patterns.

### Quality Assurance ✅

- **Comprehensive Unit Tests**: Coverage across DSP, devices, and components
- **CI/CD Pipeline**: Automated lint, test (with coverage), format, build, and type-check
- **Standard Visualization Interface**: `IVisualizationRenderer` ensures consistent rendering across WebGPU, WebGL, and Canvas backends
- **Zero External Visualization Dependencies**: Native WebAudio API and Canvas rendering

### Accessibility ♿

rad.io is committed to providing a fully accessible experience for all users, including those using assistive technologies. The application follows **WCAG 2.1 Level AA** standards and implements modern web accessibility best practices.

#### Key Features

- **Full Keyboard Navigation**: Complete control without a mouse - all features accessible via keyboard shortcuts
- **Screen Reader Support**: Comprehensive ARIA labels, semantic HTML, and live regions for real-time updates
- **Focus Management**: Clear 3px cyan focus indicators (≥3:1 contrast) with logical tab order
- **Skip Links**: Jump directly to main content (first tab stop)
- **Color Accessibility**: WCAG AA compliant contrast (4.5:1 text, 3:1 UI) with colorblind-safe palettes (Viridis)
- **Responsive & Scalable**: Works at 200% browser zoom, touch targets ≥44×44px on mobile
- **Reduced Motion**: Respects `prefers-reduced-motion` for users sensitive to animations

#### Testing & Compliance

- **36 Automated Tests**: jest-axe + manual ARIA/keyboard tests (all passing)
- **E2E Testing**: @axe-core/playwright for full-page accessibility scans
- **ESLint Enforcement**: 25+ jsx-a11y rules enforced in CI/CD
- **Zero Critical Violations**: Continuous monitoring with automated tools
- **Manual Testing**: Quarterly screen reader testing (NVDA, VoiceOver)
- **Continuous Compliance**: Documented processes for ongoing accessibility (ADR-0023)

#### Documentation

- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - Feature documentation and user guide
- **[ACCESSIBILITY-TESTING-GUIDE.md](./docs/ACCESSIBILITY-TESTING-GUIDE.md)** - Testing procedures for contributors
- **[ADR-0017](./docs/decisions/0017-comprehensive-accessibility-patterns.md)** - Accessibility patterns
- **[ADR-0023](./docs/decisions/0023-continuous-accessibility-compliance-modern-web-standards.md)** - Continuous compliance process

**Compliance Badge**: WCAG 2.1 AA Compliant ✓

## Documentation

rad.io uses the **[Diátaxis framework](https://diataxis.fr/)** to organize documentation by user needs. Find exactly what you need:

### 📚 [Tutorials](docs/tutorials/) - Learn by Doing

Step-by-step guides for beginners:

- [Getting Started](docs/tutorials/01-getting-started.md) - Set up and run rad.io
- [Your First Visualization](docs/tutorials/02-first-visualization.md) - Build a spectrum analyzer
- [More tutorials →](docs/tutorials/)

### 🔧 [How-To Guides](docs/how-to/) - Solve Problems

Task-focused guides for specific goals:

- [Add a New SDR Device](docs/how-to/add-new-sdr-device.md)
- [Debug WebUSB Issues](docs/how-to/debug-webusb.md)
- [Optimize DSP Performance](docs/how-to/optimize-dsp-performance.md)
- [More how-tos →](docs/how-to/)

### 📖 [Reference](docs/reference/) - Look Up Details

Technical specifications and API docs:

- [SDR Basics](docs/reference/sdr-basics.md)
- [DSP Fundamentals](docs/reference/dsp-fundamentals.md)
- [More reference docs →](docs/reference/)

### 💡 [Explanation](docs/explanation/) - Understand Why

Design rationale and concepts:

- [SDR Architecture Overview](docs/explanation/sdr-architecture-overview.md)
- [WebUSB Integration](docs/explanation/webusb-browser-integration.md)
- [Architecture Decision Records](docs/decisions/)
- [More explanations →](docs/explanation/)

**Complete documentation index:** [docs/README.md](docs/README.md)

## Quick Start

### For New Contributors 🚀

**New to the project?** Start here:

- 📚 **[New Contributor Onboarding Guide](docs/ONBOARDING.md)** - Get started in minutes
- 🏗️ **[Visualization Architecture](docs/VISUALIZATION_ARCHITECTURE.md)** - Understand the system design
- 🧪 **[Testing Strategy](docs/testing/TEST_STRATEGY.md)** - Learn how to test your code
- 🔌 **[E2E Testing Guide](docs/e2e-tests.md)** - Test with and without hardware

### Prerequisites

- Modern web browser with WebUSB support (Chrome 61+, Edge 79+, Opera 48+)
- HTTPS context (required for WebUSB)
- Compatible SDR device (HackRF One, RTL-SDR, etc.) - _optional for development_

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

The development server runs over HTTPS at `https://localhost:8080` by default.

### Running Tests

```bash
# Unit tests (no hardware required)
npm test

# E2E tests with simulated device (no hardware required)
npm run test:e2e

# E2E tests with real HackRF (requires hardware)
export E2E_REAL_HACKRF=1
npm run test:e2e
```

See [Testing Documentation](docs/testing/README.md) for comprehensive testing guide.

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

#### Method 1: Preset Stations

1. Select signal type (FM/AM)
2. Click a preset station button
3. Device automatically tunes to the frequency

#### Method 2: Manual Entry

1. Enter frequency in the input field
2. Units automatically adjust (MHz for FM, kHz for AM)
3. Press Enter or click away to apply

### Starting Reception

1. Ensure device is connected
2. Click "Start Reception" button
3. Visualizations update with live data
4. Click "Stop Reception" to pause

### Frequency Scanner

The automated frequency scanner sweeps through a user-defined range to detect and log active signals with automatic signal type classification.

**Configuration:**

1. **Start Frequency**: Lower bound of scan range (MHz)
2. **End Frequency**: Upper bound of scan range (MHz)
3. **Step Size**: Frequency increment between scans (kHz)
4. **Detection Threshold**: Signal strength required to log a signal (0-100%)
5. **Dwell Time**: Time spent on each frequency (ms)

**Usage:**

1. Configure scan parameters (default: 88-108 MHz, 100 kHz steps, 30% threshold)
2. Click "Start Scan" to begin automated scanning
3. Active signals are detected and logged in the table
4. Use "Pause" to temporarily halt scanning
5. Use "Resume" to continue from paused state
6. Use "Stop" to end scanning completely
7. Export results to JSON for further analysis

**Active Signals Table:**

- Lists all detected signals sorted by strength
- Shows frequency, signal strength percentage, signal type, and detection time
- **Signal Type Classification**: Automatically identifies modulation type with confidence score
  - **WFM** (Wideband FM): 150-250 kHz bandwidth - Commercial FM radio broadcasts
  - **NFM** (Narrowband FM): 12-30 kHz bandwidth - Two-way radio, amateur repeaters
  - **AM**: 4-12 kHz bandwidth - AM radio, aviation, amateur bands
  - **Digital**: 1-5 kHz with sharp edges - Digital voice modes, data transmissions
  - **Unknown**: Signals that don't match known modulation patterns
- Color-coded strength bars: Red (weak), Orange (moderate), Green (strong)
- "Export" button saves results as JSON file with classification data
- "Clear" button removes all detected signals from the list

**Note**: Device must be connected and scanning only works for FM/AM modes (not P25).

### Understanding the Visualizations

#### IQ Constellation Diagram

- Shows I (in-phase) and Q (quadrature) signal components
- Density-based coloring: blue (sparse) → cyan → white (dense)
- Circular pattern = FM signal
- Varying magnitude = AM modulation
- Distinct points = Digital modulation

#### Amplitude Waveform

- Time-domain signal envelope
- Red line = Maximum amplitude
- Orange line = Average amplitude
- Green line = Minimum amplitude
- Useful for: AM detection, signal strength monitoring

#### Spectrogram (Power Spectral Density)

- Frequency spectrum over time
- Color scale: Purple (low power) → Yellow (high power)
- Horizontal axis = Time
- Vertical axis = Frequency
- Bright bands = Strong signals

#### Waterfall Display

- Real-time scrolling frequency spectrum visualization
- New FFT frames appear at the top and scroll down
- Perfect for identifying transient signals and monitoring activity
- Toggle between static spectrogram and waterfall modes with one click
- Configurable buffer size (default: 100 frames)
- GPU-accelerated WebGL rendering for smooth performance

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

Interactive controls are implemented via `src/hooks/useVisualizationInteraction.ts` and used across visualization components such as `Spectrogram`, `IQConstellation`, and `WaveformVisualizer`.

### Advanced Analysis Tools

The Spectrum Explorer includes professional-grade measurement and analysis capabilities:

**Interactive Markers** 📍

- **Single Click** on spectrum to place a marker at the nearest peak
- Markers automatically display:
  - Exact frequency (MHz with 6 decimal places)
  - Power level (dB)
  - Delta frequency between consecutive markers
  - Delta power between consecutive markers (color-coded: blue for gain, red for loss)
- **Remove Individual Markers**: Click "Remove" button in the marker table
- **Clear All Markers**: Click "Clear Markers" button
- **Export to CSV**: Save all marker measurements for analysis in spreadsheet software

**Peak Hold Mode** 📈

- Enable with the "Peak Hold" checkbox
- Captures and displays the maximum power detected at each frequency bin over time
- Essential for:
  - Identifying intermittent signals
  - Measuring peak power of burst transmissions
  - Finding hidden signals in noisy environments
- **Clear Peak Hold**: Reset accumulated peak data with the "Clear Peak Hold" button
- **Keyboard Shortcut**: Press `P` to toggle peak hold

**Measurement Workflow Example:**

1. Enable Peak Hold to capture signal peaks
2. Click on signals of interest to place markers
3. Review frequency spacing and power differences in the marker table
4. Export measurements to CSV for documentation or further analysis

These tools are particularly useful for:

- Bandwidth measurement (mark signal edges and read delta frequency)
- Channel spacing verification
- Relative signal strength comparison
- Interference analysis
- Spectrum occupancy studies

### Speech Recognition

#### Basic Transcription

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

#### Monitoring P25 Systems

1. Select "P25" signal type
2. Configure system parameters:
   - Control Channel frequency (e.g., 770.95625 MHz)
   - NAC (Network Access Code)
   - System ID
   - WACN (Wide Area Communications Network)
3. Add talkgroups to monitor
4. Start reception to decode transmissions

#### Understanding P25 Indicators

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

See implementation in `src/utils/p25decoder.ts` for technical details and API surface.

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

### WASM runtime and validation toggles

You can enable/disable the WebAssembly DSP path and its output validation at runtime via localStorage flags (no rebuild required). This is useful for debugging and CI stability.

- `radio.wasm.enabled`: set to `false` to force JavaScript fallbacks; any other value (or unset) enables WASM
- `radio.wasm.validate`: set to `true` to enable O(N) output validation (dev default: on; prod default: off)

See docs/reference/wasm-runtime-flags.md for details on behavior, validation heuristics, and dev cache-busting.

## Browser Compatibility

### Supported Browsers

- ✅ Google Chrome 61+
- ✅ Microsoft Edge 79+
- ✅ Opera 48+

### Not Supported

- ❌ Firefox (WebUSB not implemented)
- ❌ Safari (WebUSB not implemented)

**Note**: HTTPS context is required for WebUSB access.

## Windows notes

- PowerShell is the default shell; commands shown use npm scripts so they work the same across platforms.
- The `clean` script uses `rimraf` for cross‑platform deletion of `dist`, `node_modules`, and `build`.

## Agent guide: Serena memories

For AI agents contributing to this repository, use Serena memories to keep context lean and high-signal:

- Start by listing available memories and look for "memory_usage".
- Read that memory for concise best practices on minimizing noise-to-signal in context, retrieval order, and when/what to write.
- Only write new memories for durable, reusable knowledge (architecture decisions, debugging playbooks, repo-wide workflows). Prefer updating an existing memory over creating duplicates.
- Favor symbol-first exploration over full-file reads. Avoid re-reading the same content with multiple tools.

See `.github/copilot-instructions.md` for detailed agent workflows and available tools.

## Deployment

rad.io is automatically deployed to GitHub Pages on every push to `main`. The deployment process includes:

- Automated build and validation
- CDN distribution via GitHub Pages
- Post-deployment health checks
- Artifact management and cleanup

**For detailed deployment documentation**, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), which covers:

- Automated and manual deployment procedures
- Build artifact management
- Post-deployment validation
- Rollback procedures
- Troubleshooting guides

## Community

### Join the Community

We welcome contributors of all experience levels!

- 💬 **[GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)** - Ask questions, share ideas, and connect with other users
- 🐛 **[Report Issues](https://github.com/alexthemitchell/rad.io/issues)** - Found a bug? Let us know!
- ✨ **[Request Features](https://github.com/alexthemitchell/rad.io/issues/new?template=feature_request.md)** - Suggest new functionality
- 🤝 **[Contribute](./CONTRIBUTING.md)** - Help improve rad.io

### Getting Started

**New Contributors:**

1. Read the [Community Guidelines](./COMMUNITY.md) - Learn how we work together
2. Follow the [First-Time Contributor Checklist](./.github/FIRST_TIME_CONTRIBUTOR_CHECKLIST.md) - Step-by-step guide
3. Check the [Onboarding Guide](./docs/ONBOARDING.md) - Technical setup and walkthrough
4. Find a [`good first issue`](https://github.com/alexthemitchell/rad.io/labels/good%20first%20issue) - Start contributing!

**Contributors are recognized in [CONTRIBUTORS.md](./CONTRIBUTORS.md)**

### Community Resources

- **[Community Guidelines](./COMMUNITY.md)** - How we work together and communicate
- **[Contributing Guide](./CONTRIBUTING.md)** - Detailed contribution guidelines
- **[Code of Conduct](./CODE_OF_CONDUCT.md)** - Our community standards
- **[Support](./SUPPORT.md)** - Getting help and support resources
- **[Governance](./GOVERNANCE.md)** - How decisions are made
- **[Security Policy](./SECURITY.md)** - Reporting security vulnerabilities

**Issue & PR Templates:**

- [Bug Report](./.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature Request](./.github/ISSUE_TEMPLATE/feature_request.md)
- [Documentation](./.github/ISSUE_TEMPLATE/documentation.md)
- [Question](./.github/ISSUE_TEMPLATE/question.md)
- [Pull Request Template](./.github/pull_request_template.md)

### Community Meetings

We're planning monthly community calls!
Stay tuned for announcements in [Discussions](https://github.com/alexthemitchell/rad.io/discussions).

## Additional accessibility resources

- GitHub’s guidance for accessible profile/README content: https://github.blog/developer-skills/github/5-tips-for-making-your-github-profile-page-accessible/
  - Key ideas we follow here: descriptive image alt text, meaningful link text (no “click here”), clear heading hierarchy, and emojis that complement the text (not replace it).
