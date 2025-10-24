# WebSDR Pro Development Roadmap

## Overview

This roadmap outlines the strategic development plan for WebSDR Pro, transitioning from a functional prototype to a complete, production-ready professional signal analysis platform. The roadmap is organized by user personas and capability tiers, ensuring features are prioritized based on real-world use cases and user value.

---

## Target User Personas

Understanding our users is critical to building the right features in the right order.

### 1. Ham Radio Enthusiast ("The Experimenter")
**Profile**: Licensed amateur radio operators exploring digital modes, DXing, and home station operation  
**Technical Level**: Intermediate - comfortable with RF concepts, learning DSP  
**Primary Goals**: Decode digital modes (PSK31, RTTY, SSTV), log contacts, discover propagation, monitor bands  
**Pain Points**: Complex software installation, expensive hardware requirements, steep learning curves  
**Value Proposition**: Browser-based, no installation, affordable RTL-SDR support, visual learning tools

### 2. Radio Monitoring Professional ("The Analyst")
**Profile**: Spectrum management, regulatory compliance, SIGINT, broadcast monitoring  
**Technical Level**: Expert - RF engineering background, regulatory knowledge  
**Primary Goals**: Record evidence, measure compliance, identify interference, generate reports  
**Pain Points**: Expensive spectrum analyzers, non-portable solutions, limited automation, poor documentation  
**Value Proposition**: Calibrated measurements, automated logging, compliance testing, exportable data

### 3. Academic Researcher ("The Scientist")
**Profile**: University researchers, graduate students studying wireless communications, SDR, propagation  
**Technical Level**: Expert - deep signal processing knowledge, programming skills  
**Primary Goals**: Collect datasets, prototype algorithms, teach concepts, publish findings  
**Pain Points**: Licensing costs, platform lock-in, reproducibility issues, limited customization  
**Value Proposition**: Open platform, exportable data formats (SigMF), visual DSP teaching tools, extensibility

### 4. Emergency Communications Volunteer ("The Responder")
**Profile**: ARES/RACES volunteers, disaster response, public service event communications  
**Technical Level**: Basic to Intermediate - operational focus over technical depth  
**Primary Goals**: Monitor emergency frequencies, log activity, coordinate with teams, reliable operation  
**Pain Points**: Equipment failures, poor battery life, complex interfaces during stress  
**Value Proposition**: Reliable offline-first architecture, simple interface, bookmark quick-access, logging

### 5. Broadcast Engineering ("The Professional")
**Profile**: Radio/TV station engineers, tower maintenance, transmitter optimization  
**Technical Level**: Expert - broadcast engineering, FCC regulations, RF measurement  
**Primary Goals**: Verify transmitter performance, measure coverage, troubleshoot interference, compliance  
**Pain Points**: Expensive test equipment, field portability, real-time monitoring, proof documentation  
**Value Proposition**: Calibrated measurements, field-portable, recording with metadata, professional reports

---

## Development Phases

### Phase 1: Foundation - Core Signal Analysis Platform
**Status**: In Progress  
**Timeline**: Iterations 1-10  
**Goal**: Establish robust SDR platform with essential visualization and demodulation capabilities

### Phase 2: Intelligence - Automated Analysis & Discovery
**Status**: Planned  
**Timeline**: Iterations 11-20  
**Goal**: Add automated signal detection, scanning, and intelligent processing features

### Phase 3: Professional - Measurement & Compliance Tools
**Status**: Future  
**Timeline**: Iterations 21-30  
**Goal**: Implement research-grade measurement suite, calibration, and documentation tools

### Phase 4: Collaborative - Multi-User & Integration
**Status**: Vision  
**Timeline**: Iterations 31+  
**Goal**: Enable collaborative monitoring, remote operation, and ecosystem integration

---

## Detailed Feature Roadmap

### ✅ Iteration 1: Interactive Signal Decoder (COMPLETED)
**User Personas**: Ham Radio Enthusiast, Academic Researcher  
**Priority**: HIGH - Core differentiator for digital mode users  
**Status**: ✅ Completed

**Value**: Enables monitoring of digital amateur radio communications without external software. Critical for ham radio operators participating in PSK31 nets, RTTY contests, and SSTV activities.

**Implementation Notes**:
- ✅ RTTY decoder with 45.45 and 50 baud support
- ✅ PSK31/63/125 varicode decoder with AFC
- ✅ SSTV image decoder (Martin, Scottie, Robot modes)
- ✅ Mode-specific configuration panels with presets
- ✅ Real-time text output with copy/save functionality
- ✅ Progressive SSTV image rendering on canvas

---

### ✅ Iteration 2: WebUSB RTL-SDR Device Integration (COMPLETED)
**User Personas**: ALL - Foundation for real signal processing  
**Priority**: CRITICAL - Transforms from demo to functional SDR  
**Status**: ✅ Completed (Iteration 14)

**Value**: Enables actual signal reception from RTL-SDR dongles via WebUSB. Unlocks all use cases from amateur radio to professional monitoring.

**Implementation Notes**:
- ✅ Complete RTL-SDR device driver with full hardware control
- ✅ WebUSB device discovery and connection
- ✅ Frequency tuning (24-1766 MHz)
- ✅ Sample rate control (225 kHz - 3.2 MS/s)
- ✅ Gain control (0-49.6 dB + auto-gain)
- ✅ PPM frequency correction support
- ✅ Bias-T control for active antennas
- ✅ Direct sampling mode for HF reception
- ✅ Test mode for signal generator
- ✅ IQ sample streaming with automatic 8-bit to float32 conversion
- ✅ Device information reading (EEPROM, tuner type, serial number)
- ✅ DeviceManager for high-level device coordination
- ✅ DeviceConnection UI component
- ✅ Graceful fallback to simulation mode
- ✅ Event-based architecture for device state changes

**Technical Details**:
- Location: `/src/lib/devices/rtlsdr.ts`, `/src/lib/devices/device-manager.ts`
- WebUSB types: `/src/types/webusb.d.ts`
- UI Component: `/src/components/DeviceConnection.tsx`
- References: librtlsdr, WebUSB specification

---

### 🔄 Iteration 3: Real-Time Spectrum Analyzer with GPU Acceleration
**User Personas**: ALL - Core visualization feature  
**Priority**: CRITICAL - Primary tool for signal discovery  
**Estimated Effort**: Large (GPU compute pipeline)

**Problem**: Static placeholder spectrum display. Users need real-time power spectral density visualization.

**Value**: Enables signal discovery, interference identification, and frequency activity monitoring. Essential for all personas - from ham operators finding stations to professionals measuring spectrum occupancy.

**Sub-Tasks**:

1. **FFT Computation Pipeline**
   - Implement WebGL2/WebGPU compute shader for FFT (reference ADR-0003)
   - Support FFT sizes: 512, 1024, 2048, 4096, 8192, 16384 bins
   - Window function selection: Hamming, Blackman-Harris, Kaiser, Flat-top
   - GPU texture-based FFT using Cooley-Tukey algorithm
   - Fallback to CPU FFT (WASM) if GPU unavailable
   - Magnitude and phase extraction from complex FFT output

2. **Spectral Processing**
   - Logarithmic power conversion (10 * log10(mag^2))
   - Averaging modes: None, Exponential (adjustable alpha), Linear, Peak-hold
   - Dynamic range adjustment (reference level + span controls)
   - Noise floor estimation and subtraction (optional)
   - Calibration offset application (from ADR-0011 calibration profile)

3. **Real-Time Rendering**
   - WebGL2 anti-aliased line rendering for spectrum trace
   - 60 FPS target with 8192 bins, adaptive quality reduction if needed
   - Gradient background indicating signal strength zones
   - Grid overlay with frequency and power markings
   - Pan and zoom with mouse/touch (frequency axis)
   - Click-to-tune functionality (VFO cursor placement)

4. **Visual Enhancements**
   - Frequency axis with auto-scaling units (Hz, kHz, MHz)
   - Power axis in dBFS, dBm (with calibration), or linear scale
   - Resolution bandwidth (RBW) indicator
   - Peak markers with frequency/power readout
   - Configurable color schemes (Classic, Night Vision, Thermal)
   - Trace thickness and transparency controls

5. **Performance Optimization**
   - GPU memory management (avoid allocation churn)
   - Efficient texture updates (subimage, not full replacement)
   - RequestAnimationFrame loop with frame pacing
   - Reduced refresh rate when browser tab backgrounded
   - Profiling instrumentation for performance monitoring

**Success Criteria**:
- Sustained 60 FPS with 8192 FFT bins at 2.4 MS/s sample rate
- <16ms frame time (one frame budget at 60 Hz)
- <100ms FFT size change latency
- Frequency axis accuracy to 1 Hz at all zoom levels
- Power measurement accuracy ±0.5 dB (after calibration)
- Smooth pan/zoom interactions with no stuttering
- Graceful degradation on integrated GPUs (reduce quality, maintain FPS)

**Technical Considerations**:
- Reference ADR-0015 (Visualization Rendering Strategy)
- Use WebGPU compute shaders for FFT on supported browsers
- Fallback to WebGL2 fragment shader FFT for compatibility
- Consider FFT worker pool (ADR-0012) for parallel processing
- Implement adaptive quality (reduce FFT size if GPU overloaded)

**Testing Requirements**:
- Verify FFT accuracy against known test signals (single tone, multi-tone)
- Measure frame rate across device classes (high-end desktop, laptop, tablet)
- Test zoom performance (1 GHz span to 10 Hz span transitions)
- Validate frequency axis accuracy with signal generator
- Test with multiple simultaneous demodulators running

---

### 🔄 Iteration 4: GPU-Accelerated Waterfall Display
**User Personas**: Ham Radio Enthusiast, Radio Monitoring Professional, Academic Researcher  
**Priority**: HIGH - Critical for temporal signal analysis  
**Estimated Effort**: Medium (Builds on spectrum analyzer)

**Problem**: Waterfall tab shows placeholder. Users need time-frequency visualization.

**Value**: Reveals temporal signal patterns invisible in static spectrum. Essential for identifying bursty signals (packet radio), measuring duty cycles, documenting activity over time, and spotting propagation changes.

**Sub-Tasks**:

1. **GPU Texture-Based Scrolling**
   - Implement scrolling texture buffer (2D array, Y-axis is time)
   - New spectrum lines pushed from top, texture scrolls down
   - Use GPU fragment shader for efficient texture manipulation
   - Configurable history depth: 1 min, 5 min, 30 min, 1 hr, 24 hr
   - Automatic compression for long history (reduce vertical resolution)

2. **Colormap Shader Implementation**
   - Viridis, Plasma, Inferno, Turbo palettes (reference ADR-0016)
   - Classic RF colormap (blue-green-yellow-red)
   - User-definable custom gradient (3-5 control points)
   - Per-pixel colormap lookup in fragment shader
   - Intensity range adjustment (gain/offset controls)

3. **Waterfall Interactivity**
   - Click-to-tune from any point in history (interpolate frequency)
   - Hover to show exact frequency/time/power tooltip
   - Vertical zoom (time axis compression/expansion)
   - Horizontal zoom (frequency axis, synced with spectrum)
   - Time marker placement for event annotation
   - Bandwidth cursors to measure occupied spectrum

4. **Time Axis and Annotations**
   - UTC timestamp labels on Y-axis at regular intervals
   - Relative time mode ("30s ago", "2m ago") for recent events
   - Overlay annotations for bookmarks and detected signals
   - Signal activity highlighting (auto-threshold crossing)
   - Export waterfall segment as timestamped PNG with metadata

5. **Performance Optimization**
   - Ring buffer texture to avoid full-texture copies
   - Efficient GL texture upload (subimage updates only)
   - Maintain 60 FPS with 4096 bins width
   - Adaptive update rate if GPU constrained (30 FPS acceptable)
   - Configurable line rate (10, 20, 30, 60 lines/sec)

**Success Criteria**:
- Smooth 60 FPS scrolling with 4096 frequency bins
- Time axis accurate to 1 second over 24-hour captures
- Click-to-tune accurate to within 1% of bin width
- Colormap changes apply in <50ms
- History buffer handles 1-hour capture without memory pressure
- Export PNG includes accurate timestamps and frequency scale

**Technical Considerations**:
- Reference ADR-0016 (Viridis Colormap) for palette implementation
- Use WebGL2 pixel buffer objects (PBO) for async texture upload
- Consider texture compression (GPU native formats) for long captures
- Store waterfall data in IndexedDB for persistent history
- Implement lazy loading for 24-hour captures (load visible region)

**Testing Requirements**:
- Verify timestamp accuracy over multi-hour captures
- Test memory usage with maximum history depth
- Validate colormap perceptual uniformity (grayscale ramp test)
- Measure FPS impact vs. spectrum alone
- Test export functionality (PNG size, metadata inclusion)

---

### 🔄 Iteration 5: Multi-Channel Audio Demodulator (AM/FM/SSB)
**User Personas**: Ham Radio Enthusiast, Emergency Communications Volunteer  
**Priority**: HIGH - Core functionality for voice communications  
**Estimated Effort**: Large (DSP heavy, multiple algorithms)

**Problem**: Mode buttons exist but don't demodulate audio. Users can't listen to signals.

**Value**: Enables listening to AM broadcast, FM two-way radio, and SSB ham radio. Transforms from a visual tool to a complete receiver. Critical for emergency communications monitoring and casual listening.

**Sub-Tasks**:

1. **IF Filter Generation**
   - Design and implement FIR bandpass filter for channel selection
   - Configurable bandwidth: 2 kHz (SSB), 6 kHz (AM), 15 kHz (FM), custom
   - Filter shapes: Brick-wall (rectangular), Gaussian, Raised-cosine
   - GPU-accelerated filtering using compute shader (reference ADR-0008)
   - Filter visualization (frequency response plot)

2. **AM Demodulator**
   - Envelope detection (sqrt(I^2 + Q^2))
   - Synchronous AM detection (carrier tracking PLL) for better quality
   - DC blocking and de-emphasis
   - AGC (automatic gain control) with fast attack, slow decay
   - Selectable AGC modes: Fast, Medium, Slow, Off
   - Noise blanker for impulse interference rejection

3. **FM Demodulator**
   - Frequency discrimination (atan2 phase detector)
   - Deviation ±5 kHz (NFM) and ±75 kHz (WFM)
   - De-emphasis filter (75 µs US standard, 50 µs Europe)
   - Optional stereo decoder for WFM (pilot tone detection)
   - Squelch with carrier-based and noise-based detection
   - CTCSS/DCS tone decoder for selective squelch

4. **SSB Demodulator (USB/LSB/CW)**
   - Complex mixer for sideband selection (shift spectrum)
   - USB: retain upper sideband, reject lower
   - LSB: retain lower sideband, reject upper
   - CW mode: narrowband filter + beat frequency oscillator (BFO)
   - AGC optimized for SSB (hang time, threshold)
   - Optional AGC hang for CW ragchew mode
   - Audio peak limiter to prevent clipping

5. **Web Audio Integration**
   - Connect demodulated audio to Web Audio API (reference ADR-0008)
   - Implement audio resampling (DSP output to 48 kHz audio)
   - Audio level meter (VU-style with peak hold)
   - Volume control (pre-limiter)
   - Mute and record functionality
   - Low-latency mode (<150ms glass-to-glass)

6. **User Controls**
   - Mode selector with keyboard shortcuts (M for mode cycle)
   - Bandwidth adjustment with common presets
   - AGC speed control
   - Squelch threshold slider with visual indicator
   - Audio filters: Notch, High-pass, Low-pass
   - Noise reduction toggle (spectral subtraction)

**Success Criteria**:
- Audio latency <200ms from RF to speaker (target 150ms)
- Intelligible voice on weak signals (10 dB SINAD minimum)
- Clean audio with no artifacts at normal signal levels
- AGC prevents overload on strong signals
- Squelch opens/closes smoothly without pops
- Mode switching <50ms with no audio gaps
- Simultaneous demodulation of 2+ channels without CPU overload

**Technical Considerations**:
- Reference ADR-0008 (Web Audio API Architecture)
- Run demodulation in Web Worker to avoid main thread blocking
- Use ScriptProcessorNode or AudioWorklet (prefer latter if available)
- Implement fractional resampling for non-standard sample rates
- Consider fixed-point arithmetic for mobile CPU efficiency

**Testing Requirements**:
- Test with known signal sources (signal generator + modulation)
- Measure audio distortion (THD) on test tones
- Validate demodulation accuracy (modulation analyzer comparison)
- Test weak signal performance (add calibrated noise)
- Verify CTCSS tone decoding accuracy
- Measure CPU usage per demodulator instance

---

### ✅ Iteration 6: VFO Control and Frequency Management (COMPLETED)
**User Personas**: Ham Radio Enthusiast, Radio Monitoring Professional  
**Priority**: HIGH - Essential for tuning operations  
**Status**: ✅ Completed

**Value**: Enables precise frequency control like traditional transceivers. Improves efficiency for band scanning and station finding.

**Implementation Notes**:
- ✅ Large frequency display with click-to-edit
- ✅ Keyboard arrow key tuning with step control
- ✅ Selectable tuning steps (1 Hz to 1 MHz)
- ✅ State persistence via spark.kv
- ✅ Click-to-tune from spectrum view
- ✅ PageUp/PageDown for step size changes
- ⚠️ Multiple VFO support deferred to future iteration
- ⚠️ Tuning history (undo/redo) deferred to future iteration

---

### ✅ Iteration 7: Bookmark System and Frequency Database (COMPLETED)
**User Personas**: Ham Radio Enthusiast, Emergency Communications Volunteer, Radio Monitoring Professional  
**Priority**: MEDIUM - Significant quality of life improvement  
**Estimated Effort**: Medium (CRUD operations, import/export)

**Problem**: Users must manually tune each frequency repeatedly. No way to save interesting signals.

**Value**: Dramatically improves workflow efficiency. Emergency volunteers can instantly access frequencies. Ham operators can store net frequencies. Professionals can organize monitoring assignments.

**Status**: ✅ Completed

**Implementation Notes**:
- ✅ Comprehensive bookmark data model with all metadata fields
- ✅ Side panel with search and filter functionality
- ✅ Create/edit bookmark dialog with full parameter support
- ✅ Full-text search across labels, descriptions, and tags
- ✅ Category and tag organization
- ✅ Tune to bookmark with one click
- ✅ Usage tracking (last used, usage count)
- ✅ Persistence via spark.kv
- ⚠️ CSV import/export deferred to future iteration
- ⚠️ Visual markers on spectrum/waterfall deferred
- ⚠️ Drag-and-drop reordering deferred

---

### ✅ Iteration 8: Recording System (IQ and Audio) (COMPLETED)
**User Personas**: Radio Monitoring Professional, Academic Researcher, Ham Radio Enthusiast  
**Priority**: MEDIUM - Critical for documentation and analysis  
**Status**: ✅ Completed (Iteration 14)

**Value**: Enables forensic analysis, signal library building, compliance documentation, and sharing interesting captures. Researchers can build datasets. Professionals can document interference.

**Implementation Notes**:
- ✅ RecordingManager with IndexedDB storage
- ✅ IQ sample recording (raw complex samples)
- ✅ Audio recording support (WAV export)
- ✅ Metadata management (frequency, mode, timestamp, tags)
- ✅ Real-time recording progress tracking
- ✅ Storage quota monitoring with warnings
- ✅ Recording library with list view
- ✅ Export to WAV and raw formats
- ✅ One-click recording export and deletion
- ✅ RecordingPanel UI component
- ⚠️ Threshold-based recording triggers deferred
- ⚠️ Scheduled recording deferred
- ⚠️ Pre-trigger buffer deferred
- ⚠️ Recording playback UI deferred
- ⚠️ SigMF archive export deferred

**Technical Details**:
- Location: `/src/lib/recording/recording-manager.ts`
- UI Component: `/src/components/RecordingPanel.tsx`
- Storage: IndexedDB with chunked writes
- Export: WAV format with proper headers, raw float32 for IQ

---

### 🔄 Iteration 9: Band Scanner with Activity Logging
**User Personas**: Radio Monitoring Professional, Emergency Communications Volunteer, Ham Radio Enthusiast  
**Priority**: MEDIUM - Automation feature for monitoring workflows  
**Estimated Effort**: Medium (State machine, signal detection)

**Problem**: Manual tuning across bands is tedious. Users miss active signals.

**Value**: Automates frequency surveillance. Emergency volunteers can monitor multiple nets. Professionals can survey spectrum occupancy. Ham operators can find active DX stations.

**Sub-Tasks**:

1. **Scan Configuration**
   - **Range Scan**: Start frequency, stop frequency, step size
   - **Memory Scan**: Scan through bookmark list (selected bookmarks)
   - **Band Scan**: Pre-configured amateur bands (2m, 70cm, HF bands)
   - Step size: 5 kHz, 10 kHz, 12.5 kHz, 25 kHz, custom
   - Mode per frequency (from bookmarks) or global mode
   - Scan direction: Forward, reverse, random

2. **Signal Detection**
   - Threshold-based detection (signal power > squelch)
   - Carrier detection (AM/FM carrier present)
   - Modulation detection (signal contains modulation)
   - Noise-based squelch (distinguish signal from noise floor)
   - Configurable detection persistence (require N consecutive detections)

3. **Dwell and Resume Logic**
   - Dwell time: Time to listen on active frequency (2s, 5s, 10s, until signal drops)
   - Hold time: Time to continue after signal drops (2s "hang time")
   - Delay time: Pause between frequencies (minimize hardware tuning spam)
   - Priority channels: Interrupt scan to check priority, then resume
   - Manual tune override: Pause scan, tune manually, resume from that frequency

4. **Activity Logging**
   - Log table: Timestamp, frequency, mode, peak power, duration
   - Signal strength recording (min/max/avg)
   - Waterfall snippet capture (thumbnail)
   - Audio snippet recording (first 5s of signal)
   - Export log to CSV or JSON
   - Real-time activity graph (frequency vs. time)

5. **User Interface**
   - Scan control panel: Start, stop, pause, speed
   - Real-time frequency display during scan
   - Activity log table (scrollable, sortable)
   - Visual scan progress indicator
   - Scan speed control (fast hop vs. thorough check)
   - Bookmark from scan (save active frequency instantly)

6. **Scan Strategies**
   - **Sequential**: Scan in order (predictable)
   - **Priority**: Scan priority channels more frequently
   - **Adaptive**: Spend more time on active frequencies
   - **Random**: Non-predictable order (for SIGINT)
   - **Parallel**: Background FFT-based scan while monitoring one channel

7. **Performance Optimization**
   - Minimize hardware tuning latency (batch requests if possible)
   - Use spectrum FFT for wideband "preview" (scan 2 MHz at once)
   - Adaptive hopping (skip quiet frequencies faster)
   - Background scanning (scan in Web Worker, alert on detection)

**Success Criteria**:
- Scan speed: >10 channels/second (fast mode)
- Detection reliability: >95% on signals above squelch
- False positive rate: <5% (don't trigger on noise)
- Activity log captures all signals correctly
- Scan resume works reliably after manual tune
- Priority channels checked at least every 5 seconds

**Technical Considerations**:
- Reference ADR-0013 (Automatic Signal Detection System)
- Use state machine for scan logic (idle, scanning, dwelling, paused)
- Implement exponentially weighted moving average (EWMA) for signal detection
- Consider parallel scanning using wide FFT (analyze entire 2 MHz span)
- Store scan state for resume after browser restart

**Testing Requirements**:
- Validate detection accuracy with known test signals
- Measure scan speed (channels/sec) on reference hardware
- Test priority channel interruption timing
- Verify activity log accuracy (timestamp, power)
- Test long-duration scans (multi-hour stability)

---

### 🔄 Iteration 10: Settings Panel and Calibration
**User Personas**: Radio Monitoring Professional, Academic Researcher  
**Priority**: MEDIUM - Required for measurement accuracy  
**Estimated Effort**: Medium (UI + validation + persistence)

**Problem**: No way to calibrate frequency accuracy or adjust system parameters.

**Value**: Enables professional-grade measurements. Frequency accuracy critical for narrow digital modes. Gain calibration needed for power measurements. Settings panel improves discoverability.

**Sub-Tasks**:

1. **Settings Dialog Structure**
   - Tabbed interface: Device, Display, Audio, Calibration, Advanced
   - Search/filter for settings
   - Reset to defaults per section
   - Import/export settings as JSON
   - Profile management (save multiple configurations)

2. **Device Settings**
   - Default sample rate
   - Auto-gain vs. manual gain preference
   - Bias-T enable/disable default
   - USB buffer size tuning (advanced)
   - Reconnection behavior (auto vs. manual)

3. **Display Settings**
   - Color scheme selection (Dark, Light, Custom)
   - Spectrum colormap (Classic, Viridis, Turbo, etc.)
   - Waterfall palette and intensity
   - Grid overlay style and density
   - Font size scaling
   - FPS limiter (60, 30, 15 FPS for battery saving)

4. **Audio Settings**
   - Output device selection
   - Audio latency mode (low latency vs. stability)
   - Master volume
   - AGC settings defaults
   - Audio filters defaults
   - Noise reduction strength

5. **Frequency Calibration**
   - PPM correction input (-150 to +150 typical)
   - Calibration wizard: Tune to WWV 10 MHz, measure error
   - Automatic calculation of PPM offset
   - Store per-device calibration
   - Temperature drift compensation (manual)
   - Calibration date and expiration reminder

6. **Power Calibration**
   - Gain offset correction (dB)
   - Calibrate against known signal source
   - Store calibration curve (frequency-dependent)
   - Display calibrated power (dBm) vs. relative (dBFS)
   - Calibration profile versioning

7. **IQ Calibration**
   - IQ balance correction enable/disable
   - DC offset removal strength
   - Automatic vs. manual correction
   - Visual feedback (constellation diagram symmetry)

8. **Keyboard Shortcuts**
   - Configurable hotkeys
   - Presets: Default, Vim-style, Custom
   - Conflict detection (warn if duplicate mappings)
   - Cheat sheet display (press ? to show)

9. **Data Management**
   - Storage usage display (quota consumed)
   - Clear cache/recordings
   - Export all data (bookmarks, recordings, settings)
   - Factory reset (clear all persistent data)

**Status**: ✅ Partially Completed

**Implementation Notes**:
- ✅ Settings dialog with tabbed interface (Display, Radio, Advanced)
- ✅ Display settings: Color scheme, waterfall speed, grid overlay
- ✅ Radio settings: FFT size, AGC, Noise blanker
- ✅ Advanced settings: Storage management placeholder, About info
- ✅ All settings persist via spark.kv
- ⚠️ Calibration wizard deferred to future iteration
- ⚠️ PPM correction UI deferred
- ⚠️ Keyboard shortcut configuration deferred
- ⚠️ Storage quota details view deferred

---

### ✅ Parallel FFT Worker Pool Implementation (COMPLETED)
**Priority**: CRITICAL - Foundation for real-time processing  
**Status**: ✅ Completed (Iteration 14)

**Implementation Notes**:
- ✅ FFTProcessor Web Worker with Cooley-Tukey FFT algorithm
- ✅ Multiple window functions (Hamming, Blackman-Harris, Hann, Flat-top, Rectangular)
- ✅ Configurable FFT sizes (512-16384 bins)
- ✅ Exponential averaging for spectrum smoothing
- ✅ FFT shift for centered display
- ✅ Magnitude to dBFS conversion
- ✅ FFTManager for worker pool coordination
- ✅ Load balancing across 2+ workers
- ✅ Non-blocking operation with Promise API
- ✅ Zero-copy transfer using Transferable objects

**Technical Details**:
- Location: `/src/workers/fft-worker.ts`, `/src/lib/fft/fft-manager.ts`
- Algorithm: Cooley-Tukey radix-2 FFT
- Performance: Target 60 FPS at 8192 bins
- References: ADR-0012 (Parallel FFT Worker Pool)

---

### ✅ State Management Architecture (Implemented)
**Priority**: CRITICAL - Foundation for all features  
**Status**: ✅ Completed

**Implementation Notes**:
- ✅ Zustand store with devtools integration
- ✅ Store slices: Device, Radio, UI
- ✅ Persistence integration with spark.kv
- ✅ Type-safe state with branded types
- ✅ Selective subscriptions for performance
- ✅ State hydration on app startup
- ✅ Automatic persistence on state changes

**Architecture References**:
- Follows ADR-0009 (State Management Pattern)
- Follows ADR-0005 (Storage Strategy)
- Type definitions in `/src/store/types.ts`
- Store slices in `/src/store/slices/`
- Persistence hook in `/src/store/persistence.ts`

---

### ✅ Enhanced Spectrum and Waterfall Visualizations (Implemented)
**Priority**: HIGH - Core visualization features  
**Status**: ✅ Partially Completed

**Implementation Notes**:
- ✅ Interactive spectrum view with simulated data
- ✅ Click-to-tune functionality on spectrum
- ✅ Grid overlay (configurable via settings)
- ✅ Real-time animation with requestAnimationFrame
- ✅ Pause/resume controls
- ✅ Interactive waterfall with color scheme support
- ✅ Configurable waterfall speed
- ✅ Multiple colormap support (Viridis, Plasma, Inferno, Turbo, Classic)
- ⚠️ GPU-accelerated FFT deferred (needs WebGL2/WebGPU implementation)
- ⚠️ Real RTL-SDR data integration deferred (needs WebUSB - Iteration 2)
- ⚠️ Zoom/pan controls deferred
- ⚠️ Frequency markers deferred

---

## Phase 2: Intelligence - Automated Analysis & Discovery

### 🔄 Iteration 11: Automatic Signal Classification
**User Personas**: Radio Monitoring Professional, Academic Researcher  
**Priority**: MEDIUM - Advanced intelligence feature  
**Estimated Effort**: Large (ML/DSP algorithms)

**Problem**: Users must manually identify signal types. Time-consuming for spectrum surveys.

**Value**: Automatically classifies signals as AM, FM, SSB, digital, pulsed, etc. Dramatically speeds up spectrum monitoring. Professionals can generate automated reports.

**Sub-Tasks**:

1. **Feature Extraction**
   - Extract signal features: bandwidth, center frequency, power
   - Temporal features: duty cycle, pulse repetition rate
   - Spectral features: shape, symmetry, sidebands
   - Modulation features: peak-to-average ratio, spectral efficiency

2. **Classification Algorithms**
   - Rule-based classifier (heuristics for common signals)
   - Decision tree for rapid classification
   - Optional: Neural network classifier (TensorFlow.js)
   - Per-band classification models (different signals on HF vs VHF)

3. **Signal Database**
   - Known signal signatures (AM broadcast, NOAA weather, pagers)
   - User-trainable (mark signals, build custom database)
   - Community-contributed signal library
   - Export/import signature databases

4. **UI Integration**
   - Display classification labels on spectrum/waterfall
   - Confidence score indicator
   - Manual override (user corrects classification)
   - Classification history log
   - Filter by signal type

**Success Criteria**:
- >80% classification accuracy on common signals
- Classification latency <500ms per signal
- User training improves accuracy
- No false negatives on strong, clear signals

---

### 🔄 Iteration 12: Intelligent Squelch and Noise Reduction
**User Personas**: Ham Radio Enthusiast, Emergency Communications Volunteer  
**Priority**: MEDIUM - Audio quality improvement  
**Estimated Effort**: Medium (DSP algorithms)

**Problem**: Fixed squelch threshold requires constant adjustment. Background noise reduces intelligibility.

**Value**: Adaptive squelch adjusts to changing conditions. Noise reduction improves weak signal reception. Better user experience in noisy RF environments.

**Sub-Tasks**:

1. **Adaptive Squelch**
   - Automatic noise floor tracking
   - Hysteresis to prevent squelch chatter
   - Fast attack (open quickly) and slow decay (close slowly)
   - Voice activity detection (VAD) for SSB

2. **Spectral Noise Reduction**
   - Estimate noise spectrum during quiet periods
   - Subtract noise estimate from signal
   - Preserve speech intelligibility (avoid over-processing)
   - Configurable strength (off, low, medium, high)

3. **Impulse Noise Blanker**
   - Detect impulse noise (power line noise, ignition noise)
   - Blank samples during impulses
   - Configurable blanking threshold and duration

4. **Notch Filter**
   - Automatic notch for heterodyne interference
   - Manual notch with frequency control
   - Multiple simultaneous notches

**Success Criteria**:
- Adaptive squelch tracks noise floor within 2 dB
- Noise reduction improves SNR by 3-6 dB
- Speech intelligibility maintained (user testing)
- Impulse blanker reduces ignition noise audibly

---

### 🔄 Iteration 13: Multi-Device Coordination
**User Personas**: Radio Monitoring Professional, Academic Researcher  
**Priority**: LOW - Advanced professional feature  
**Estimated Effort**: Large (Hardware + sync logic)

**Problem**: Single RTL-SDR covers limited bandwidth. Some signals span multiple MHz.

**Value**: Enables wideband monitoring by frequency-stitching multiple receivers. Research applications like direction finding (multi-antenna arrays).

**Sub-Tasks**:

1. **Multi-Device Discovery**
   - Enumerate multiple RTL-SDR devices
   - Display device list with serial numbers
   - Assign roles (primary, secondary, etc.)
   - Per-device configuration

2. **Frequency Stitching**
   - Coordinate center frequencies for adjacent coverage
   - Overlap regions for smooth stitching
   - Combine spectrums into single wide display
   - Synchronize timestamps across devices

3. **Phase Coherent Operation**
   - Sample clock synchronization (if hardware supports)
   - Cross-correlate for phase alignment
   - Coherent processing for direction finding

4. **Load Balancing**
   - Distribute demodulators across devices
   - Monitor per-device CPU and USB load
   - Automatic failover if device disconnects

**Success Criteria**:
- Stitched spectrum displays seamlessly
- Timestamp synchronization <5ms across devices
- Support for 4+ simultaneous devices
- Automatic reconnection on device failure

---

### 🔄 Iteration 14: Advanced Measurement Tools
**User Personas**: Radio Monitoring Professional, Broadcast Engineering  
**Priority**: MEDIUM - Professional measurement capability  
**Estimated Effort**: Large (Precision algorithms)

**Problem**: No quantitative measurement tools. Professionals need calibrated measurements.

**Value**: Transforms from monitoring tool to test equipment. Enables transmitter testing, compliance verification, and spectrum management documentation.

**Sub-Tasks**:

1. **Frequency Markers**
   - Place markers on spectrum (M1, M2, M3, ...)
   - Display frequency and power at marker
   - Delta measurements (M2 - M1 frequency and power)
   - Peak tracking markers (follow signal peak)

2. **Channel Power Measurement**
   - Integrate power over bandwidth
   - Occupied bandwidth (99% power containment)
   - Adjacent channel power ratio (ACPR)
   - Complementary cumulative distribution function (CCDF)

3. **Signal Quality Metrics**
   - Signal-to-noise ratio (SNR)
   - SINAD (Signal + noise + distortion to noise + distortion)
   - Total harmonic distortion (THD)
   - Error vector magnitude (EVM) for digital modes

4. **Spectrum Mask Testing**
   - Define regulatory masks (FCC, ETSI, etc.)
   - Overlay mask on spectrum
   - Pass/fail indication
   - Export compliance report

5. **Logging and Reporting**
   - Measurement log table (timestamp, values)
   - Statistics (min, max, average, std dev)
   - Export to CSV for further analysis
   - PDF report generation with plots

**Success Criteria**:
- Frequency accuracy ±1 Hz (with calibration)
- Power accuracy ±0.5 dB (with calibration)
- Measurements stable over 1-minute averaging
- Export data compatible with Excel/MATLAB

---

## Phase 3: Professional - Measurement & Compliance Tools

### 🔄 Iteration 15-20: Reserved for Professional Features
- **Iteration 15**: Direction Finding (Multi-antenna phase comparison)
- **Iteration 16**: Time-Difference-of-Arrival (TDOA) Geolocation
- **Iteration 17**: Protocol Decoders (ADS-B, AIS, APRS, DMR)
- **Iteration 18**: Spectrum Occupancy Statistics and Reporting
- **Iteration 19**: Remote Operation (Control WebSDR over network)
- **Iteration 20**: API and Scripting Interface (Automate measurements)

---

## Phase 4: Collaborative - Multi-User & Integration

### 🔄 Iteration 21-30: Reserved for Collaborative Features
- **Iteration 21**: Multi-User Annotation (Shared waterfall annotations)
- **Iteration 22**: Community Signal Database (Crowdsourced bookmarks)
- **Iteration 23**: Live Streaming (Broadcast spectrum to viewers)
- **Iteration 24**: Cloud Recording Storage (Off-device backup)
- **Iteration 25**: Mobile App Companion (Remote control from phone)
- **Iteration 26-30**: Ecosystem integrations and platform expansion

---

## Success Metrics by Persona

### Ham Radio Enthusiast
- **Engagement**: Time spent decoding digital modes per session
- **Feature Adoption**: Bookmark usage, decoder tab usage
- **Satisfaction**: User surveys on ease of use vs. traditional software

### Radio Monitoring Professional
- **Accuracy**: Frequency/power measurement validation against lab equipment
- **Productivity**: Time to complete spectrum survey (before/after automation)
- **Documentation**: Number of recordings saved, reports generated

### Academic Researcher
- **Data Quality**: SigMF compliance, metadata completeness
- **Reproducibility**: Success rate of loading others' recordings
- **Publication**: Citations in academic papers, GitHub stars

### Emergency Communications Volunteer
- **Reliability**: Uptime during simulated emergency drills
- **Usability**: Time to tune to emergency frequency from cold start
- **Training**: Onboarding time for new volunteers

### Broadcast Engineering
- **Compliance**: Accuracy of regulatory compliance measurements
- **Field Use**: Battery life, mobile device performance
- **Reporting**: Quality of auto-generated compliance reports

---

## Technical Debt and Maintenance

### Ongoing Maintenance Tasks (All Phases)
- **Browser Compatibility**: Test and fix issues on Chrome, Firefox, Safari, Edge
- **Performance Optimization**: Profile and optimize hot paths (FFT, rendering)
- **Accessibility**: ARIA labels, keyboard navigation, screen reader testing
- **Documentation**: User guide, API docs, video tutorials
- **Testing**: Expand test coverage, add integration tests
- **Security**: Regular dependency updates, vulnerability scanning
- **Bug Fixes**: Address user-reported issues within 1 week

---

## Conclusion

This roadmap balances immediate user value (Iterations 2-5: hardware integration, visualization, demodulation) with longer-term advanced features (Phase 2-4: automation, measurement, collaboration). Each iteration includes detailed sub-tasks to guide implementation and success criteria to validate completion.

**Next Immediate Priorities**:
1. **Iteration 2**: WebUSB RTL-SDR integration (transforms from demo to functional SDR)
2. **Iteration 3**: Real-time spectrum analyzer (primary visualization)
3. **Iteration 4**: Waterfall display (temporal analysis capability)
4. **Iteration 5**: Audio demodulation (enables listening to signals)

These four iterations establish the core SDR platform, after which advanced features (scanning, measurement, multi-device) build on the solid foundation.
