# Signal Decoder Architecture for Digital Modes

- Status: accepted
- Date: 2024-01-XX
- Deciders: Development Team
- Technical Story: Implement interactive signal decoders for RTTY, PSK31, and SSTV modes

## Context and Problem Statement

WebSDR Pro needs to support decoding of popular digital communication modes including RTTY (radioteletype), PSK31 (phase shift keying), and SSTV (slow-scan television). These modes require different decoding algorithms, configuration parameters, and output formats. How should we architect the decoder system to be extensible, performant, and user-friendly?

## Decision Drivers

- **Mode Diversity**: Each digital mode has unique characteristics (RTTY uses frequency shift keying, PSK31 uses phase modulation, SSTV transmits images)
- **Real-time Performance**: Decoders must process audio streams with minimal latency (<200ms)
- **User Experience**: Configuration should be accessible to both beginners (presets) and experts (fine-tuning)
- **Extensibility**: Architecture should allow adding new modes (BPSK, QPSK, FT8, etc.) without major refactoring
- **Output Handling**: Text modes output character streams; SSTV outputs image data requiring different UI treatment
- **Resource Efficiency**: Decoders should run in the main thread initially but be movable to Web Workers if needed

## Considered Options

### Option 1: Unified Decoder Class with Mode Parameter

Single `SignalDecoder` class with mode switching logic internally.

**Pros:**

- Simple API
- Easy to initialize

**Cons:**

- Violates single responsibility principle
- Complex internal branching
- Difficult to optimize per-mode
- Hard to add new modes

### Option 2: Individual Decoder Classes with Common Interface

Separate decoder classes (`RTTYDecoder`, `PSK31Decoder`, `SSTVDecoder`) implementing a common interface.

**Pros:**

- Clean separation of concerns
- Easy to understand and test each decoder
- Mode-specific optimizations
- Extensible - new modes are new classes
- Can evolve independently

**Cons:**

- More code duplication for common functionality
- Need factory pattern or manual instantiation

### Option 3: Web Worker-Based Decoder Pool

Each decoder runs in a dedicated Web Worker with message passing.

**Pros:**

- No main thread blocking
- True parallel processing for multiple signals
- Better performance on multi-core systems

**Cons:**

- Complex architecture
- Message passing overhead
- Cannot access DOM (problematic for SSTV canvas rendering)
- Premature optimization

## Decision Outcome

**Chosen option: "Option 2: Individual Decoder Classes with Common Interface"**

We implement separate decoder classes for each mode with a React component that manages them. This provides the best balance of code clarity, extensibility, and performance.

### Architecture Details

**Decoder Classes:**

```typescript
class RTTYDecoder {
  decode(samples: Float32Array): string;
  updateConfig(config: Partial<RTTYConfig>): void;
}

class PSK31Decoder {
  decode(iqSamples: { i: Float32Array; q: Float32Array }): string;
  updateConfig(config: Partial<PSK31Config>): void;
}

class SSTVDecoder {
  decode(audioSamples: Float32Array): { imageData; progress; width; height };
  reset(): void;
  getImageData(): ImageData | null;
  updateConfig(config: Partial<SSTVConfig>): void;
}
```

**React Component Structure:**

- Single `<SignalDecoder>` component with tabbed interface
- Tab per mode (RTTY, PSK31, SSTV)
- Mode-specific configuration panels
- Shared output controls (copy, save, clear)
- Text modes use ScrollArea with monospace output
- SSTV mode uses canvas for image rendering

**Configuration Management:**

- Preset configurations for common scenarios
- Expert mode for manual parameter adjustment
- Real-time config updates via `updateConfig()` methods

### Consequences

**Good:**

- Clear code organization - each mode is self-contained
- Easy to test decoders in isolation
- Simple to add new modes (implement new class, add tab)
- Can optimize per-mode without affecting others
- Mode-specific features (e.g., SSTV image saving) naturally fit

**Bad:**

- Some code duplication in decoder boilerplate
- Must manage multiple decoder instances in React component
- Each decoder maintains its own state

**Neutral:**

- Decoders run in main thread (acceptable for initial implementation)
- Can be migrated to Web Workers later if profiling shows need

## Implementation Notes

### RTTY Decoder

- **Algorithm**: Frequency shift detection via tone comparison
- **Baudot Code**: 5-bit character encoding with LTRS/FIGS shift codes
- **Key Parameters**: Baud rate (45.45, 50), shift (170, 850 Hz), reverse polarity
- **Presets**: Standard 45.45, Standard 50, US Weather 45

### PSK31 Decoder

- **Algorithm**: Phase-shift detection via IQ sample analysis
- **Varicode**: Variable-length character encoding optimized for common letters
- **Key Parameters**: Symbol rate (31.25, 62.5, 125), AFC enable, squelch level
- **Modes**: PSK31, PSK63, PSK125

### SSTV Decoder

- **Algorithm**: Frequency-to-brightness mapping (1500Hz = black, 2300Hz = white)
- **Sync Detection**: 1200Hz tone indicates line sync
- **Key Parameters**: Mode (Martin M1/M2, Scottie S1/S2, Robot 36), autostart
- **Output**: Progressive image reconstruction on canvas

### Future Enhancements

- **Web Worker Migration**: Profile and move to workers if main thread impact detected
- **Additional Modes**: FT8, WSPR, Hellschreiber, APRS packet decoding
- **Advanced Features**: AFC implementation, SNR calculation, constellation diagrams
- **Recording**: Capture decoded text/images to persistent storage
- **Analysis**: Character statistics, signal quality metrics

## Links

- [RTTY Technical Details](https://en.wikipedia.org/wiki/Radioteletype)
- [PSK31 Specification](http://www.arrl.org/psk31-spec)
- [SSTV Modes](https://www.sstvelectronics.com/info/modes.php)
- [Varicode Table](http://www.arrl.org/psk31-spec)
- [ADR-004: Web Worker DSP Architecture](./0004-web-worker-dsp-architecture.md)
