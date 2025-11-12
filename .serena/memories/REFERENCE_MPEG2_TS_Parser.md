# MPEG-2 Transport Stream Parser Implementation

## Overview

Implemented comprehensive MPEG-2 Transport Stream parser for ATSC digital television in `src/parsers/TransportStreamParser.ts`. Provides complete PSI/PSIP table parsing with integration support for ATSC demodulator.

## Key Components

### Core Parser (`TransportStreamParser` class)

- **Packet Sync**: Automatic 0x47 sync byte detection with loss recovery
- **Header Parsing**: Extracts PID, continuity counter, adaptation fields, PCR
- **Continuity Validation**: Detects packet loss via counter tracking
- **Stream Demux**: Filter/extract payloads by PID

### PSI Tables

- **PAT** (PID 0x0000): Maps program numbers → PMT PIDs
- **PMT**: Lists elementary streams (video/audio) with PIDs and types
- **Descriptors**: Generic parsing for extensibility

### PSIP Tables

- **MGT** (PID 0x1FFB): Master table directory
- **VCT**: Channel guide (TVCT/CVCT for terrestrial/cable)
- **EIT**: Event schedule/program guide
- **ETT**: Extended program descriptions

### Stream Detection

- `getVideoPIDs()`: Returns video stream PIDs for program
- `getAudioPIDs()`: Returns audio stream PIDs for program
- `getElementaryStreams()`: Maps stream types → PIDs
- Supports: MPEG-2, H.264, H.265, AAC, AC-3, etc.

## Usage Pattern

```typescript
const parser = new TransportStreamParser();
const packets = parser.parseStream(tsData);

// Get program info
const pat = parser.getPAT();
const pmt = parser.getPMT(programNumber);

// Get streams
const videoPIDs = parser.getVideoPIDs(programNumber);
const audioPIDs = parser.getAudioPIDs(programNumber);

// Demultiplex
const videoPayloads = parser.demultiplex(packets, videoPID);

// Get guide data
const vct = parser.getVCT();
const eit = parser.getEIT(sourceid);
```

## Integration with ATSC Demodulator

Works with `ATSC8VSBDemodulator` to process complete broadcast pipeline:

1. Demodulator outputs symbols
2. Apply FEC/trellis decoding (not yet implemented)
3. Parser extracts tables and streams
4. UI displays program guide and plays A/V

## Error Handling

- Sync loss → automatic recovery by searching for 0x47
- Corrupted packets → validation without throwing
- Incomplete sections → gracefully ignored
- Continuity errors → tracked but non-fatal

## Testing

- 23 unit tests covering all major functionality
- Tests include PAT/PMT parsing, sync recovery, PID filtering, demux
- All tests passing with comprehensive coverage

## Code Quality Notes

- TypeScript strict mode, no `any` types
- No non-null assertions (all replaced with `?? 0` patterns)
- Exhaustive switch statements for enum matching
- Proper operator precedence for bitwise ops with nullish coalescing
- Numeric object keys require switch statements (linting rule)

## Future Enhancements

- CRC-32 validation
- Multi-packet section reassembly
- Descriptor-specific parsing (caption, language, etc.)
- ATSC 3.0 support (ROUTE/DASH)

## Files

- `src/parsers/TransportStreamParser.ts` - Main implementation
- `src/parsers/__tests__/TransportStreamParser.test.ts` - Tests
- `src/parsers/TransportStreamParser.examples.ts` - Integration examples
- `src/parsers/index.ts` - Exports
