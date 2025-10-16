# Recording and Playback Feature

## Overview

The recording and playback feature allows users to capture IQ samples from SDR devices and play them back later for offline analysis. This is useful for:

- **Signal Analysis**: Record signals for detailed offline analysis
- **Sharing Data**: Share recordings with others for collaborative analysis
- **Testing**: Use recorded signals for testing DSP algorithms
- **Training**: Create reference signals for educational purposes

## Features

### Recording

- **Start/Stop Recording**: Simple controls to start and stop recording IQ samples
- **Real-time Monitoring**: Live display of recording duration and sample count
- **Metadata Tracking**: Automatically captures frequency, sample rate, and timestamp
- **Download**: Export recordings as JSON files with all metadata

### Playback

- **File Loading**: Load previously recorded JSON files
- **Playback Controls**: Standard play, pause, and stop controls
- **Seek Capability**: Jump to any position in the recording
- **Speed Control**: Adjust playback speed (0.5x, 1x, 2x, 4x)
- **Progress Indicator**: Visual progress bar and time display

## Usage

### Recording IQ Samples

1. **Connect Device**: Click "Connect Device" to connect your SDR hardware
2. **Start Reception**: Click "Start Reception" to begin receiving signals
3. **Configure Frequency**: Set your desired frequency using the radio controls
4. **Start Recording**: Click "Start Recording" in the Recording & Playback section
5. **Monitor Progress**: Watch the real-time duration and sample count
6. **Stop Recording**: Click "Stop Recording" when finished
7. **Download**: Click "Download" to save the recording as a JSON file

### Playing Back Recordings

1. **Load Recording**: Click "Load Recording" and select a JSON file
2. **Review Metadata**: Check the frequency, sample rate, and duration
3. **Start Playback**: Click "Play" to start playback
4. **Control Playback**: Use pause/stop buttons as needed
5. **Adjust Speed**: Select playback speed from the dropdown
6. **Seek Position**: Drag the progress slider to jump to any position
7. **Close**: Click "Close" to exit playback mode and return to live reception

## File Format

Recordings are saved in JSON format with the following structure:

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2025-10-16T12:34:56.789Z",
    "frequency": 100300000,
    "sampleRate": 20000000,
    "duration": 5.0,
    "sampleCount": 100000000,
    "description": "Optional description"
  },
  "samples": [
    { "I": 0.123, "Q": -0.456 },
    { "I": 0.234, "Q": -0.345 },
    ...
  ]
}
```

### Metadata Fields

- **version**: Recording format version (currently "1.0")
- **timestamp**: ISO 8601 timestamp when recording started
- **frequency**: Center frequency in Hz
- **sampleRate**: Sample rate in Hz (samples per second)
- **duration**: Total recording duration in seconds
- **sampleCount**: Total number of IQ samples
- **description**: Optional user-provided description

### Sample Format

Each sample is an object with two fields:
- **I**: In-phase component (normalized -1.0 to 1.0)
- **Q**: Quadrature component (normalized -1.0 to 1.0)

## Implementation Details

### RecordingManager

The `RecordingManager` class handles recording operations:

```typescript
import { RecordingManager } from './utils/recordingManager';

const manager = new RecordingManager();

// Start recording
manager.startRecording(frequency, sampleRate, "My recording");

// Add samples during reception
device.receive((samples) => {
  manager.addSamples(samples);
});

// Stop and export
manager.stopRecording();
const blob = manager.exportAsBlob();
```

### PlaybackManager

The `PlaybackManager` class handles playback operations:

```typescript
import { PlaybackManager } from './utils/playbackManager';

const manager = new PlaybackManager({
  chunkSize: 1024,  // Samples per callback
  speed: 1.0,       // Playback speed multiplier
  loop: false       // Loop playback
});

// Load recording
await manager.loadFromFile(file);

// Start playback
manager.startPlayback((samples) => {
  // Process samples (same as live reception)
});

// Control playback
manager.pausePlayback();
manager.resumePlayback();
manager.stopPlayback();
manager.seek(0.5); // Jump to 50% position
```

## Best Practices

### Recording

- **Limit Duration**: Be mindful of file size - recordings grow quickly at high sample rates
- **Note Frequency**: Always note the frequency and conditions when recording
- **Use Descriptions**: Add meaningful descriptions to recordings for future reference
- **Monitor Storage**: Check available disk space before long recordings

### Playback

- **Verify Metadata**: Always check metadata before playback to ensure compatibility
- **Start Slow**: Begin with 1x speed and adjust as needed
- **Use Seek**: Use the seek slider for quick navigation through long recordings
- **Close When Done**: Exit playback mode to return to live reception

## Limitations

- **File Size**: Large recordings can consume significant disk space
- **Browser Memory**: Very large files may exceed browser memory limits
- **Real-time Only**: Playback simulates real-time streaming (cannot process faster than speed multiplier allows)
- **JSON Format**: JSON is human-readable but less space-efficient than binary formats

## Future Enhancements

Potential improvements for future versions:

- **Binary Format**: More space-efficient format option
- **Compression**: Built-in compression for smaller file sizes
- **Streaming Playback**: Stream large files without loading entirely into memory
- **Audio Recording**: Option to record demodulated audio instead of IQ samples
- **Annotations**: Add time-stamped annotations to recordings
- **Batch Processing**: Process multiple recordings automatically

## Troubleshooting

### Recording Issues

**Problem**: "Start Recording" button is disabled
- **Solution**: Ensure device is connected and reception is active

**Problem**: Recording shows 0 samples
- **Solution**: Check that device is actually receiving data (check visualizations)

### Playback Issues

**Problem**: File fails to load
- **Solution**: Verify JSON format is valid and contains required metadata fields

**Problem**: Playback is choppy
- **Solution**: Try reducing playback speed or closing other browser tabs

**Problem**: Can't switch back to live mode
- **Solution**: Click "Close" button in playback controls section

## API Reference

See the following files for detailed API documentation:

- `src/utils/recordingManager.ts` - Recording functionality
- `src/utils/playbackManager.ts` - Playback functionality
- `src/components/RecordingControls.tsx` - Recording UI component
- `src/components/PlaybackControls.tsx` - Playback UI component

## Testing

The recording and playback features include comprehensive test coverage:

- **Recording Manager**: 18 tests covering lifecycle, sample recording, export
- **Playback Manager**: 29 tests covering loading, playback control, streaming
- **Total Coverage**: 47 tests with >93% code coverage

Run tests with:
```bash
npm test -- src/utils/__tests__/recordingManager.test.ts
npm test -- src/utils/__tests__/playbackManager.test.ts
```
