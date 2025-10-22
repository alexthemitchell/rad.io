# Recording and Playback Feature Implementation

## Overview
Implemented comprehensive IQ data recording and playback functionality for rad.io SDR visualizer. Users can now capture live signals to files and replay them later for offline analysis.

## Key Components

### 1. IQRecorder Utility (`src/utils/iqRecorder.ts`)
- **IQRecorder class**: Manages live sample capture with configurable buffer limits
- **IQPlayback class**: Handles playback timing, seeking, and chunk delivery
- **File formats**:
  - Binary (.iq): Efficient 8 bytes/sample (metadata length + JSON metadata + Float32 I/Q pairs)
  - JSON (.json): Human-readable for debugging
- **Features**: Auto-stop at buffer limit, duration calculation, metadata preservation

### 2. RecordingControls Component (`src/components/RecordingControls.tsx`)
- **Recording UI**: Start/stop button with pulsing indicator, duration/sample count display
- **Save dialog**: Filename input, format selection (binary/JSON)
- **Load**: File picker supporting .iq and .json files
- **Playback UI**: Play/pause/stop controls, progress bar with seeking, time display
- **Accessibility**: Proper ARIA labels, keyboard navigation, screen reader announcements

### 3. Visualizer Integration (`src/pages/Visualizer.tsx`)
- **State management**: RecordingState enum (idle/recording/playback)
- **Recording flow**: Hooks into `handleSampleChunk` → accumulates in IQRecorder → updates stats
- **Playback flow**: Loads file → creates IQPlayback controller → feeds chunks to visualization pipeline
- **Mode switching**: Clean transitions between live and playback modes

## Usage Pattern

```typescript
// Recording
const recorder = new IQRecorder(sampleRate, frequency, maxSamples);
recorder.start();
recorder.addSamples(iqSamples); // Called per chunk
const recording = recorder.getRecording();

// Save
downloadRecording(recording, "my-signal", "binary");

// Load & Playback
const recording = await loadRecordingFromFile(file);
const playback = new IQPlayback(recording, chunkCallback, samplesPerChunk);
playback.start();
playback.seek(0.5); // Jump to 50%
playback.stop();
```

## Testing
- 24 IQRecorder unit tests (recording, export/import, playback)
- 22 RecordingControls component tests (UI interactions, state management)
- All tests passing (464 total)

## File Format Details

**Binary .iq structure:**
```
[4 bytes: metadata length (uint32)]
[N bytes: metadata JSON]
[8*samples bytes: I/Q pairs as Float32]
```

**JSON structure:**
```json
{
  "metadata": {
    "timestamp": "ISO8601",
    "frequency": number,
    "sampleRate": number,
    "signalType": "FM|AM",
    "deviceName": string,
    "sampleCount": number,
    "duration": number
  },
  "samples": [{"I": float, "Q": float}, ...]
}
```

## Known Limitations
- Max buffer: 10M samples (~5 seconds at 2 MSPS) to prevent memory issues
- Binary format uses Float32 (not optimized compression)
- Playback timing uses setInterval (not sample-accurate, but sufficient for visualization)

## Future Enhancements
- Compression support (e.g., gzip)
- Streaming record (write to disk during capture)
- Multiple file format support (SigMF, GNU Radio)
- Playback speed control
- Segment/loop playback

## Related Files
- `src/utils/iqRecorder.ts` - Core recording/playback logic
- `src/components/RecordingControls.tsx` - UI component
- `src/pages/Visualizer.tsx` - Integration point
- `src/utils/__tests__/iqRecorder.test.ts` - Unit tests
- `src/components/__tests__/RecordingControls.test.tsx` - Component tests
