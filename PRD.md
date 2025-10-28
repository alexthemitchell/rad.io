# Product Requirements Document: WebSDR Pro

A professional-grade, browser-based Software Defined Radio platform delivering hardware-accelerated DSP, research-grade visualizations, and comprehensive signal intelligence capabilities for radio enthusiasts, researchers, and professionals.

## Mission Statement

Transform any modern web browser into a professional signal analysis workstation capable of real-time wideband monitoring, multi-signal demodulation, and advanced measurement—bridging the gap between accessible web technology and laboratory-grade radio instrumentation.

## Experience Qualities

1. **Precise** - Sub-Hz frequency resolution with calibrated measurements, stable numerical displays, and deterministic behavior that builds trust through consistency and accuracy
2. **Powerful** - Hardware-accelerated parallel processing delivering real-time analysis of wideband signals while simultaneously demodulating multiple channels without performance degradation
3. **Professional** - Information-dense layouts with expert-focused controls, research-grade measurement tools, and comprehensive debugging capabilities that respect user expertise

## Complexity Level

**Complex Application** (advanced functionality, multi-device coordination)

This represents a sophisticated real-time signal processing system requiring:

- WebGPU-accelerated DSP pipeline with compute shaders for FFT/filtering
- Multi-threaded architecture using Web Workers for parallel demodulation chains
- SharedArrayBuffer-based zero-copy data paths for minimal latency
- Complex state synchronization across frequency, mode, filter, and device parameters
- Multiple simultaneous visualization renderers (spectrum, waterfall, constellation, eye diagram)
- Multi-channel audio routing with independent demodulators per VFO
- WebUSB device management with automatic enumeration and recovery
- Comprehensive persistence layer for configurations, recordings, and telemetry

## Essential Features

### 1. Multi-Device SDR Management

**Functionality**: Discover, connect, and coordinate multiple RTL-SDR and HackRF devices via WebUSB with independent or synchronized operation modes
**Purpose**: Enable wideband monitoring by frequency-stitching multiple receivers or comparing signals across different hardware
**Trigger**: User opens device manager and selects available USB SDR devices
**Progression**: Device enumeration → Capability detection → Firmware version check → Device claiming → Sample rate/gain configuration → Synchronized start → Health monitoring
**Success Criteria**: Supports 4+ simultaneous devices, <5ms synchronization skew between devices, automatic reconnection on USB suspend/resume, per-device configuration persistence

### 2. Adaptive Spectrum Analyzer

**Functionality**: GPU-accelerated power spectral density with configurable FFT sizes (256-262144), window functions (Hamming, Blackman-Harris, Kaiser), averaging modes (exponential, linear, peak-hold), and zoom levels
**Purpose**: Primary tool for signal discovery, spectral occupancy analysis, interference identification, and precise frequency measurement
**Trigger**: Automatic upon device connection
**Progression**: IQ stream → Decimation chain → Window application → GPU FFT (compute shader) → Magnitude/phase extraction → Averaging/smoothing → Logarithmic conversion → Anti-aliased rendering
**Success Criteria**: 60 FPS at 8192 bins, zoom to 10 Hz spans without artifacts, ±0.3dB amplitude accuracy, resolution bandwidth indicators, calibrated frequency markers with ppm-accurate readouts

### 3. Multi-Layer Waterfall Display

**Functionality**: GPU-accelerated time-frequency heatmap with selectable palettes (Viridis, Plasma, Inferno, Turbo, Classic RF), independent zoom axes, time markers, and overlay annotations
**Purpose**: Reveal temporal signal patterns, identify bursty transmissions, measure duty cycles, and document spectral activity over extended periods
**Trigger**: Enabled alongside spectrum (default) or as fullscreen view
**Progression**: Spectrum bins → Colormap shader → Texture buffer → GPU scroll with age gradient → Annotation overlay → Export as timestamped PNG
**Success Criteria**: Smooth 60 FPS with 4096 bins, configurable history (1 min to 24 hours with compression), accurate UTC timestamps, click-to-tune from historical data, bandwidth cursors showing occupied spectrum

### 4. Multi-Channel Demodulator

**Functionality**: Independent VFO receivers supporting AM (envelope, synchronous), FM (narrow/wide with de-emphasis), SSB (USB/LSB/CW with AGC modes), and digital modes (RTTY, PSK31, MFSK, SSTV) with automatic frequency/phase tracking
**Purpose**: Simultaneously monitor multiple signals within receiver bandwidth while maintaining independent audio outputs and decoding streams
**Trigger**: User places VFO marker on spectrum or recalls bookmark
**Progression**: VFO placement → IF filter generation (GPU FIR) → Channelizer (polyphase filterbank) → Mode-specific demodulation (Web Worker) → Audio resampling → AGC/squelch → Audio routing → Optional decoding pipeline
**Success Criteria**: 8+ simultaneous VFOs within bandwidth, <150ms click-to-audio latency, independent filter shapes (brick-wall, Gaussian, raised-cosine), per-VFO recording, automatic notch filtering

### 5. Advanced Measurement Suite

**Functionality**: Frequency markers with delta measurements, channel power integration (CCDF), occupied bandwidth (99%), adjacent channel power ratio (ACPR), signal-to-noise ratio (SNR/SINAD), modulation quality (EVM), and spectral mask compliance
**Purpose**: Provide quantitative analysis for professional applications including transmitter testing, spectrum management, and regulatory compliance
**Trigger**: User enables measurement tools and places markers/regions
**Progression**: Tool selection → Marker/region placement → Statistics computation (FFT-based or time-domain) → Multi-frame averaging → Result display with confidence intervals → Logging to table → Export as CSV/JSON
**Success Criteria**: ±1 Hz frequency accuracy (with calibration), 0.2dB power accuracy, automated peak/valley finding, comparison measurements between two signals, statistical distributions for time-varying signals

### 6. Intelligent Recording System

**Functionality**: Record raw IQ samples or demodulated audio with intelligent triggers (signal detection, schedule, manual), metadata tagging, and format conversion (WAV, FLAC for audio; SigMF-compliant for IQ)
**Purpose**: Enable forensic analysis, signal library building, compliance documentation, and offline processing workflows
**Trigger**: Manual start, threshold-based auto-trigger, scheduled recordings, or external API
**Progression**: Trigger evaluation → Pre-trigger buffer capture → Stream multiplexing (IQ + metadata) → Compression (if enabled) → Chunked IndexedDB write → SigMF manifest generation → Export preparation
**Success Criteria**: Handles 20GB+ recordings with quota management, SigMF compliance for interchange, pre-trigger buffer (5-30s), simultaneous IQ and audio recording, automatic segmentation for long captures, geolocation tagging

### 7. Frequency Database & Bookmarks

**Functionality**: Hierarchical bookmark system with import/export (CSV, RadioReference format), tag-based organization, signal type classification, and visual spectrum overlays
**Purpose**: Rapid access to known frequencies, band planning aids, and collaborative signal databases
**Trigger**: Bookmark creation from tuned frequency or bulk import
**Progression**: Create/import → Parameter capture (freq, mode, bandwidth, squelch) → Tagging/categorization → KV persistence → Sidebar display with search/filter → Visual markers on spectrum → Click/keyboard recall
**Success Criteria**: 10,000+ bookmark capacity, full-text search <100ms, hierarchical folders (Amateur/Broadcast/Aviation/etc.), schedule awareness (active times), community database sync (optional)

### 8. Adaptive Scanner

**Functionality**: Frequency scanning with multiple modes (sequential, memory, band scope), configurable dwell times, auto-store of active signals, and priority channel monitoring
**Purpose**: Automated spectrum surveillance, signal discovery, and activity monitoring across wide frequency ranges
**Trigger**: User configures scan list and starts scanner
**Progression**: Range/list configuration → Scan initiation → Frequency hopping → Signal detection (threshold crossing) → Dwell extension if active → Metadata logging (timestamp, duration, peak power) → Resume or priority interrupt
**Success Criteria**: <50ms hop time between channels, adaptive dwell (longer on active frequencies), parallel scan (background FFT while monitoring), exportable activity logs with waterfall snippets, CTCSS/DCS decoding for squelch

### 9. Interactive Signal Decoder

**Functionality**: Real-time decoding of digital communication modes including RTTY (radioteletype), PSK31/63/125 (phase shift keying), and SSTV (slow-scan television) with mode-specific configuration and output handling
**Purpose**: Decode and display text transmissions and images from digital modes without external software, enabling monitoring of ham radio digital communications, weather FAX, and SSTV contests
**Trigger**: User selects Decoder tab and chooses digital mode (RTTY/PSK31/SSTV)
**Progression**: Mode selection → Configuration (baud rate, shift, AFC) → Decoder activation → Audio/IQ sample processing → Character/image decoding → Real-time display → Copy/save functionality
**Success Criteria**: Accurate RTTY decoding at 45.45 and 50 baud with 170/850 Hz shift, PSK31 varicode decoding with AFC, SSTV image reception for Martin M1/M2, Scottie S1/S2, and Robot 36 modes, <200ms decode latency, text output with copy/save, progressive SSTV image rendering with completion percentage

### 10. Signal Analysis Tools

**Functionality**: Constellation diagram, eye pattern, vector diagram, spectrogram zoom, phase noise measurement, and time-domain oscilloscope view
**Purpose**: Deep-dive analysis for digital modulation characterization, transmitter evaluation, and propagation studies
**Trigger**: User opens analysis panel and selects visualization
**Progression**: Tool selection → Sample buffer capture → Processing (decimation, matched filtering) → Rendering (Canvas 2D or WebGL) → Interactive cursors → Measurement overlay
**Success Criteria**: Real-time updates (30+ FPS), freeze/persistence modes, automatic symbol rate estimation, EVM calculation for QAM/PSK, export as image with annotations

### 11. Calibration & Correction

**Functionality**: Frequency offset calibration (using known beacons), IQ imbalance correction, DC offset removal, gain flatness calibration, and PPM drift tracking
**Purpose**: Ensure measurement accuracy across temperature variations, hardware tolerances, and aging effects
**Trigger**: User initiates calibration wizard or applies corrections from profile
**Progression**: Calibration mode selection → Reference signal tuning (GPS, WWV, GSM) → Measurement collection → Offset calculation → Correction coefficient generation → Profile save → Automatic application on startup
**Success Criteria**: ±0.5 ppm accuracy after calibration, temperature drift compensation, per-device calibration profiles, expiration warnings (recommend re-cal after 30 days)

## Edge Case Handling

- **Sample Loss/Overrun**: Real-time buffer health monitoring with visual indicators, automatic sample rate reduction if persistent, overflow event logging with timestamps for forensic analysis
- **IQ Imbalance/DC Offset**: Continuous background monitoring with automatic correction, user-visible metrics, calibration prompts when thresholds exceeded
- **Browser Storage Quota**: Proactive quota monitoring with warnings at 70%/85%/95%, automatic recording compression, external export prompts, cleanup wizard for old recordings
- **Insufficient GPU Resources**: Capability detection at startup, graceful fallback to CPU-based processing with performance warnings, adaptive quality settings (reduce FFT size, frame rate)
- **USB Device Disconnect**: Immediate detection, automatic reconnection attempts (exponential backoff), state preservation (frequency, mode, filters), user notification with manual override
- **Sample Rate Changes**: Seamless pipeline reconfiguration, visualization axis rescaling, filter coefficient regeneration, minimal audio interruption (<50ms gap)
- **Invalid Tuning Requests**: Hardware-aware frequency constraints (respect LO limits, alias boundaries), visual indicators for out-of-range requests, automatic correction with user notification
- **Concurrent Audio Contexts**: Detect audio context suspension, pause demodulation to conserve CPU, resume on focus with sync verification
- **Large FFT Memory Pressure**: Dynamic memory management based on available GPU RAM, automatic downscaling on allocation failure, user warnings before OOM crashes
- **Timestamp Discontinuities**: Detect sample timestamp gaps, interpolate or mark as invalid, log for troubleshooting, resilient waterfall rendering
- **Unsupported Devices**: Comprehensive device capability detection, clear error messages for unsupported sample rates/tuner ranges, firmware update prompts
- **Thermal Throttling**: Monitor sustained high GPU usage, detect frame drops, offer reduced quality modes, suggest cooling periods

## Design Direction

The interface should embody the precision and authority of professional RF test equipment—think Rohde & Schwarz ESW spectrum analyzer or Flex-6000 SDR console. Dark UI backgrounds maximize contrast for signal visualizations while reducing eye strain during extended analysis sessions. Every control should feel deliberate and precise, with immediate feedback that reinforces the user's expertise. Information density is high but organized through clear visual hierarchy—measurements and readouts use monospaced fonts with tabular figures, while labels employ crisp sans-serifs. Color is purposeful: cyan for active tuning, amber for warnings, green for good signal quality. The overall aesthetic is modern laboratory equipment translated to the web—minimal decoration, maximum function, and an underlying sense that this is serious scientific instrumentation.

## Color Selection

**Custom palette** inspired by professional spectrum analyzers (R&S, Keysight), aviation displays (EFIS), and submarine sonar consoles—domains where clarity, precision, and fatigue-free operation are paramount.

The dark background scheme serves multiple purposes: maximize dynamic range for signal visualization, reduce blue light emission for extended sessions, emphasize accent colors for active elements, and create visual separation between UI chrome and signal content. Colors are chosen in perceptually uniform OKLCH space to ensure consistent contrast ratios across the interface.

- **Primary Color**: Electric Blue `oklch(0.55 0.18 240)` - High visibility for primary actions and active controls, suggests precision and technical authority, stands out against dark backgrounds without overwhelming
- **Secondary Colors**:
  - Gunmetal `oklch(0.32 0.015 240)` for secondary panels and inactive controls
  - Deep Slate `oklch(0.22 0.02 240)` for nested panels and recessed elements
- **Accent Color**: Cyan `oklch(0.78 0.14 195)` - Maximum visibility for tuning cursors, active VFOs, frequency markers, and critical alerts; maintains distinctiveness from primary blue
- **Status Colors**:
  - Success Green `oklch(0.68 0.15 145)` for good signal quality, connected devices, completed operations
  - Warning Amber `oklch(0.75 0.15 75)` for caution states, approaching thresholds, attention-needed items
  - Danger Red `oklch(0.60 0.20 25)` for errors, clipping, disconnections, and critical warnings
- **Foreground/Background Pairings**:
  - Background (Void Black `oklch(0.12 0.01 240)`): Silver text (`oklch(0.90 0.005 240)`) - Ratio 14.2:1 ✓
  - Card (Charcoal `oklch(0.18 0.015 240)`): Silver text (`oklch(0.90 0.005 240)`) - Ratio 11.8:1 ✓
  - Primary (Electric Blue `oklch(0.55 0.18 240)`): White text (`oklch(0.98 0 0)`) - Ratio 6.8:1 ✓
  - Secondary (Gunmetal `oklch(0.32 0.015 240)`): Silver text (`oklch(0.90 0.005 240)`) - Ratio 8.9:1 ✓
  - Accent (Cyan `oklch(0.78 0.14 195)`): Void Black text (`oklch(0.12 0.01 240)`) - Ratio 12.1:1 ✓
  - Muted (Slate `oklch(0.28 0.015 240)`): Dim Gray text (`oklch(0.62 0.01 240)`) - Ratio 5.2:1 ✓
  - Success (Green `oklch(0.68 0.15 145)`): Void Black text (`oklch(0.12 0.01 240)`) - Ratio 8.6:1 ✓
  - Warning (Amber `oklch(0.75 0.15 75)`): Void Black text (`oklch(0.12 0.01 240)`) - Ratio 10.3:1 ✓
  - Destructive (Red `oklch(0.60 0.20 25)`): White text (`oklch(0.98 0 0)`) - Ratio 5.8:1 ✓

## Font Selection

Typography must support both dense numeric displays (requiring monospace for stability) and general UI elements (requiring excellent small-size legibility). The combination should feel technical and precise without being cold or unapproachable.

- **Primary (Numeric)**: JetBrains Mono for frequency displays, measurement readouts, timestamps, and parameter values—true monospace with excellent character distinction (0/O, 1/l/I), tabular figures prevent layout shift during value updates, includes Powerline glyphs for special indicators
- **Interface**: Inter for all labels, buttons, headings, and body text—optimized for screen rendering with wide language support, extensive weight range (from Thin to Black), excellent legibility at small sizes (9px+)
- **Documentation**: System UI stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) for help panels and long-form content to maximize reading comfort

**Typographic Hierarchy**:

- H1 (Panel Titles): Inter SemiBold/20px/tight tracking (-0.015em)/uppercase for major sections
- H2 (Section Headers): Inter Medium/15px/normal tracking/mixed case
- H3 (Parameter Groups): Inter Medium/12px/wide tracking (0.03em)/uppercase/muted color
- Body (Descriptions): Inter Regular/13px/line-height 1.5
- Small (Hints): Inter Regular/11px/line-height 1.4/muted color
- Numeric (Measurements): JetBrains Mono Medium/14px/tabular-nums
- Frequency (Large): JetBrains Mono Bold/18px/tabular-nums/tight tracking
- Code (Logs): JetBrains Mono Regular/12px/line-height 1.6

## Animations

Motion should communicate system state and guide attention without interfering with signal analysis. All animations must be cancelable and should respect `prefers-reduced-motion`. The goal is purposeful, nearly invisible transitions that enhance rather than decorate.

**Contextual Appropriateness**: Real-time signal visualizations run at display refresh rate (60+ Hz) via GPU, UI transitions are minimal and fast (≤200ms), numeric values update instantly without easing (precision requires immediate feedback), errors use brief attention-grabbing motions.

**Purposeful Meaning**:

- Spectrum/waterfall rendering: Continuous GPU-driven updates at 60 FPS (or display native refresh), no artificial smoothing
- VFO tuning: Immediate frequency update with <16ms cursor tracking, no lag or interpolation
- Panel expand/collapse: 180ms ease-out with content fade for spatial continuity
- Modal dialogs: 120ms scale-fade from trigger point
- Value highlights: 400ms background flash on user-triggered changes (gain, squelch, mode)
- Loading indicators: Indeterminate spinner for unknown operations, determinate progress for file I/O
- Error states: 80ms horizontal shake (±2px) + color shift to destructive
- Connection status: 300ms fade between states (connecting → connected → error)

**Hierarchy of Movement**:

1. Signal visualization (highest priority, never dropped, GPU-accelerated)
2. Frequency tuning feedback (user-triggered, <16ms response, never skipped)
3. Audio level meters (high priority, 30 FPS minimum)
4. Panel transitions (medium priority, can be skipped under load)
5. Decorative effects (lowest priority, disabled on low-end hardware)

**Animation Timing**:

- Instant: Numeric value updates, frequency changes, mode switches
- Fast (80-120ms): Error shakes, tooltips, dropdowns
- Medium (150-200ms): Panel animations, modal dialogs
- Slow (300-500ms): Fade transitions for non-critical state changes
- Continuous: Signal visualizations, progress indicators

## Component Selection

**Components** (custom token-driven CSS with RF-specific additions; no external UI library dependency):

- **Slider**: Custom dual-purpose component—linear for volume/squelch (0-100%), logarithmic for gain (-10 to +40 dB), frequency for coarse tuning; visual value tooltip, keyboard nav (arrows for fine, Shift+arrow for coarse), touch-drag support
- **Select**: Mode selection (AM/FM/SSB/etc.), FFT size, window function, color palette—custom select with icons; keyboard shortcuts (M for mode, W for window)
- **Tabs**: Major view switching (Spectrum/Waterfall/Constellation/Tools)—custom tabs with keyboard shortcuts (1-4), persistent state
- **Card**: Container for control panels, device list, bookmarks, recordings—token-styled cards with minimal borders, subtle shadows
- **Dialog**: Settings, calibration wizard, file import/export, about—accessible dialog with backdrop blur, escape to close
- **Sheet**: Side panels for bookmarks, recordings, device manager—resizable sheet behavior
- **Table**: Bookmark list, measurement log, scan results—virtual scrolling (React-window), sortable columns
- **Tooltip**: Parameter explanations, measurement units, control hints—400ms delay, rich content support
- **Badge**: Status indicators (device state, recording active, buffer health, signal quality)—color variants via tokens
- **Separator**: Visual grouping in dense control panels—horizontal and vertical
- **ScrollArea**: Panels with many controls—custom scrollbar styling
- **Switch**: Binary toggles (AGC, Squelch, Grid overlay, Noise blanker)—with labels
- **Button**: Primary actions (Connect, Record, Tune) use filled style, secondary (Reset, Cancel) use outline, icon-only for compact toolbars—icon support
- **Input**: Numeric entry with validation, unit support (Hz/kHz/MHz auto-conversion)—custom formatting
- **RadioGroup**: Exclusive selections (averaging mode, antenna input)—with descriptions
- **DropdownMenu**: Context menus for bookmarks, devices, measurements—keyboard navigable
- **Command**: Quick action palette (Cmd/Ctrl+K)—planned; use Shortcuts overlay as interim help

**Custom Components** (specialized RF/DSP UIs):

- **SpectrumCanvas**: WebGL2/WebGPU renderer with pan/zoom, click-to-tune, marker placement, anti-aliased grid, frequency/power axes
- **WaterfallCanvas**: GPU-accelerated scrolling texture with colormap shaders, time axis, click-to-tune from history
- **VFOControl**: Rotary encoder simulation with click-drag tuning, scroll wheel, digit-by-digit entry, frequency memory, RIT/XIT offsets
- **FrequencyDisplay**: Large 7-segment style readout with digit-by-digit editing, scroll-per-digit tuning, unit auto-scaling
- **ConstellationDiagram**: IQ scatter plot with persistence trails, symbol overlays, EVM calculation, zoom controls
- **EyeDiagram**: Overlapped symbol visualization with trigger controls, sample interpolation, measurement cursors
- **AudioMeter**: VU-style level meter with peak hold, clipping indicator, ballistics modes (fast/slow), stereo or mono
- **SMeteter**: Classic S-unit meter (S1-S9+60dB) with smooth needle animation, hold function, dBm/dBµV calibration
- **FilterShape**: Visual filter bandwidth editor with passband/stopband cursors, shape selection (brick-wall/Gaussian/cosine)
- **DeviceCard**: Rich device info display showing model, serial, firmware, sample rate, temperature, buffer health

**States** (all interactive elements):

- **Buttons**:
  - Default: Subtle border, icon + text, proper padding
  - Hover: Brightness +8%, border color shift, 100ms transition
  - Active: Inset shadow, brightness -5%, scale 0.98
  - Disabled: 40% opacity, no pointer events, no hover effect
  - Loading: Spinner replaces icon, text dims, disabled state
- **Inputs**:
  - Default: Muted border, placeholder text at 60% opacity
  - Focus: Accent border with 2px ring, remove placeholder
  - Error: Destructive border, 80ms shake, error message below
  - Success: Brief (500ms) green border flash
  - Disabled: Background at 50% opacity, no caret
- **Canvas/Visualizations**:
  - Idle: Dim border, reduced update rate (15 FPS)
  - Active: Accent border, full refresh rate (60 FPS)
  - Processing: Subtle pulse on border (1s cycle)
  - Error: Destructive border, error overlay with retry option

**Icon Selection** (Phosphor Icons, primarily Regular weight):

- **Device/Source**: Radio, RadioButton, Usb, HardDrives, CircleWavyCheck
- **Visualizations**: Waveform (spectrum), Rows (waterfall), CircuitCircle (constellation), Eye (eye diagram)
- **Tuning/Control**: Target, Crosshair, MagnifyingGlass, SlidersHorizontal, FadersHorizontal
- **Audio**: Play, Pause, Stop, SpeakerHigh, SpeakerLow, SpeakerX, Microphone
- **Recording**: Record, RecordFill (active), Download, Upload, Export
- **Navigation**: CaretLeft/Right/Up/Down, ArrowsOut (zoom), MagnifyingGlassPlus/Minus
- **Tools**: Ruler, ChartLine, Calculator, Function, MathOperations
- **Status**: Lightning (auto), CheckCircle (good), WarningCircle (caution), XCircle (error), Info
- **Organization**: BookmarkSimple, Folder, FolderOpen, Tag, List, Table
- **Settings**: Gear, Wrench, Sliders, Faders, Aperture (calibration)
- **Actions**: Plus, Minus, X, Check, ArrowClockwise (refresh), Copy, Trash

**Spacing System** (Tailwind scale):

- Canvas margins: 0 (full bleed within container)
- Panel padding: `p-4` (16px) for outer, `p-3` (12px) for nested
- Control groups: `gap-3` (12px) between related controls
- Inline elements: `gap-2` (8px) for labels/inputs
- Section separation: `gap-6` (24px) for major boundaries
- Grid layouts: `gap-4` (16px) for card grids
- Toolbar spacing: `gap-1` (4px) for icon buttons, `gap-2` (8px) for mixed

**Responsive Strategy** (Mobile is secondary but supported):

Primary target is desktop/laptop with sufficient compute for real-time DSP, but interface should adapt gracefully:

- **Desktop (≥1024px)**: Full layout with side-by-side spectrum/controls, visible waterfall, all features enabled
- **Tablet (768-1023px)**: Stacked layout, collapsible panels, waterfall as modal, reduced FFT size (4096 max)
- **Mobile (≤767px)**: Single column, spectrum dominates, controls in bottom sheet, tap-to-tune only, disable GPU-heavy features

Mobile-specific adaptations:

- Stack spectrum above controls in single column
- Waterfall hidden by default, accessible via fullscreen modal
- VFO control simplified to tap-frequency-input (no drag tuning)
- Collapsible panels (accordion style) to maximize visualization space
- Touch-optimized buttons (min 44×44px) for all critical controls
- Reduced FFT sizes (1024-2048) to conserve battery and memory
- Disable simultaneous demodulators (1 VFO max on mobile)
- Feature detection disables WebGPU/compute shaders if unavailable
- Automatic quality reduction on low-end devices (detected via benchmark)
