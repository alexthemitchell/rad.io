# rad.io Codebase Gap Analysis Report

**Date**: November 18, 2025  
**Purpose**: Identify inconsistencies and gaps between stated goals (PRD, UI-DESIGN-SPEC, ROADMAP, ADRs) and actual implementation

---

## Executive Summary

This comprehensive analysis reveals **significant gaps** between documented goals and current implementation. While the codebase demonstrates strong architectural foundations (DSP primitives, device abstraction, visualization framework), many PRD features are either missing, incomplete, or incorrectly marked as "completed" in the ROADMAP.

### Critical Findings

1. **Documentation Accuracy Issues**: ROADMAP marks several iterations as "✅ Completed" when features are only partially implemented or missing UI components
2. **PRD Feature Gaps**: 7 of 11 essential PRD features are incomplete or not started
3. **UI Spec Misalignment**: UI-DESIGN-SPEC describes components and features not yet implemented
4. **ROADMAP Status Inflation**: Multiple iterations marked "completed" have incomplete deliverables

### Summary Statistics

**PRD Features (11 total)**:
- ✅ Complete: 1 (9%) - Interactive Signal Decoder
- ⚠️ Partial: 7 (64%) - Multi-Device, Spectrum, Waterfall, Demodulator, Bookmarks, Analysis, Calibration
- ❌ Not Started: 3 (27%) - Measurements, Scanner, Recording UI

**ROADMAP Iterations (20 planned)**:
- ✅ Accurately Complete: 4 (20%)
- ⚠️ Partially Complete (marked as complete): 3 (15%)
- 🔄 In Progress: 3 (15%)
- ❌ Not Started: 10 (50%)

**ADR Compliance (7 checked)**:
- ✅ Fully Compliant: 5 (71%)
- ⚠️ Partially Compliant: 2 (29%)
- ❌ Non-Compliant: 0 (0%)

---

## Part 1: PRD Features Analysis

### Feature #1: Multi-Device SDR Management
**PRD Status**: Essential Feature  
**Actual Status**: ⚠️ **PARTIAL** (50% complete)

**What Exists**:
- ✅ HackRF device driver (`src/drivers/hackrf/`)
- ✅ RTL-SDR device model (`src/models/RTLSDRDevice.ts`)
- ✅ Airspy device model (`src/models/AirspyDevice.ts`)
- ✅ Device abstraction (`ISDRDevice` interface)
- ✅ Device registry (`src/drivers/SDRDriverRegistry.ts`)
- ✅ Device panel UI (`src/panels/Devices.tsx`)

**What's Missing**:
- ❌ 4+ simultaneous device support (no multi-device coordination)
- ❌ Synchronized start capability
- ❌ <5ms synchronization skew (not implemented)
- ❌ Automatic reconnection on USB suspend/resume
- ❌ Per-device configuration persistence
- ❌ Device health monitoring dashboard

**PRD Success Criteria**: "Supports 4+ simultaneous devices, <5ms synchronization skew..."  
**Gap**: Multi-device coordination architecture not implemented

---

### Feature #2: Adaptive Spectrum Analyzer
**PRD Status**: Essential Feature  
**Actual Status**: ⚠️ **PARTIAL** (60% complete)

**What Exists**:
- ✅ WebGL spectrum renderer (`src/visualization/renderers/WebGLSpectrum.ts`)
- ✅ Canvas fallback (`src/visualization/renderers/CanvasSpectrum.ts`)
- ✅ FFT processor (`src/visualization/processors/FFTProcessor.ts`)
- ✅ Window functions (in `src/lib/dsp/primitives.ts`)
- ✅ Spectrum component (`src/visualization/components/Spectrum.tsx`)

**What's Missing**:
- ❌ GPU FFT compute shader (PRD specifies WebGPU/WebGL2 compute)
- ❌ Configurable FFT sizes (256-262144) - limited range
- ❌ Peak markers with frequency/power readout
- ❌ ±0.3dB amplitude accuracy calibration
- ❌ Resolution bandwidth (RBW) indicators
- ❌ Calibrated frequency markers with ppm-accurate readouts

**Gap**: Performance targets not verified, measurement accuracy not calibrated

---

### Feature #3: Multi-Layer Waterfall Display
**PRD Status**: Essential Feature  
**Actual Status**: ⚠️ **PARTIAL** (55% complete)

**What Exists**:
- ✅ WebGL waterfall (`src/visualization/renderers/WebGLWaterfall.ts`)
- ✅ Canvas fallback (`src/visualization/renderers/CanvasWaterfall.ts`)
- ✅ Waterfall component (`src/visualization/components/Waterfall.tsx`)
- ✅ Viridis colormap (ADR-0019)
- ✅ Multiple palettes (Plasma, Inferno, Turbo)

**What's Missing**:
- ❌ Configurable history (1 min to 24 hours with compression)
- ❌ Click-to-tune from historical data
- ❌ Bandwidth cursors showing occupied spectrum
- ❌ Time markers and overlay annotations
- ❌ Export as timestamped PNG
- ❌ Accurate UTC timestamps on Y-axis
- ❌ Independent zoom axes

**Gap**: Historical data storage and time-based navigation not implemented

---

### Feature #4: Multi-Channel Demodulator
**PRD Status**: Essential Feature  
**Actual Status**: ❌ **INCOMPLETE** (20% complete)

**What Exists**:
- ✅ FM demodulator class (`src/utils/audioStream.ts`)
- ✅ AM demodulator class (`src/utils/audioStream.ts`)
- ✅ Plugin architecture for demodulators (`src/plugins/demodulators/`)
- ✅ PSK31 demodulator plugin
- ✅ ATSC 8-VSB demodulator

**What's Missing**:
- ❌ 8+ simultaneous VFOs within bandwidth
- ❌ Independent filter shapes (brick-wall, Gaussian, raised-cosine)
- ❌ Per-VFO recording capability
- ❌ Automatic notch filtering
- ❌ <150ms click-to-audio latency
- ❌ SSB demodulator (USB/LSB/CW modes)
- ❌ CTCSS/DCS tone decoder for FM
- ❌ Web Audio integration for multiple channels
- ❌ VFO placement UI on spectrum

**Gap**: Multi-channel architecture not implemented, most demodulation modes missing

---

### Feature #5: Advanced Measurement Suite
**PRD Status**: Essential Feature  
**Actual Status**: ❌ **NOT STARTED** (5% complete)

**What Exists**:
- ✅ MarkerTable component (`src/components/MarkerTable.tsx`) - UI shell only
- ✅ Measurement logger (`src/lib/measurement/measurement-logger.ts`)
- ✅ Spectrum mask (`src/lib/measurement/spectrum-mask.ts`)

**What's Missing**:
- ❌ Frequency markers with delta measurements
- ❌ Channel power integration (CCDF)
- ❌ Occupied bandwidth (99%)
- ❌ Adjacent channel power ratio (ACPR)
- ❌ Signal-to-noise ratio (SNR/SINAD)
- ❌ Modulation quality (EVM)
- ❌ Spectral mask compliance UI
- ❌ CSV/JSON export for measurements

**Gap**: Entire measurement suite architecture needs implementation

---

### Feature #6: Intelligent Recording System
**PRD Status**: Essential Feature  
**Actual Status**: ⚠️ **BACKEND ONLY** (40% complete)

**What Exists**:
- ✅ IQRecorder class (`src/utils/iqRecorder.ts`)
- ✅ Recording metadata types
- ✅ Save/load IQ recordings (binary and JSON)
- ✅ Recordings page stub (`src/pages/Recordings.tsx`)

**What's Missing**:
- ❌ **Recording UI** - Recordings page is placeholder with TODOs
- ❌ Threshold-based auto-trigger
- ❌ Scheduled recordings
- ❌ Pre-trigger buffer (5-30s)
- ❌ SigMF-compliant format export
- ❌ Recording library UI with search/filter

**CRITICAL**: ROADMAP marks "✅ Iteration 8: Recording System (COMPLETED)" but UI is completely missing

---

### Feature #7: Frequency Database & Bookmarks
**PRD Status**: Essential Feature  
**Actual Status**: ⚠️ **PARTIAL** (70% complete)

**What Exists**:
- ✅ Bookmarks panel (`src/panels/Bookmarks.tsx`)
- ✅ Bookmark data model with metadata
- ✅ Search and filter functionality
- ✅ Create/edit bookmark dialog
- ✅ Persistence via Zustand + localStorage

**What's Missing**:
- ❌ CSV/RadioReference import/export
- ❌ Visual markers on spectrum/waterfall
- ❌ Schedule awareness (active times)
- ❌ Community database sync

**Gap**: Import/export and visual integration missing

---

### Feature #8: Adaptive Scanner
**PRD Status**: Essential Feature  
**Actual Status**: ❌ **NOT STARTED** (10% complete)

**What Exists**:
- ✅ Scanner page stub (`src/pages/Scanner.tsx`)
- ✅ FrequencyScanner component (`src/components/FrequencyScanner.tsx`)
- ✅ Band scanner utility (`src/lib/dsp/band-scanner.ts`)

**What's Missing**:
- ❌ Multiple scan modes (sequential, memory, band scope)
- ❌ Configurable dwell times
- ❌ Auto-store of active signals
- ❌ Priority channel monitoring
- ❌ Activity logging
- ❌ <50ms hop time implementation

**Gap**: Scanner infrastructure exists but core scanning logic not implemented

---

### Feature #9: Interactive Signal Decoder
**PRD Status**: Essential Feature  
**Actual Status**: ✅ **COMPLETE** (95% complete)

**What Exists**:
- ✅ RTTY decoder (45.45 and 50 baud)
- ✅ PSK31/63/125 decoder with AFC
- ✅ SSTV decoder (Martin, Scottie, Robot modes)
- ✅ Decode page (`src/pages/Decode.tsx`)
- ✅ Mode-specific configuration

**Gap**: Minimal - feature largely complete

---

### Feature #10: Signal Analysis Tools
**PRD Status**: Essential Feature  
**Actual Status**: ⚠️ **PARTIAL** (40% complete)

**What Exists**:
- ✅ IQConstellation component (`src/visualization/components/IQConstellation.tsx`)
- ✅ EyeDiagram component (`src/visualization/components/EyeDiagram.tsx`)
- ✅ Analysis page (`src/pages/Analysis.tsx`)

**What's Missing**:
- ❌ Freeze/persistence modes
- ❌ Automatic symbol rate estimation
- ❌ EVM calculation for QAM/PSK
- ❌ Export as image with annotations
- ❌ Phase noise measurement

**Gap**: Visualization components exist but advanced analysis features missing

---

### Feature #11: Calibration & Correction
**PRD Status**: Essential Feature  
**Actual Status**: ⚠️ **PARTIAL** (30% complete)

**What Exists**:
- ✅ DC offset correction (`src/lib/dsp/primitives.ts`)
- ✅ Calibration page stub (`src/pages/Calibration.tsx`)

**What's Missing**:
- ❌ Frequency offset calibration wizard
- ❌ PPM drift tracking
- ❌ Gain flatness calibration
- ❌ Per-device calibration profiles
- ❌ ±0.5 ppm accuracy implementation

**Gap**: Basic corrections exist but calibration workflow not implemented

---

## Part 2: ROADMAP Accuracy Issues

### Iteration 7: Bookmark System
**ROADMAP Claim**: ✅ COMPLETED  
**Reality**: ⚠️ PARTIAL - CSV import/export and visual markers deferred

---

### Iteration 8: Recording System
**ROADMAP Claim**: ✅ COMPLETED  
**Reality**: ❌ **BACKEND ONLY** - UI completely missing

**Recommended Fix**: Update ROADMAP to mark UI as "deferred" or change status to ⚠️ PARTIAL

---

### Iteration 10: Settings and Calibration
**ROADMAP Claim**: ✅ Partially Completed  
**Reality**: ✅ ACCURATE - Settings exist, calibration wizard deferred

---

## Part 3: UI-DESIGN-SPEC Issues

### Section 4.2: Spectrum Analyzer
**Spec Claims**: "Markers: M1… Mn; delta display; peak hold trace; RBW indicator"  
**Reality**: ❌ NOT IMPLEMENTED

**Recommended Fix**: Add "(Planned)" to features not yet implemented

---

### Section 4.6: Scanner
**Spec Claims**: "Config panel; activity log with thumbnails"  
**Reality**: ❌ MINIMAL IMPLEMENTATION

**Recommended Fix**: Mark as "In Progress" not "Implemented"

---

### Section 4.8: Recordings
**Spec Claims**: "IQ + audio; trigger modes; storage management"  
**Reality**: ❌ UI MISSING (backend exists)

**Recommended Fix**: Add note that UI is not yet implemented

---

## Part 4: ADR Compliance

### ✅ Fully Compliant
- ADR-0009: State Management Pattern (Zustand)
- ADR-0026: Unified DSP Primitives Architecture
- ADR-0028: DSP Environment Detection
- ADR-0017 & ADR-0023: Accessibility

### ⚠️ Partially Compliant
- ADR-0005: Storage Strategy (IndexedDB backend exists but no UI)
- ADR-0003: WebGL2/WebGPU (WebGL works, WebGPU compute shaders missing)

---

## Part 5: Critical Recommendations

### Immediate Actions (Documentation Accuracy)

1. **Update ROADMAP.md**
   - Change Iteration 8 status to ⚠️ PARTIAL or add note "Backend only, UI deferred"
   - Add legend explaining status symbols
   - Document deferred features clearly

2. **Update UI-DESIGN-SPEC.md**
   - Add "(Planned)" or "(In Progress)" to features not yet implemented
   - Clarify Phase implementation status
   - Remove "Implemented" from incomplete features

3. **Update PRD.md**
   - Add implementation status section
   - Link to ROADMAP for current progress
   - Clarify that PRD describes end goals, not current state

### Medium Priority (Feature Completion)

4. **Implement Recordings UI**
   - Create recording library grid/list view
   - Add playback controls
   - Implement SigMF export
   - Add storage quota management

5. **Complete Scanner Implementation**
   - Implement scan modes (sequential, memory, band)
   - Add activity logging
   - Create dwell time configuration

6. **Add Measurement Tools**
   - Implement frequency markers
   - Add delta measurements
   - Create channel power measurement

### Low Priority (Enhancement)

7. **Multi-VFO Architecture**
   - Design VFO management system
   - Implement 2-4 simultaneous VFOs
   - Add VFO visual markers on spectrum

8. **Calibration Wizard**
   - Create calibration workflow UI
   - Implement PPM correction
   - Add per-device profiles

---

## Conclusion

The rad.io codebase demonstrates **strong architectural foundations** and **excellent accessibility implementation**, but suffers from **documentation inflation** and **feature incompleteness**. The gap between stated goals (PRD, ROADMAP) and actual implementation is significant.

### Strengths
1. ✅ Solid DSP primitives architecture (ADR-0026 compliant)
2. ✅ Excellent accessibility (36+ tests, WCAG AA compliant)
3. ✅ Clean device abstraction (ISDRDevice interface)
4. ✅ Good state management (Zustand + persistence)
5. ✅ Comprehensive testing infrastructure

### Weaknesses
1. ❌ ROADMAP status inflation (features marked "complete" are partial)
2. ❌ Missing UIs for backend features (Recordings, Scanner)
3. ❌ PRD promises not yet implemented (multi-VFO, measurements)
4. ❌ UI spec describes features that don't exist

### Recommended Path Forward
1. **Accuracy First**: Update ROADMAP and UI-DESIGN-SPEC to reflect actual status
2. **UI Completion**: Implement Recordings and Scanner UIs
3. **Feature Scoping**: Defer or implement PRD features (measurements, multi-VFO)
4. **Documentation Alignment**: Ensure docs match code reality

---

**Full Detailed Analysis**: See `/tmp/comprehensive-gap-analysis.md` for exhaustive analysis with file-level details

**Report End**
