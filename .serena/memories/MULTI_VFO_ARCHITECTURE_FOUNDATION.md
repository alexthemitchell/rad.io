# Multi-VFO Architecture Foundation

## Overview
Multi-VFO architecture enables simultaneous demodulation of multiple signals from a single wideband capture. Complete specification: `docs/reference/multi-vfo-architecture.md`

## Key Data Structures

### VfoConfig Interface
- **Location**: Will be in `src/types/vfo.ts`
- **Fields**: id, centerHz, modeId, bandwidthHz, audioEnabled, audioGain, squelch, label, color, stereoPan, priority
- **Constraints**: centerHz within hardware bandwidth, minimum spacing between VFOs (mode-dependent)

### VfoState Interface
- **Extends**: VfoConfig
- **Runtime fields**: status (IDLE/ACTIVE/PAUSED/ERROR), demodulator instance, audioNode, metrics, error
- **Metrics**: rssi, snr, samplesProcessed, processingTime, custom demodulator data

## State Management

### Zustand Slice
- **File**: `src/store/slices/vfoSlice.ts` (to be created)
- **Pattern**: Follows existing frequencySlice pattern
- **Persistence**: Ephemeral (runtime-only), separate VfoPreset storage in localStorage
- **Storage key**: `rad.vfo-presets.v1`

## DSP Coordination Strategies

### Hybrid Approach (Recommended)
- **1 VFO**: Per-VFO mixing (simple frequency shift + filter + decimate)
- **2 VFOs**: Per-VFO mixing (PFB overhead not justified)
- **3+ VFOs**: Polyphase Filter Bank (PFB) channelizer (amortizes cost)

### Existing References
- **Multi-channel implementation**: `src/utils/multiStationFM.ts` (FM RDS scanner)
- **PFB channelizer**: `src/lib/dsp/pfbChannelizer.ts`
- **Windowed DFT channelizer**: `src/lib/dsp/wdfdftChannelizer.ts`

## Resource Budgets

### CPU
- **Target**: <70% CPU for responsive UI (60 FPS)
- **Per-VFO cost**: AM ~0.3ms, FM ~0.8ms, ATSC ~4ms (2048 samples @ 2 MS/s)
- **PFB overhead**: ~0.5ms (amortized across all VFOs)
- **Max VFOs**: 8-16 depending on platform and mode complexity

### Memory
- **Per-VFO**: ~400 KB average (50-500 KB demodulator + 200 KB audio buffers)
- **Linear scaling**: Base 50 MB + (numVFOs × 0.4 MB)

### Audio
- **Concurrent streams**: Max 8 (browser-dependent)
- **Mixing**: Simple sum with gain normalization, divide by stream count

## Key Constraints

### Frequency
- All VFO centerHz must be within hardware bandwidth: `hardwareCenterHz ± (sampleRate/2)`
- Minimum spacing between VFOs (examples): AM 10kHz, NBFM 12.5kHz, WBFM 200kHz, ATSC 6MHz

### Filter Overlap
- Risk: Adjacent VFOs interfere if too close
- Mitigation: Validate spacing on creation, visual indicators in UI, quality PFB filters (8+ taps/phase)

## Implementation Phases

1. **State Management**: vfoSlice.ts, validation, presets
2. **DSP Pipeline**: MultiVfoProcessor class, channel extraction, audio mixing
3. **UI Components**: useMultiVfo hook, VfoManager, VfoCard
4. **Integration**: Wire into useReception hook, existing demodulator plugins
5. **Optimization**: CPU profiling, adaptive priority, memory leak prevention

## Critical Integration Points

### Demodulator Plugins
- Each VFO uses a DemodulatorPlugin instance (existing interface)
- Plugin lifecycle: initialize() → activate() → setParameters() → demodulate()
- Cleanup on VFO removal: demodulator.dispose()

### Audio Pipeline
- Existing: `src/lib/audio/` (Web Audio API integration)
- New: Multi-stream mixer before final output
- Strategy: Sum audio with per-VFO gain, normalize by stream count

### Sample Processing
- **Entry point**: `src/hooks/useReception.ts` device.on('samples') callback
- **New layer**: MultiVfoProcessor.processSamples() before visualization
- **Flow**: Wideband samples → channelizer → per-VFO demod → audio mixer → speakers

## Risks & Mitigations

1. **CPU overload**: Dynamic limiting, pause low-priority VFOs, warn user at 70% budget
2. **Filter crosstalk**: Enforce spacing, quality filters, visual overlap indicators
3. **Audio clipping**: Normalize mixing, soft limiter, MAX_CONCURRENT_AUDIO=8
4. **Memory leaks**: Explicit dispose on removeVfo, ref counting, periodic GC, stress testing
5. **Backward compat**: Fall back to implicit VFO when vfos.size === 0

## Future Tasks Reference

When implementing multi-VFO:
1. Read full spec: `docs/reference/multi-vfo-architecture.md`
2. Review existing multi-channel code: `src/utils/multiStationFM.ts`
3. Follow state patterns: `src/store/slices/frequencySlice.ts`
4. Use existing channelizers: `pfbChannelize()` and `windowedDFTChannelize()`
5. Integrate with demodulator plugins: `src/types/plugin.ts`
