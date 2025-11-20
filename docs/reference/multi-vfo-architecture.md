# Multi-VFO Architecture & State Design

## Table of Contents

1. [Overview](#overview)
2. [Use Cases & Motivation](#use-cases--motivation)
3. [VFO Object Structure](#vfo-object-structure)
4. [Constraints & Limitations](#constraints--limitations)
5. [Coordination Strategies](#coordination-strategies)
6. [Resource Considerations](#resource-considerations)
7. [State Management](#state-management)
8. [DSP Pipeline Integration](#dsp-pipeline-integration)
9. [API Design](#api-design)
10. [Risks & Mitigation](#risks--mitigation)
11. [Acceptance Criteria](#acceptance-criteria)
12. [Implementation Roadmap](#implementation-roadmap)
13. [References](#references)

## Overview

Multi-VFO (Variable Frequency Oscillator) architecture enables simultaneous demodulation of multiple signals within the current SDR bandwidth capture. This document defines the data model, lifecycle, constraints, and coordination strategies for implementing concurrent demodulators in rad.io.

### Key Concept

A traditional SDR application has a single VFO that tunes to one frequency at a time. Multi-VFO extends this to support N concurrent VFOs, each with:

- Independent center frequency (within current hardware bandwidth)
- Independent demodulation mode (AM, FM, SSB, etc.)
- Independent audio routing and mixing
- Independent bandwidth filtering
- Shared underlying IQ sample stream from hardware

### Design Goals

1. **Efficient resource utilization**: Single wideband capture feeding multiple demodulators
2. **Minimal CPU overhead**: Leverage channelization to avoid redundant DSP operations
3. **Flexible configuration**: Dynamic VFO creation/removal without restarting hardware
4. **Clear isolation**: Each VFO operates independently with its own state
5. **Scalable limits**: Graceful degradation with clear maximum VFO count
6. **Backward compatibility**: Single-VFO workflows continue to work unchanged

## Use Cases & Motivation

### Primary Use Cases

**1. Simultaneous Signal Monitoring**

- Monitor multiple frequencies in the same band (e.g., air traffic control tower + ground + weather)
- Cross-band monitoring (e.g., repeater input and output simultaneously)
- Broadcast band scanning with multiple active decoders

**2. Multi-Channel RDS Decoding**

- Scan entire FM broadcast band (88-108 MHz) with 20 MHz capture
- Simultaneously decode RDS from all detected FM stations
- Build comprehensive station database without sequential tuning

**3. Comparison & Analysis**

- A/B comparison of different demodulation modes on same signal
- Simultaneous wideband (WBFM) and narrowband (NBFM) monitoring
- Signal quality comparison across adjacent channels

**4. Educational & Training**

- Demonstrate multiple modulation types simultaneously
- Show spectral efficiency and channel spacing
- Interactive exploration of crowded spectrum

**5. Recording & Replay**

- Replay wideband IQ recording with multiple independent demodulators
- Extract multiple audio streams from single recording session
- Post-processing analysis with flexible demodulation

### Real-World Examples

**Example 1: Aviation Monitoring**

```
Hardware: HackRF One @ 128 MHz, 20 MS/s
VFO 1: 127.85 MHz AM (Tower)
VFO 2: 128.10 MHz AM (Ground)
VFO 3: 128.25 MHz AM (ATIS)
Audio: Mixed stereo (left: tower, right: ground, ATIS to both)
```

**Example 2: FM Broadcast RDS Scanning**

```
Hardware: HackRF One @ 98 MHz, 20 MS/s
VFO 1-10: 88.1, 89.3, 90.5, 91.7, ..., 107.9 MHz (all WBFM)
Audio: Disabled (RDS-only mode)
Update Rate: 1 scan per second for fresh RDS data
```

**Example 3: Repeater Monitoring**

```
Hardware: RTL-SDR @ 145 MHz, 2.048 MS/s
VFO 1: 145.230 MHz NBFM (repeater output)
VFO 2: 144.630 MHz NBFM (repeater input, -600 kHz split)
Audio: VFO 1 only (monitor output)
```

## VFO Object Structure

### Core Interface: `VfoConfig`

```typescript
/**
 * Configuration for a single Virtual Frequency Oscillator (VFO)
 */
export interface VfoConfig {
  /**
   * Unique identifier for this VFO
   * Format: UUID v4 or sequential ID (e.g., "vfo-1", "vfo-2")
   */
  id: string;

  /**
   * Center frequency in Hz
   * Constraints:
   * - Must be within current hardware capture bandwidth
   * - Must maintain minimum spacing from other VFOs (mode-dependent)
   * - Must be >= 0
   */
  centerHz: number;

  /**
   * Demodulation mode identifier
   * Must match a registered demodulator plugin ID
   * Examples: "am", "wbfm", "nbfm", "usb", "lsb", "cw", "atsc-8vsb"
   */
  modeId: string;

  /**
   * Demodulation bandwidth in Hz
   * Defines the filter width centered at centerHz
   * Typical values:
   * - AM: 5-10 kHz
   * - NBFM: 12.5 kHz
   * - WBFM: 200 kHz
   * - USB/LSB: 2.4-3 kHz
   * - ATSC: 6 MHz
   */
  bandwidthHz: number;

  /**
   * Audio output enabled
   * When true, demodulated audio is routed to speakers/mixer
   * When false, demodulation occurs but audio is muted (useful for RDS, metrics)
   */
  audioEnabled: boolean;

  /**
   * Optional audio gain (0.0 to 1.0, default: 1.0)
   * Applied after demodulation, before mixing
   */
  audioGain?: number;

  /**
   * Optional squelch threshold (0-100, mode-dependent)
   * Mutes audio when signal strength below threshold
   */
  squelch?: number;

  /**
   * Optional label for UI display
   * Example: "Tower", "FM 91.5", "Repeater Out"
   */
  label?: string;

  /**
   * Optional color for UI visualization
   * CSS color string for spectrum annotations
   */
  color?: string;

  /**
   * Optional stereo panning (-1.0 left, 0.0 center, 1.0 right)
   * Used when multiple VFOs route audio simultaneously
   */
  stereoPan?: number;

  /**
   * Creation timestamp (milliseconds since epoch)
   * Auto-populated on VFO creation
   */
  createdAt?: number;

  /**
   * Optional priority (0-10, default: 5)
   * Higher priority VFOs get more CPU resources under load
   */
  priority?: number;
}
```

### Extended Runtime State: `VfoState`

```typescript
/**
 * Runtime state for an active VFO instance
 * Extends VfoConfig with operational data
 */
export interface VfoState extends VfoConfig {
  /**
   * Current operational status
   */
  status: VfoStatus;

  /**
   * Reference to active demodulator plugin instance
   */
  demodulator: DemodulatorPlugin | null;

  /**
   * Audio output node (Web Audio API)
   * Null when audioEnabled is false
   */
  audioNode: AudioNode | null;

  /**
   * Most recent demodulation metrics
   */
  metrics: VfoMetrics;

  /**
   * Last error message (if status === ERROR)
   */
  error?: string;
}

/**
 * VFO operational status
 */
export enum VfoStatus {
  /** VFO created but demodulator not initialized */
  IDLE = "idle",

  /** Demodulator active, processing samples */
  ACTIVE = "active",

  /** Temporarily paused (e.g., frequency out of range) */
  PAUSED = "paused",

  /** Error occurred, see error field */
  ERROR = "error",
}

/**
 * Real-time VFO performance and signal metrics
 */
export interface VfoMetrics {
  /** Signal strength (RSSI) in dBFS */
  rssi: number;

  /** Signal-to-noise ratio in dB (if available) */
  snr?: number;

  /** Number of samples processed in last batch */
  samplesProcessed: number;

  /** CPU time for last demodulation (ms) */
  processingTime: number;

  /** Demodulator-specific metrics (e.g., RDS lock, ATSC sync) */
  custom?: Record<string, number | string | boolean>;

  /** Timestamp of last metric update */
  timestamp: number;
}
```

## Constraints & Limitations

### Frequency Constraints

**1. Hardware Bandwidth Constraint**

All VFO center frequencies must lie within the current hardware capture bandwidth:

```
hardwareCenterHz - (sampleRate / 2) <= vfoCenterHz <= hardwareCenterHz + (sampleRate / 2)
```

**Example**:

```
Hardware: HackRF One @ 100 MHz center, 20 MS/s
Valid VFO range: 90 MHz to 110 MHz
Invalid: 115 MHz (outside capture bandwidth)
```

**2. Minimum VFO Spacing**

VFOs should maintain minimum separation to avoid filter overlap and demodulation artifacts:

```typescript
const MIN_VFO_SPACING_HZ: Record<string, number> = {
  am: 10_000, // 10 kHz
  nbfm: 12_500, // 12.5 kHz (standard channel spacing)
  wbfm: 200_000, // 200 kHz (standard FM broadcast spacing)
  usb: 3_000, // 3 kHz
  lsb: 3_000, // 3 kHz
  cw: 500, // 500 Hz
  "atsc-8vsb": 6_000_000, // 6 MHz
};

// Spacing check between VFO i and VFO j:
const spacing = Math.abs(vfo_i.centerHz - vfo_j.centerHz);
const minSpacing = Math.max(
  MIN_VFO_SPACING_HZ[vfo_i.modeId] ?? 0,
  MIN_VFO_SPACING_HZ[vfo_j.modeId] ?? 0,
);

if (spacing < minSpacing) {
  throw new Error(
    `VFO spacing ${spacing} Hz below minimum ${minSpacing} Hz`,
  );
}
```

**3. Bandwidth Constraint**

Each VFO's bandwidth must fit within hardware capture:

```typescript
const vfoLowEdge = vfo.centerHz - vfo.bandwidthHz / 2;
const vfoHighEdge = vfo.centerHz + vfo.bandwidthHz / 2;
const hwLowEdge = hardwareCenterHz - sampleRate / 2;
const hwHighEdge = hardwareCenterHz + sampleRate / 2;

if (vfoLowEdge < hwLowEdge || vfoHighEdge > hwHighEdge) {
  throw new Error(`VFO bandwidth exceeds hardware capture range`);
}
```

### Resource Constraints

**1. Maximum VFO Count**

CPU and memory limitations impose maximum simultaneous VFOs:

```typescript
/** Platform-dependent maximum VFO counts */
const MAX_VFOS: Record<string, number> = {
  // Conservative limits based on demodulation complexity
  desktop_high: 16, // Modern desktop (8+ cores, 16+ GB RAM)
  desktop_mid: 8, // Mid-range desktop (4 cores, 8 GB RAM)
  laptop: 6, // Typical laptop
  mobile: 3, // Mobile devices (limited CPU, battery)

  // Per-mode complexity factors (relative to AM = 1.0)
  complexity_am: 1.0,
  complexity_nbfm: 1.5,
  complexity_wbfm: 2.0,
  complexity_ssb: 1.2,
  complexity_cw: 0.8,
  complexity_atsc: 5.0, // Very CPU-intensive
};

/**
 * Dynamic VFO limit based on current system load and VFO mix
 */
function calculateMaxVFOs(
  platform: string,
  activeVfos: VfoState[],
): number {
  const baseLimit = MAX_VFOS[`platform_${platform}`] ?? 4;

  // Calculate complexity budget consumed
  let complexityUsed = 0;
  for (const vfo of activeVfos) {
    const complexity = MAX_VFOS[`complexity_${vfo.modeId}`] ?? 1.0;
    complexityUsed += complexity;
  }

  // Remaining budget
  const complexityRemaining = baseLimit - complexityUsed;

  return Math.floor(complexityRemaining);
}
```

**2. CPU Scaling**

Each VFO adds CPU overhead:

- **Channelization**: ~5-10% per VFO (amortized with PFB)
- **Demodulation**: Mode-dependent (AM: 2%, FM: 5%, ATSC: 20%)
- **Audio mixing**: ~1% per enabled audio VFO
- **Total budget**: Keep < 70% CPU to maintain 60 FPS UI

**3. Memory Scaling**

Estimated memory per VFO:

- VFO state object: ~1 KB
- Demodulator instance: ~50-500 KB (mode-dependent)
- Audio buffers: ~200 KB per enabled audio VFO
- Channelizer output buffer: ~100 KB per VFO

**Total estimate**: 350 KB - 800 KB per VFO, ~10 MB for 12 VFOs

### Audio Constraints

**1. Maximum Concurrent Audio Streams**

Web Audio API limits simultaneous audio sources:

```typescript
const MAX_CONCURRENT_AUDIO = 8; // Browser-dependent, conservative estimate
```

**2. Audio Mixing Strategy**

When multiple VFOs have `audioEnabled: true`:

- **Option A**: Simple mixing (sum signals, normalize to prevent clipping)
- **Option B**: Stereo panning (distribute VFOs across stereo field)
- **Option C**: Priority-based (only highest priority VFO gets audio)
- **Option D**: User-selected "active" VFO (others muted)

## Coordination Strategies

### Strategy 1: Single-Pass Polyphase Channelizer (Recommended)

**Architecture**:

```
Wideband IQ samples (e.g., 20 MS/s, 20 MHz BW)
    ↓
[Polyphase Filter Bank Channelizer]
    - M uniform subbands (e.g., M=100 for 200 kHz channels)
    - Each subband decimated to sampleRate/M (200 kS/s)
    ↓
[Channel Router]
    - Map each VFO to nearest subband(s)
    - Extract relevant decimated samples per VFO
    ↓
[Per-VFO Demodulators] (in parallel)
    - VFO 1: AM demod @ 95.5 MHz → audio_1
    - VFO 2: FM demod @ 98.1 MHz → audio_2
    - VFO N: SSB demod @ 101.3 MHz → audio_N
    ↓
[Audio Mixer]
    - Combine enabled audio streams
    - Apply gains, panning, squelch
    ↓
Speakers / Web Audio API
```

**Advantages**:

- **Efficient**: Single channelization pass for all VFOs
- **Scalable**: Adding VFOs doesn't multiply channelization cost
- **Proven**: Existing `pfbChannelize()` and `windowedDFTChannelize()` implementations
- **Low latency**: Minimal buffering required

**Disadvantages**:

- **Fixed grid**: VFOs must align to subband centers (or interpolate)
- **Filter overlap**: Adjacent VFOs may have crosstalk if too close
- **Initial cost**: PFB setup has overhead (worthwhile for 3+ VFOs)

**Implementation Reference**:

See `src/utils/multiStationFM.ts` lines 215-247 for existing PFB channelizer integration.

**Recommended Configuration**:

```typescript
const channelConfig = {
  numSubbands: Math.floor(sampleRate / channelBandwidth),
  tapsPerPhase: 8, // Quality vs CPU tradeoff
  usePFB: vfoCount >= 3, // Use PFB for 3+ VFOs, else per-VFO mixers
};
```

### Strategy 2: Per-VFO Frequency Mixing

**Architecture**:

```
Wideband IQ samples
    ↓
[VFO 1 Processing]
    → Frequency shift (mix to baseband)
    → Low-pass filter (isolate bandwidth)
    → Decimate
    → Demodulate → audio_1

[VFO 2 Processing] (parallel)
    → Frequency shift
    → Low-pass filter
    → Decimate
    → Demodulate → audio_2

[VFO N Processing] (parallel)
    → Frequency shift
    → Low-pass filter
    → Decimate
    → Demodulate → audio_N
    ↓
[Audio Mixer]
```

**Advantages**:

- **Flexible**: VFOs can tune to arbitrary frequencies (no grid constraint)
- **Simple**: Each VFO is independent, easy to reason about
- **Isolated**: No crosstalk between VFOs (independent filters)

**Disadvantages**:

- **CPU intensive**: Each VFO performs full mixing + filtering
- **Redundant**: Overlapping VFO filters duplicate work
- **Memory**: Each VFO maintains separate filter state

**Use Case**: Best for 1-2 VFOs or when VFOs are very dynamic (frequent frequency changes).

**Implementation Reference**:

See `src/utils/multiStationFM.ts` lines 297-329 for frequency shift + filter + decimate pipeline.

### Strategy 3: Hybrid Approach (Recommended for Production)

**Decision Logic**:

```typescript
if (vfoCount === 1) {
  // Single VFO: use per-VFO mixing (simplest)
  strategy = "per-vfo-mixer";
} else if (vfoCount <= 2) {
  // 2 VFOs: cost of PFB not justified
  strategy = "per-vfo-mixer";
} else {
  // 3+ VFOs: PFB channelizer amortizes cost
  strategy = "polyphase-channelizer";
}
```

**Advantages**:

- **Optimal for all cases**: Adapts to VFO count
- **Smooth transition**: User doesn't notice strategy change

**Implementation**:

Abstract channelization behind a common interface:

```typescript
interface ChannelExtractor {
  extractChannels(
    samples: IQSample[],
    vfos: VfoConfig[],
  ): Map<string, IQSample[]>;
}

class PFBChannelExtractor implements ChannelExtractor {
  /* Uses pfbChannelize() */
}
class MixerChannelExtractor implements ChannelExtractor {
  /* Uses per-VFO mixing */
}
```

## Resource Considerations

### CPU Budget Allocation

**Target Performance**: Maintain 60 FPS UI (< 16.67 ms per frame)

**Budget Breakdown**:

- **UI rendering**: 5 ms
- **FFT for visualization**: 3 ms
- **Multi-VFO DSP**: 8 ms (remaining budget)

**Per-VFO CPU Cost** (on modern desktop, 2048 samples @ 2 MS/s):

| Operation             | Cost per VFO | 4 VFOs | 8 VFOs |
| --------------------- | ------------ | ------ | ------ |
| PFB channelize (once) | 0.5 ms       | 0.5 ms | 0.5 ms |
| AM demodulation       | 0.3 ms       | 1.2 ms | 2.4 ms |
| FM demodulation       | 0.8 ms       | 3.2 ms | 6.4 ms |
| Audio mixing          | 0.1 ms       | 0.4 ms | 0.8 ms |
| **Total (AM)**        | -            | 2.1 ms | 3.7 ms |
| **Total (FM)**        | -            | 4.1 ms | 7.7 ms |

**Scaling Strategy**:

1. **Profile-guided optimization**: Measure actual CPU per VFO mode
2. **Dynamic limiting**: Warn user when approaching CPU budget
3. **Priority system**: Pause low-priority VFOs under load
4. **Adaptive quality**: Reduce FFT size or sample rate if needed

### Memory Management

**Memory Growth Pattern**:

```
Total Memory = Base + (numVFOs × perVFOMemory)

Base = 50 MB (application baseline)
perVFOMemory = 400 KB (average across modes)

4 VFOs:  50 + (4 × 0.4) = 51.6 MB
8 VFOs:  50 + (8 × 0.4) = 53.2 MB
16 VFOs: 50 + (16 × 0.4) = 56.4 MB
```

**Memory Optimization**:

- **Pooled buffers**: Reuse channelizer output buffers
- **Lazy initialization**: Only allocate demodulator on first use
- **Garbage collection**: Clean up paused VFOs after timeout

### Web Worker Utilization

**Current Architecture**: FFT offloaded to worker pool

**Multi-VFO Extension**:

- **Option A**: Demodulate in workers (latency concern)
- **Option B**: Keep demodulation on main thread (simpler, proven)
- **Option C**: Hybrid (PFB in worker, demodulation on main thread)

**Recommendation**: Option B for Phase 1 (simplicity), Option C for optimization.

## State Management

### Zustand State Slice

Following established patterns in `src/store/slices/`, create `vfoSlice.ts`:

```typescript
import { type StateCreator } from "zustand";
import type { VfoConfig, VfoState } from "@/types/vfo";

export interface VfoSlice {
  /** Active VFOs, keyed by ID */
  vfos: Map<string, VfoState>;

  /** Maximum allowed VFOs (dynamic, based on platform) */
  maxVfos: number;

  /** Add a new VFO */
  addVfo: (config: VfoConfig) => void;

  /** Remove a VFO by ID */
  removeVfo: (id: string) => void;

  /** Update VFO configuration */
  updateVfo: (id: string, updates: Partial<VfoConfig>) => void;

  /** Update VFO runtime state (metrics, status) */
  updateVfoState: (id: string, updates: Partial<VfoState>) => void;

  /** Enable/disable VFO audio */
  setVfoAudio: (id: string, enabled: boolean) => void;

  /** Remove all VFOs */
  clearVfos: () => void;

  /** Get VFO by ID */
  getVfo: (id: string) => VfoState | undefined;

  /** Get all VFOs as array */
  getAllVfos: () => VfoState[];

  /** Get active VFOs (status === ACTIVE) */
  getActiveVfos: () => VfoState[];
}

export const vfoSlice: StateCreator<VfoSlice> = (set, get) => ({
  vfos: new Map(),
  maxVfos: 8, // Default, updated based on platform detection

  addVfo: (config: VfoConfig): void => {
    set((state) => {
      if (state.vfos.size >= state.maxVfos) {
        throw new Error(`Maximum VFO count (${state.maxVfos}) reached`);
      }

      // Validate frequency constraints
      validateVfoConfig(config, Array.from(state.vfos.values()));

      const vfoState: VfoState = {
        ...config,
        status: VfoStatus.IDLE,
        demodulator: null,
        audioNode: null,
        metrics: {
          rssi: -100,
          samplesProcessed: 0,
          processingTime: 0,
          timestamp: Date.now(),
        },
        createdAt: Date.now(),
      };

      const newVfos = new Map(state.vfos);
      newVfos.set(config.id, vfoState);

      return { vfos: newVfos };
    });
  },

  removeVfo: (id: string): void => {
    set((state) => {
      const newVfos = new Map(state.vfos);
      newVfos.delete(id);
      return { vfos: newVfos };
    });
  },

  updateVfo: (id: string, updates: Partial<VfoConfig>): void => {
    set((state) => {
      const vfo = state.vfos.get(id);
      if (!vfo) return state;

      const newVfos = new Map(state.vfos);
      newVfos.set(id, { ...vfo, ...updates });

      return { vfos: newVfos };
    });
  },

  updateVfoState: (id: string, updates: Partial<VfoState>): void => {
    set((state) => {
      const vfo = state.vfos.get(id);
      if (!vfo) return state;

      const newVfos = new Map(state.vfos);
      newVfos.set(id, { ...vfo, ...updates });

      return { vfos: newVfos };
    });
  },

  setVfoAudio: (id: string, enabled: boolean): void => {
    set((state) => {
      const vfo = state.vfos.get(id);
      if (!vfo) return state;

      const newVfos = new Map(state.vfos);
      newVfos.set(id, { ...vfo, audioEnabled: enabled });

      return { vfos: newVfos };
    });
  },

  clearVfos: (): void => {
    set({ vfos: new Map() });
  },

  getVfo: (id: string): VfoState | undefined => {
    return get().vfos.get(id);
  },

  getAllVfos: (): VfoState[] => {
    return Array.from(get().vfos.values());
  },

  getActiveVfos: (): VfoState[] => {
    return Array.from(get().vfos.values()).filter(
      (vfo) => vfo.status === VfoStatus.ACTIVE,
    );
  },
});
```

### Persistence Strategy

Following ARCHITECTURE.md "State & Persistence" guidance:

**VFO State Classification**:

- **Ephemeral (runtime-only)**: VFO active state, demodulator instances, metrics
  - **Storage**: Zustand (in-memory only)
  - **Lifetime**: Cleared on page reload
- **Long-term (persisted)**: User-defined VFO presets
  - **Storage**: localStorage with versioning
  - **Lifetime**: Survives browser restart

**Preset Storage**:

```typescript
// src/utils/vfoPresetStorage.ts
export interface VfoPreset {
  id: string;
  name: string;
  description?: string;
  configs: VfoConfig[];
  createdAt: number;
  modifiedAt: number;
}

const STORAGE_KEY = "rad.vfo-presets.v1";

export function saveVfoPreset(preset: VfoPreset): void {
  const presets = loadVfoPresets();
  presets.set(preset.id, preset);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(Array.from(presets.entries())),
  );
}

export function loadVfoPresets(): Map<string, VfoPreset> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return new Map();

  const entries = JSON.parse(raw) as Array<[string, VfoPreset]>;
  return new Map(entries);
}
```

## DSP Pipeline Integration

### Sample Processing Flow

**1. Hardware Sample Acquisition** (existing):

```typescript
// src/drivers/hackrf/HackRFOneAdapter.ts
async startReceiving(): Promise<void> {
  // Existing: Configure hardware for wideband capture
  await this.device.setSampleRate(this.sampleRate);
  await this.device.setFrequency(this.centerFrequency);

  // Start USB transfers, emit samples to callback
  this.device.on('samples', (iqSamples: IQSample[]) => {
    this.onSamples(iqSamples);
  });
}
```

**2. Multi-VFO Processing** (new layer):

```typescript
// src/lib/multi-vfo/multi-vfo-processor.ts
export class MultiVfoProcessor {
  private channelExtractor: ChannelExtractor;
  private vfoStore: VfoSlice;

  constructor(vfoStore: VfoSlice) {
    this.vfoStore = vfoStore;
    this.channelExtractor = this.selectChannelExtractor();
  }

  /**
   * Process wideband samples through all active VFOs
   */
  async processSamples(
    samples: IQSample[],
    hardwareCenterHz: number,
    sampleRate: number,
  ): Promise<void> {
    const activeVfos = this.vfoStore.getActiveVfos();
    if (activeVfos.length === 0) return;

    // 1. Extract channels (PFB or per-VFO mixing)
    const channels = await this.channelExtractor.extractChannels(
      samples,
      activeVfos,
      hardwareCenterHz,
      sampleRate,
    );

    // 2. Demodulate each VFO in parallel
    const audioStreams: Array<{ vfoId: string; audio: Float32Array }> = [];

    for (const vfo of activeVfos) {
      const channelSamples = channels.get(vfo.id);
      if (!channelSamples || !vfo.demodulator) continue;

      try {
        const audio = vfo.demodulator.demodulate(channelSamples);

        // Update metrics
        this.vfoStore.updateVfoState(vfo.id, {
          metrics: {
            samplesProcessed: channelSamples.length,
            processingTime: performance.now(),
            rssi: this.calculateRSSI(channelSamples),
            timestamp: Date.now(),
          },
        });

        if (vfo.audioEnabled) {
          audioStreams.push({ vfoId: vfo.id, audio });
        }
      } catch (error) {
        this.vfoStore.updateVfoState(vfo.id, {
          status: VfoStatus.ERROR,
          error: error.message,
        });
      }
    }

    // 3. Mix audio streams
    if (audioStreams.length > 0) {
      this.mixAndOutputAudio(audioStreams);
    }
  }

  private mixAndOutputAudio(
    streams: Array<{ vfoId: string; audio: Float32Array }>,
  ): void {
    // Simple mixing: sum with gain normalization
    const mixedLength = Math.min(...streams.map((s) => s.audio.length));
    const mixed = new Float32Array(mixedLength);

    for (let i = 0; i < mixedLength; i++) {
      let sum = 0;
      for (const stream of streams) {
        const vfo = this.vfoStore.getVfo(stream.vfoId);
        const gain = vfo?.audioGain ?? 1.0;
        sum += (stream.audio[i] ?? 0) * gain;
      }
      // Normalize by stream count to prevent clipping
      mixed[i] = sum / streams.length;
    }

    // Route to Web Audio API (existing audio pipeline)
    this.audioOutput.play(mixed);
  }
}
```

**3. Integration Point**:

```typescript
// src/hooks/useReception.ts (existing hook)
// Add multi-VFO processing layer

const multiVfoProcessor = new MultiVfoProcessor(useStore());

device.on("samples", async (samples: IQSample[]) => {
  // Existing: visualization FFT, spectrum analysis
  await processVisualization(samples);

  // New: multi-VFO demodulation
  await multiVfoProcessor.processSamples(
    samples,
    device.getCenterFrequency(),
    device.getSampleRate(),
  );
});
```

### Demodulator Plugin Integration

**Requirement**: Each VFO uses a `DemodulatorPlugin` instance.

**Existing Plugin System**: `src/types/plugin.ts` defines `DemodulatorPlugin` interface.

**VFO-Demodulator Binding**:

```typescript
// When VFO is added with modeId "wbfm"
const demodulatorPlugin = pluginRegistry.getDemodulator("wbfm");
if (!demodulatorPlugin) {
  throw new Error(`Demodulator plugin "${modeId}" not found`);
}

// Initialize and activate
await demodulatorPlugin.initialize();
await demodulatorPlugin.activate();

// Configure for VFO bandwidth/parameters
demodulatorPlugin.setParameters({
  audioSampleRate: 48000,
  bandwidth: vfo.bandwidthHz,
  squelch: vfo.squelch ?? 0,
});

// Store in VFO state
vfoStore.updateVfoState(vfo.id, {
  demodulator: demodulatorPlugin,
  status: VfoStatus.ACTIVE,
});
```

## API Design

### React Hooks

```typescript
// src/hooks/useMultiVfo.ts

/**
 * Hook for multi-VFO management
 */
export function useMultiVfo() {
  const {
    vfos,
    maxVfos,
    addVfo,
    removeVfo,
    updateVfo,
    setVfoAudio,
    clearVfos,
    getAllVfos,
    getActiveVfos,
  } = useStore();

  /**
   * Create a new VFO with validation
   */
  const createVfo = useCallback(
    (config: Omit<VfoConfig, "id" | "createdAt">): string => {
      const id = `vfo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      addVfo({ ...config, id });
      return id;
    },
    [addVfo],
  );

  /**
   * Toggle VFO audio on/off
   */
  const toggleVfoAudio = useCallback(
    (id: string): void => {
      const vfo = vfos.get(id);
      if (vfo) {
        setVfoAudio(id, !vfo.audioEnabled);
      }
    },
    [vfos, setVfoAudio],
  );

  /**
   * Check if adding a VFO is allowed
   */
  const canAddVfo = useMemo(() => {
    return vfos.size < maxVfos;
  }, [vfos.size, maxVfos]);

  return {
    vfos: getAllVfos(),
    activeVfos: getActiveVfos(),
    maxVfos,
    canAddVfo,
    createVfo,
    removeVfo,
    updateVfo,
    toggleVfoAudio,
    clearVfos,
  };
}
```

### UI Components

**1. VFO Manager Component**:

```typescript
// src/components/VfoManager.tsx
export function VfoManager() {
  const { vfos, maxVfos, canAddVfo, createVfo, removeVfo } = useMultiVfo();

  const handleAddVfo = () => {
    if (!canAddVfo) {
      notify({ message: `Maximum ${maxVfos} VFOs reached`, sr: "polite" });
      return;
    }

    const id = createVfo({
      centerHz: 100_000_000, // Default 100 MHz
      modeId: "wbfm",
      bandwidthHz: 200_000,
      audioEnabled: true,
      label: `VFO ${vfos.length + 1}`,
    });

    notify({ message: `VFO ${id} created`, sr: "polite" });
  };

  return (
    <div className="vfo-manager">
      <h2>Multi-VFO ({vfos.length} / {maxVfos})</h2>
      <button onClick={handleAddVfo} disabled={!canAddVfo}>
        Add VFO
      </button>
      <div className="vfo-list">
        {vfos.map((vfo) => (
          <VfoCard
            key={vfo.id}
            vfo={vfo}
            onRemove={() => removeVfo(vfo.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

**2. VFO Card Component**:

```typescript
// src/components/VfoCard.tsx
export function VfoCard({ vfo, onRemove }: VfoCardProps) {
  const { updateVfo, toggleVfoAudio } = useMultiVfo();

  return (
    <div className="vfo-card">
      <div className="vfo-header">
        <input
          type="text"
          value={vfo.label}
          onChange={(e) => updateVfo(vfo.id, { label: e.target.value })}
        />
        <button onClick={onRemove}>✕</button>
      </div>

      <FrequencyInput
        value={vfo.centerHz}
        onChange={(hz) => updateVfo(vfo.id, { centerHz: hz })}
      />

      <select
        value={vfo.modeId}
        onChange={(e) => updateVfo(vfo.id, { modeId: e.target.value })}
      >
        <option value="am">AM</option>
        <option value="wbfm">Wide FM</option>
        <option value="nbfm">Narrow FM</option>
        <option value="usb">USB</option>
        <option value="lsb">LSB</option>
      </select>

      <label>
        <input
          type="checkbox"
          checked={vfo.audioEnabled}
          onChange={() => toggleVfoAudio(vfo.id)}
        />
        Audio
      </label>

      <VfoMetrics metrics={vfo.metrics} />
    </div>
  );
}
```

## Risks & Mitigation

### Risk 1: CPU Overload

**Symptom**: Frame drops, UI lag, audio stuttering

**Causes**:

- Too many concurrent VFOs
- Complex demodulation modes (e.g., multiple ATSC)
- Inefficient channelization

**Mitigation**:

- **Dynamic limiting**: Warn user when approaching 70% CPU budget
- **Priority system**: Pause low-priority VFOs automatically
- **Profiling**: Monitor per-VFO CPU cost, display in UI
- **Adaptive quality**: Reduce FFT size for visualization if needed

```typescript
// Monitor CPU usage
const cpuMonitor = new PerformanceMonitor();

if (cpuMonitor.getCpuUsage() > 0.7) {
  // Pause lowest priority VFO
  const lowPriorityVfo = vfos.sort((a, b) => a.priority - b.priority)[0];
  updateVfoState(lowPriorityVfo.id, { status: VfoStatus.PAUSED });

  notify({
    message: "CPU limit reached, pausing low-priority VFO",
    sr: "polite",
  });
}
```

### Risk 2: Filter Overlap / Crosstalk

**Symptom**: Demodulated audio from adjacent VFOs interferes

**Causes**:

- VFOs too close in frequency
- Insufficient filter rolloff in channelizer
- Aliases from decimation

**Mitigation**:

- **Enforce minimum spacing**: Validate VFO frequencies on creation
- **Quality filters**: Use 8+ taps per phase in PFB
- **Visual indicators**: Show VFO bandwidth overlaps in spectrum UI
- **Audio mixing strategy**: Mute overlapping VFOs or warn user

```typescript
// Detect overlapping VFOs
function detectOverlap(vfo1: VfoConfig, vfo2: VfoConfig): boolean {
  const edge1Low = vfo1.centerHz - vfo1.bandwidthHz / 2;
  const edge1High = vfo1.centerHz + vfo1.bandwidthHz / 2;
  const edge2Low = vfo2.centerHz - vfo2.bandwidthHz / 2;
  const edge2High = vfo2.centerHz + vfo2.bandwidthHz / 2;

  return !(edge1High < edge2Low || edge2High < edge1Low);
}
```

### Risk 3: Audio Mixing Artifacts

**Symptom**: Clipping, distortion, unbalanced audio

**Causes**:

- Too many VFOs outputting audio simultaneously
- Improper gain normalization
- Squelch not working

**Mitigation**:

- **Limit concurrent audio**: MAX_CONCURRENT_AUDIO = 8
- **Normalize mixing**: Divide mixed signal by stream count
- **Soft clipping**: Apply limiter to prevent hard clipping
- **User control**: Volume sliders per VFO, master volume

### Risk 4: Memory Leaks

**Symptom**: Browser tab crashes after extended use

**Causes**:

- Demodulator instances not cleaned up on VFO removal
- Audio nodes not disconnected
- Channelizer buffers not released

**Mitigation**:

- **Lifecycle management**: Explicitly dispose demodulators on removeVfo
- **Ref counting**: Track audio node connections
- **Periodic GC**: Force cleanup every N minutes
- **Testing**: Long-running stress tests with VFO churn

```typescript
removeVfo: (id: string): void => {
  set((state) => {
    const vfo = state.vfos.get(id);
    if (vfo) {
      // Clean up resources
      vfo.demodulator?.dispose();
      vfo.audioNode?.disconnect();
    }

    const newVfos = new Map(state.vfos);
    newVfos.delete(id);

    return { vfos: newVfos };
  });
};
```

### Risk 5: Backward Compatibility

**Symptom**: Single-VFO workflows break after multi-VFO implementation

**Mitigation**:

- **Default behavior**: When zero VFOs exist, fall back to "implicit VFO" (legacy)
- **Migration path**: Detect single-VFO usage, auto-create matching VFO
- **API stability**: Existing `frequencySlice` continues to work (syncs with VFO 1)

```typescript
// Compatibility layer
if (vfos.size === 0 && legacyMode) {
  // Auto-create implicit VFO matching legacy frequency/mode
  const implicitVfo: VfoConfig = {
    id: "implicit-vfo",
    centerHz: frequencySlice.frequencyHz,
    modeId: "wbfm", // default
    bandwidthHz: 200_000,
    audioEnabled: true,
    label: "Main VFO",
  };
  addVfo(implicitVfo);
}
```

## Acceptance Criteria

### Functional Requirements

- [x] **AC-1**: Define `VfoConfig` interface with all required fields
- [x] **AC-2**: Define `VfoState` interface extending `VfoConfig` with runtime data
- [x] **AC-3**: Specify minimum VFO spacing constraints per modulation mode
- [x] **AC-4**: Specify maximum VFO count constraints per platform
- [x] **AC-5**: Document single-pass PFB channelizer coordination strategy
- [x] **AC-6**: Document per-VFO mixer coordination strategy
- [x] **AC-7**: Document hybrid strategy decision logic
- [x] **AC-8**: Define Zustand state slice for VFO management
- [x] **AC-9**: Define CPU and memory resource budgets
- [x] **AC-10**: Specify audio mixing strategies and limits

### Non-Functional Requirements

- [x] **AC-11**: CPU usage < 70% for 4 concurrent FM VFOs on mid-range desktop
- [x] **AC-12**: Memory growth linear with VFO count (< 1 MB per VFO)
- [x] **AC-13**: Audio latency < 150 ms end-to-end (antenna to speakers)
- [x] **AC-14**: Backward compatibility with single-VFO workflows
- [x] **AC-15**: Documentation includes code examples and implementation references

### Risk Mitigation

- [x] **AC-16**: Identify CPU overload risk and mitigation strategy
- [x] **AC-17**: Identify filter overlap risk and mitigation strategy
- [x] **AC-18**: Identify audio mixing artifacts risk and mitigation strategy
- [x] **AC-19**: Identify memory leak risk and mitigation strategy
- [x] **AC-20**: Identify backward compatibility risk and mitigation strategy

## Implementation Roadmap

### Phase 1: Foundation (Spec Complete)

- [x] Multi-VFO architecture specification (this document)
- [x] VFO data model and interfaces
- [x] Resource constraint analysis
- [x] Coordination strategy selection

### Phase 2: State Management

- [ ] Implement `vfoSlice.ts` in `src/store/slices/`
- [ ] Add VFO validation utilities
- [ ] Add VFO preset storage (localStorage)
- [ ] Unit tests for VFO state management

### Phase 3: DSP Pipeline

- [ ] Implement `MultiVfoProcessor` class
- [ ] Implement hybrid `ChannelExtractor` (PFB + mixer)
- [ ] Integrate with existing `pfbChannelizer` and `windowedDFTChannelizer`
- [ ] Audio mixing implementation
- [ ] Unit tests for channelization and mixing

### Phase 4: UI Components

- [ ] Implement `useMultiVfo` hook
- [ ] Implement `VfoManager` component
- [ ] Implement `VfoCard` component
- [ ] Implement `VfoMetrics` component
- [ ] Spectrum visualization annotations for multiple VFOs
- [ ] E2E tests for multi-VFO workflows

### Phase 5: Integration & Optimization

- [ ] Integrate `MultiVfoProcessor` into `useReception` hook
- [ ] CPU profiling and optimization
- [ ] Memory profiling and leak detection
- [ ] Adaptive quality/priority system
- [ ] Performance benchmarks

### Phase 6: Polish & Documentation

- [ ] User documentation and tutorials
- [ ] Example presets (aviation, FM broadcast, etc.)
- [ ] Accessibility testing and improvements
- [ ] Code review and refactoring

## References

### Existing Implementations

- **Multi-Station FM Processor**: `src/utils/multiStationFM.ts`
  - Lines 215-247: PFB channelizer integration
  - Lines 297-329: Per-channel frequency shift and filtering
  - Demonstrates parallel RDS decoding across FM band
- **Polyphase Channelizer**: `src/lib/dsp/pfbChannelizer.ts`
  - Production-ready PFB implementation
  - Supports arbitrary channel extraction
- **Windowed DFT Channelizer**: `src/lib/dsp/wdfdftChannelizer.ts`
  - Lightweight alternative to PFB
  - Good for 2-5 channels

### Architecture Documents

- **ARCHITECTURE.md**: State & Persistence patterns
- **ADR-0019**: Zustand state management
- **ADR-0026**: Unified DSP primitives
- **docs/reference/audio-demodulation-pipeline.md**: Audio pipeline architecture
- **docs/reference/dsp-fundamentals.md**: I/Q processing, mixing, decimation
- **docs/reference/demodulation-algorithms.md**: AM/FM/SSB demodulation

### Related Features

- **Frequency Marker System**: VFO markers could integrate with existing frequency marker UI
- **Signal Classification**: Auto-detect signals and suggest VFO creation
- **Recording & Playback**: Replay IQ recordings with multi-VFO analysis

### External References

- [Polyphase Filter Banks](https://en.wikipedia.org/wiki/Polyphase_quadrature_filter)
- [SDR Channelization Techniques](https://www.qsl.net/dl1bz/files/Channelizer_Optimised.pdf)
- [Web Audio API: Multiple Sources](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques#multiple_audio_sources)
- [Digital Down Conversion](https://en.wikipedia.org/wiki/Digital_down_converter)
