# Actionable Recommendations for Closing Gaps

**Based on**: Gap Analysis Report (docs/GAP_ANALYSIS_REPORT.md)  
**Date**: November 18, 2025  
**Priority**: CRITICAL → HIGH → MEDIUM → LOW

---

## CRITICAL: Must Fix Before 1.0 Release

### 1. Recording Library UI Implementation
**Current State**: Backend exists (`src/utils/iqRecorder.ts`), UI is placeholder  
**Impact**: Users can record but can't manage or playback recordings  
**Effort**: Medium (3-5 days)  
**Files to Create/Modify**:
- [ ] Implement recording library in `src/pages/Recordings.tsx`
- [ ] Create IndexedDB storage layer (`src/lib/recording/recording-manager.ts`)
- [ ] Add storage quota management UI
- [ ] Implement recording list/grid view with metadata display
- [ ] Add search and filter controls
- [ ] Implement playback controls

**Success Criteria**:
- Users can view list of recordings with metadata
- Click to playback recording
- Delete recordings
- Export recordings
- See storage quota usage

---

### 2. Documentation Accuracy Enforcement
**Current State**: ✅ FIXED in this PR  
**Impact**: Prevents future status inflation  
**Effort**: Low (ongoing process)  
**Actions**:
- [ ] Add CI check that validates ROADMAP iteration claims match code
- [ ] Create contribution guideline for marking features as "complete"
- [ ] Add template for iteration completion checklist
- [ ] Review process: UI + backend + tests required for ✅ status

---

## HIGH: Needed for Professional Users

### 3. Measurement Suite Implementation
**Current State**: MarkerTable shell exists, no backend  
**Impact**: Professionals can't make calibrated measurements  
**Effort**: Large (1-2 weeks)  
**Components to Build**:
- [ ] Frequency marker placement on spectrum
- [ ] Marker table with frequency/power display
- [ ] Delta measurements (M2 - M1)
- [ ] Peak/valley auto-detection
- [ ] Channel power integration
- [ ] CSV export for measurements
- [ ] SNR/SINAD calculation
- [ ] EVM calculation (future)

**Files to Create/Modify**:
- [ ] `src/lib/measurement/marker-manager.ts`
- [ ] `src/lib/measurement/channel-power.ts`
- [ ] `src/lib/measurement/snr-calculator.ts`
- [ ] Enhance `src/components/MarkerTable.tsx`
- [ ] Add marker controls to `src/visualization/components/Spectrum.tsx`

---

### 4. Scanner Core Logic Implementation
**Current State**: Page and components exist, minimal logic  
**Impact**: Automated scanning doesn't work  
**Effort**: Medium (1 week)  
**Components to Build**:
- [ ] Sequential scan mode
- [ ] Memory scan (scan bookmarks)
- [ ] Band scan (amateur bands)
- [ ] Signal detection threshold logic
- [ ] Dwell time management
- [ ] Activity logging
- [ ] Scan state persistence

**Files to Create/Modify**:
- [ ] `src/lib/scanning/scan-engine.ts`
- [ ] `src/lib/scanning/signal-detector.ts`
- [ ] Enhance `src/hooks/useFrequencyScanner.ts`
- [ ] Enhance `src/pages/Scanner.tsx`
- [ ] Add activity log component

---

## MEDIUM: Feature Completeness

### 5. VFO Visual Markers on Spectrum/Waterfall
**Current State**: FrequencyDisplay works, no visual markers  
**Impact**: Users can't see VFO position on spectrum  
**Effort**: Small (2-3 days)  
**Implementation**:
- [ ] Add VFO cursor overlay to Spectrum component
- [ ] Add VFO cursor overlay to Waterfall component
- [ ] Implement drag-to-tune on spectrum
- [ ] Add VFO marker color coding
- [ ] Support multiple VFO display (future)

**Files to Modify**:
- [ ] `src/visualization/components/Spectrum.tsx`
- [ ] `src/visualization/components/Waterfall.tsx`
- [ ] `src/visualization/renderers/SpectrumAnnotations.ts`

---

### 6. Bookmark Import/Export (CSV/RadioReference)
**Current State**: Bookmark management works, no import/export  
**Impact**: Users can't share bookmark lists  
**Effort**: Small (2-3 days)  
**Implementation**:
- [ ] CSV export from bookmark panel
- [ ] CSV import with validation
- [ ] RadioReference.com format support
- [ ] Bulk operations (import 1000+ bookmarks)

**Files to Modify**:
- [ ] `src/panels/Bookmarks.tsx`
- [ ] Create `src/utils/bookmark-import-export.ts`
- [ ] Add import/export buttons to panel

---

### 7. Calibration Wizard UI
**Current State**: Calibration page is placeholder  
**Impact**: Users can't calibrate for accurate measurements  
**Effort**: Medium (3-5 days)  
**Implementation**:
- [ ] PPM offset calibration wizard
- [ ] Reference signal tuning (WWV, GPS, GSM)
- [ ] Automatic offset calculation
- [ ] Per-device calibration profile storage
- [ ] Gain flatness calibration
- [ ] Calibration expiration warnings

**Files to Modify**:
- [ ] `src/pages/Calibration.tsx`
- [ ] Create `src/lib/calibration/ppm-calibrator.ts`
- [ ] Create `src/lib/calibration/gain-calibrator.ts`
- [ ] Add calibration profiles to device storage

---

## LOW: Nice to Have

### 8. Spectrum Pan/Zoom Controls
**Current State**: Fixed frequency span display  
**Impact**: Users can't zoom into narrow signals  
**Effort**: Medium (3-5 days)  
**Implementation**:
- [ ] Mouse wheel zoom on spectrum
- [ ] Click-and-drag pan
- [ ] Zoom region selection (drag to select)
- [ ] Reset zoom button
- [ ] Zoom state persistence

---

### 9. Waterfall Time-Based Navigation
**Current State**: Live scrolling only, no history  
**Impact**: Users can't review past signals  
**Effort**: Large (1-2 weeks)  
**Implementation**:
- [ ] Configurable history buffer (1min - 24hr)
- [ ] Click-to-tune from historical data
- [ ] Time axis with UTC timestamps
- [ ] Hover tooltip (time, freq, power)
- [ ] Export waterfall as PNG
- [ ] IndexedDB storage for long-term history

---

### 10. Multi-VFO Architecture
**Current State**: Single VFO only  
**Impact**: Can't monitor multiple frequencies  
**Effort**: Large (2-3 weeks)  
**Implementation**:
- [ ] VFO manager state (support 2-8 VFOs)
- [ ] VFO visual markers on spectrum
- [ ] Independent demodulator per VFO
- [ ] VFO switching keyboard shortcuts
- [ ] Independent filter bandwidth per VFO
- [ ] Per-VFO audio routing

**Note**: This is a significant architectural change. Defer until core features complete.

---

## Implementation Priority Matrix

```
┌─────────────────────────────────────────────────────────────┐
│                    PRIORITY MATRIX                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CRITICAL (Do First)        HIGH (Next)                     │
│  • Recording Library UI     • Measurement Suite             │
│  • Documentation CI         • Scanner Logic                 │
│                                                             │
│  MEDIUM (After High)        LOW (If Time)                   │
│  • VFO Visual Markers       • Pan/Zoom Controls             │
│  • Bookmark Import/Export   • Waterfall History             │
│  • Calibration Wizard       • Multi-VFO Architecture        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Criteria

Before marking an iteration as "✅ COMPLETED", all of the following must be true:

### UI Completeness
- [ ] All user-facing UI components exist (not placeholders)
- [ ] All controls are functional
- [ ] Error states are handled
- [ ] Loading states are shown
- [ ] Empty states have helpful messages

### Backend Completeness
- [ ] All data models defined
- [ ] Storage layer implemented (IndexedDB/localStorage)
- [ ] Business logic complete
- [ ] Error handling implemented

### Testing
- [ ] Unit tests for business logic
- [ ] Component tests for UI
- [ ] Integration tests for workflows
- [ ] Accessibility tests pass

### Documentation
- [ ] User-facing documentation updated
- [ ] API documentation for developers
- [ ] Architecture decision recorded (if applicable)

### Performance
- [ ] Performance targets met (FPS, latency, etc.)
- [ ] No memory leaks
- [ ] Reasonable CPU usage

---

## Quick Wins (Can Do in 1 Day Each)

1. **Add Storage Quota Display** to Recordings page (even if empty list)
2. **Add Bookmark Export to CSV** (read-only, no import yet)
3. **Add VFO Cursor** to Spectrum (vertical line at current frequency)
4. **Add Marker Table** to Analysis page (wire up to state)
5. **Add Scanner Activity Log** (empty table that fills as scanning works)

These quick wins improve perceived completeness while working on larger features.

---

## Deferred Features (Explicitly Not 1.0)

These features are in PRD but consciously deferred:

- **Multi-Device Coordination** (Feature #1) - Complex, low demand
- **CTCSS/DCS Decoder** (Feature #4) - Nice-to-have for FM
- **Scheduled Recording** (Feature #6) - Power user feature
- **Community Database Sync** (Feature #7) - Requires backend service
- **Parallel Scan** (Feature #8) - Performance optimization
- **Multi-VFO** (Feature #4) - Architectural complexity

**Rationale**: Focus on core single-device, single-VFO experience first. These can be added in 1.1, 1.2, etc.

---

## Success Metrics

After implementing CRITICAL and HIGH priority items:

**PRD Feature Completion**:
- Should reach 60-70% (6-7 of 11 features substantially complete)

**ROADMAP Iteration Completion**:
- Iterations 1-10 should be accurately marked
- At least 6 iterations truly "✅ COMPLETED"

**User Satisfaction**:
- Users can record, manage, and playback recordings
- Users can make basic measurements
- Users can scan bands automatically
- Documentation matches reality

---

**End of Recommendations**
