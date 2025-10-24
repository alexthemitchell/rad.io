# Web Speech API Integration

This module provides browser-native speech recognition capabilities for transcribing demodulated radio communications. It integrates seamlessly with the Audio Stream Extraction API to convert radio signals into text in near-real time.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Browser Compatibility](#browser-compatibility)
- [Limitations](#limitations)
- [Error Handling](#error-handling)
- [Testing](#testing)

## Overview

The Web Speech API Integration enables automatic transcription of voice communications received through SDR devices. It provides:

- ✅ **Browser-native API** - No external dependencies or API keys required
- ✅ **Near-real time transcription** - Low latency for live monitoring
- ✅ **Robust error handling** - Gracefully handles noisy/distorted audio
- ✅ **Multiple languages** - Support for various language codes
- ✅ **Confidence scoring** - Quality metrics for each transcription
- ✅ **Continuous mode** - Stream processing for ongoing communications
- ✅ **Interim results** - Real-time partial transcriptions

**Key Use Cases:**

- Transcribing public safety radio communications
- Monitoring aviation communications
- Amateur radio voice logging
- Emergency broadcast transcription
- Multi-language radio monitoring

## Architecture

### Signal Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                  SPEECH RECOGNITION PIPELINE                     │
└─────────────────────────────────────────────────────────────────┘

1. SDR Hardware (Radio signal reception)
   ↓
2. IQ Samples (Raw complex baseband data)
   ↓
3. Audio Stream Processor (Demodulation: FM/AM)
   ↓
4. AudioStreamResult (Clean audio at 16-48kHz)
   ↓
5. MediaStream (Web Audio API format conversion)
   ↓
6. SpeechRecognition (Web Speech API)
   ↓
7. Transcription (Text output with confidence score)
```

### Integration Points

```typescript
// Complete integration example
import { AudioStreamProcessor, DemodulationType } from "./utils/audioStream";
import { SpeechRecognitionProcessor } from "./utils/speechRecognition";

// 1. Setup audio processing
const audioProcessor = new AudioStreamProcessor(2048000); // 2.048 MHz SDR rate

// 2. Setup speech recognition
const recognizer = new SpeechRecognitionProcessor({
  lang: "en-US",
  continuous: true,
  interimResults: true,
});

// 3. Process SDR data
device.receive(async (dataView) => {
  // Convert IQ samples to audio
  const iqSamples = device.parseSamples(dataView);
  const audioResult = await audioProcessor.extractAudio(
    iqSamples,
    DemodulationType.FM,
    { sampleRate: 16000 }, // Optimal for speech recognition
  );

  // Transcribe audio
  await recognizer.recognizeFromAudioStream(audioResult);
});
```

## API Reference

### Types

#### `SpeechRecognitionConfig`

Configuration for speech recognition.

```typescript
type SpeechRecognitionConfig = {
  /** Language for recognition (default: 'en-US') */
  lang?: string;
  /** Enable continuous recognition (default: false) */
  continuous?: boolean;
  /** Return interim results while speaking (default: true) */
  interimResults?: boolean;
  /** Maximum number of alternative transcriptions (default: 1) */
  maxAlternatives?: number;
};
```

**Language Codes:**

- `'en-US'` - English (United States)
- `'en-GB'` - English (United Kingdom)
- `'es-ES'` - Spanish (Spain)
- `'fr-FR'` - French (France)
- `'de-DE'` - German (Germany)
- `'ja-JP'` - Japanese (Japan)
- `'zh-CN'` - Chinese (China)
- `'it-IT'` - Italian (Italy)
- `'pt-BR'` - Portuguese (Brazil)
- [And many more...](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/lang)

#### `SpeechRecognitionResult`

A recognition result with transcription and metadata.

```typescript
type SpeechRecognitionResult = {
  /** Array of alternative transcriptions (ordered by confidence) */
  alternatives: SpeechRecognitionAlternative[];
  /** Whether this is a final result (true) or interim (false) */
  isFinal: boolean;
  /** Timestamp when result was generated */
  timestamp: number;
};
```

#### `SpeechRecognitionAlternative`

Individual transcription alternative with confidence score.

```typescript
type SpeechRecognitionAlternative = {
  /** Transcribed text */
  transcript: string;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
};
```

#### `SpeechRecognitionError`

Error information from speech recognition.

```typescript
type SpeechRecognitionError = {
  /** Error code */
  error: SpeechRecognitionErrorCode;
  /** Error message */
  message: string;
  /** Timestamp when error occurred */
  timestamp: number;
};
```

#### `SpeechRecognitionErrorCode`

Enumeration of possible error codes.

```typescript
enum SpeechRecognitionErrorCode {
  NO_SPEECH = "no-speech", // No speech detected
  ABORTED = "aborted", // Recognition aborted
  AUDIO_CAPTURE = "audio-capture", // Audio capture failed
  NETWORK = "network", // Network error
  NOT_ALLOWED = "not-allowed", // Permission denied
  SERVICE_NOT_ALLOWED = "service-not-allowed",
  BAD_GRAMMAR = "bad-grammar",
  LANGUAGE_NOT_SUPPORTED = "language-not-supported",
  NOT_SUPPORTED = "not-supported",
}
```

### Classes

#### `SpeechRecognitionProcessor`

Main class for performing speech recognition on demodulated audio.

**Constructor:**

```typescript
constructor(config?: SpeechRecognitionConfig)
```

**Methods:**

##### `recognizeFromAudioStream()`

Recognize speech from an AudioStreamResult.

```typescript
async recognizeFromAudioStream(
  audioStreamResult: AudioStreamResult
): Promise<void>
```

##### `start()`

Start continuous recognition.

```typescript
async start(): Promise<void>
```

##### `stop()`

Stop recognition gracefully.

```typescript
stop(): void
```

##### `abort()`

Abort recognition immediately.

```typescript
abort(): void
```

##### `setCallbacks()`

Set event callbacks for recognition events.

```typescript
setCallbacks(callbacks: SpeechRecognitionCallbacks): void
```

##### `isActive()`

Check if recognition is currently active.

```typescript
isActive(): boolean
```

##### `updateConfig()`

Update recognition configuration.

```typescript
updateConfig(config: Partial<SpeechRecognitionConfig>): void
```

##### `getConfig()`

Get current configuration.

```typescript
getConfig(): Required<SpeechRecognitionConfig>
```

##### `cleanup()`

Clean up resources.

```typescript
cleanup(): void
```

### Functions

#### `isSpeechRecognitionSupported()`

Check if Web Speech API is supported in the current browser.

```typescript
function isSpeechRecognitionSupported(): boolean;
```

#### `recognizeSpeech()`

Convenience function for one-shot speech recognition.

```typescript
async function recognizeSpeech(
  audioStreamResult: AudioStreamResult,
  config?: SpeechRecognitionConfig,
): Promise<string>;
```

#### `createSpeechRecognitionCallback()`

Create a callback for continuous speech recognition.

```typescript
function createSpeechRecognitionCallback(
  onTranscript: (
    transcript: string,
    confidence: number,
    isFinal: boolean,
  ) => void,
  config?: SpeechRecognitionConfig,
): (audioStreamResult: AudioStreamResult) => Promise<void>;
```

## Usage Examples

### Example 1: Simple Transcription

Basic one-shot transcription of radio audio:

```typescript
import { extractAudioStream, DemodulationType } from "./utils/audioStream";
import { recognizeSpeech } from "./utils/speechRecognition";

// Demodulate radio signal
const audioResult = await extractAudioStream(
  iqSamples,
  2048000, // SDR sample rate
  DemodulationType.FM,
  { sampleRate: 16000 }, // 16kHz optimal for speech
);

// Transcribe
try {
  const transcript = await recognizeSpeech(audioResult, {
    lang: "en-US",
  });
  console.log("Transcription:", transcript);
} catch (error) {
  console.error("Recognition failed:", error);
}
```

### Example 2: Continuous Monitoring

Monitor radio communications continuously:

```typescript
import { SpeechRecognitionProcessor } from "./utils/speechRecognition";
import { AudioStreamProcessor, DemodulationType } from "./utils/audioStream";

const audioProcessor = new AudioStreamProcessor(2048000);
const recognizer = new SpeechRecognitionProcessor({
  lang: "en-US",
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
});

// Setup callbacks
recognizer.setCallbacks({
  onResult: (result) => {
    const alt = result.alternatives[0];
    if (result.isFinal) {
      console.log(
        `[FINAL] ${alt.transcript} (${(alt.confidence * 100).toFixed(1)}%)`,
      );
    } else {
      console.log(`[interim] ${alt.transcript}`);
    }
  },
  onError: (error) => {
    console.error(`Error: ${error.message}`);
  },
});

// Process radio stream
await device.receive(async (dataView) => {
  const iqSamples = device.parseSamples(dataView);
  const audioResult = await audioProcessor.extractAudio(
    iqSamples,
    DemodulationType.FM,
    { sampleRate: 16000 },
  );

  await recognizer.recognizeFromAudioStream(audioResult);
});
```

### Example 3: Multi-Language Support

Transcribe communications in different languages:

```typescript
import { SpeechRecognitionProcessor } from "./utils/speechRecognition";

// Spanish aviation communications
const esRecognizer = new SpeechRecognitionProcessor({
  lang: "es-ES",
  continuous: true,
});

esRecognizer.setCallbacks({
  onResult: (result) => {
    console.log("Spanish:", result.alternatives[0].transcript);
  },
});

// Switch languages dynamically
esRecognizer.updateConfig({ lang: "fr-FR" }); // Switch to French
```

### Example 4: Public Safety Monitoring

Monitor and log emergency communications:

```typescript
import { createSpeechRecognitionCallback } from "./utils/speechRecognition";
import { AudioStreamProcessor, DemodulationType } from "./utils/audioStream";

const audioProcessor = new AudioStreamProcessor(2048000);

// Create log file
const log: Array<{
  timestamp: string;
  transcript: string;
  confidence: number;
}> = [];

// Setup recognition callback
const recognitionCallback = createSpeechRecognitionCallback(
  (transcript, confidence, isFinal) => {
    if (isFinal && confidence > 0.7) {
      // Only log high-confidence finals
      log.push({
        timestamp: new Date().toISOString(),
        transcript,
        confidence,
      });
      console.log(`[${new Date().toLocaleTimeString()}] ${transcript}`);
    }
  },
  { lang: "en-US", continuous: true },
);

// Process police/fire radio
await device.setFrequency(155.475e6); // Example public safety frequency
await device.receive(async (dataView) => {
  const iqSamples = device.parseSamples(dataView);
  const audioResult = await audioProcessor.extractAudio(
    iqSamples,
    DemodulationType.FM,
    { sampleRate: 16000, enableDeEmphasis: true },
  );

  await recognitionCallback(audioResult);
});

// Save log
console.log(`Total transmissions: ${log.length}`);
```

### Example 5: Alternative Transcriptions

Get multiple transcription alternatives for ambiguous audio:

```typescript
const recognizer = new SpeechRecognitionProcessor({
  maxAlternatives: 5,
  continuous: false,
});

recognizer.setCallbacks({
  onResult: (result) => {
    if (result.isFinal) {
      console.log("Alternatives:");
      result.alternatives.forEach((alt, i) => {
        console.log(
          `  ${i + 1}. ${alt.transcript} (${(alt.confidence * 100).toFixed(1)}%)`,
        );
      });
    }
  },
});
```

### Example 6: Error Recovery

Robust error handling for noisy radio communications:

```typescript
import {
  SpeechRecognitionProcessor,
  SpeechRecognitionErrorCode,
} from "./utils/speechRecognition";

const recognizer = new SpeechRecognitionProcessor({
  lang: "en-US",
  continuous: true,
});

let noSpeechCount = 0;

recognizer.setCallbacks({
  onResult: (result) => {
    noSpeechCount = 0; // Reset counter on successful recognition
    console.log(result.alternatives[0].transcript);
  },

  onError: (error) => {
    switch (error.error) {
      case SpeechRecognitionErrorCode.NO_SPEECH:
        noSpeechCount++;
        if (noSpeechCount < 3) {
          console.log("No speech detected, retrying...");
          setTimeout(() => recognizer.start(), 1000);
        } else {
          console.log("No speech after 3 attempts, audio may be noise");
        }
        break;

      case SpeechRecognitionErrorCode.NETWORK:
        console.error("Network error, retrying in 5 seconds...");
        setTimeout(() => recognizer.start(), 5000);
        break;

      case SpeechRecognitionErrorCode.AUDIO_CAPTURE:
        console.error("Audio capture failed - check permissions");
        break;

      default:
        console.error(`Recognition error: ${error.message}`);
    }
  },

  onEnd: () => {
    // Automatically restart continuous recognition if it ends
    if (recognizer.getConfig().continuous) {
      setTimeout(() => recognizer.start(), 100);
    }
  },
});

await recognizer.start();
```

### Example 7: Integration with React Component

Use speech recognition in a React component:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { SpeechRecognitionProcessor } from '../utils/speechRecognition';
import type { AudioStreamResult } from '../utils/audioStream';

function SpeechTranscriber() {
  const [transcript, setTranscript] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recognizerRef = useRef<SpeechRecognitionProcessor | null>(null);

  useEffect(() => {
    // Initialize recognizer
    recognizerRef.current = new SpeechRecognitionProcessor({
      lang: 'en-US',
      continuous: true,
      interimResults: true
    });

    recognizerRef.current.setCallbacks({
      onResult: (result) => {
        if (result.isFinal) {
          setTranscript(prev => prev + ' ' + result.alternatives[0].transcript);
        }
      },
      onStart: () => setIsRecognizing(true),
      onEnd: () => setIsRecognizing(false),
      onError: (error) => console.error(error.message)
    });

    return () => {
      recognizerRef.current?.cleanup();
    };
  }, []);

  const handleAudioStream = async (audioResult: AudioStreamResult) => {
    await recognizerRef.current?.recognizeFromAudioStream(audioResult);
  };

  return (
    <div>
      <div>
        Status: {isRecognizing ? '🔴 Recognizing' : '⚪ Idle'}
      </div>
      <div>
        Transcript: {transcript}
      </div>
    </div>
  );
}
```

## Browser Compatibility

### Supported Browsers

| Browser     | Support    | Notes                                         |
| ----------- | ---------- | --------------------------------------------- |
| **Chrome**  | ✅ Full    | Uses `webkitSpeechRecognition`                |
| **Edge**    | ✅ Full    | Uses `webkitSpeechRecognition`                |
| **Safari**  | ⚠️ Partial | Limited support, may require user interaction |
| **Firefox** | ❌ None    | Web Speech API not implemented                |
| **Opera**   | ✅ Full    | Chromium-based                                |

### Feature Detection

Always check for support before using:

```typescript
import { isSpeechRecognitionSupported } from "./utils/speechRecognition";

if (!isSpeechRecognitionSupported()) {
  console.error("Speech recognition not supported in this browser");
  // Fallback to alternative solution or show error message
} else {
  // Proceed with recognition
  const recognizer = new SpeechRecognitionProcessor();
}
```

### Polyfills

There are no polyfills available for Web Speech API. For unsupported browsers, consider:

1. **Server-side transcription**: Use services like Google Cloud Speech-to-Text, Azure Speech, or AWS Transcribe
2. **WebAssembly solutions**: Implement client-side STT using WASM (e.g., Vosk, Whisper.cpp)
3. **Graceful degradation**: Provide audio recording/download for manual transcription

## Limitations

### Web Speech API Constraints

1. **Microphone Input Requirement**
   - Standard Web Speech API expects live microphone input
   - Recorded audio requires workarounds (MediaStream creation)
   - Some browsers may not support non-microphone MediaStreams

2. **Network Dependency**
   - Most browsers send audio to cloud services for recognition
   - Requires active internet connection
   - Privacy concerns for sensitive communications

3. **Session Limits**
   - Recognition may time out after periods of silence
   - Maximum session duration varies by browser
   - Automatic restarts may be needed for continuous monitoring

4. **Language Support**
   - Language availability varies by browser
   - Quality varies by language
   - Not all dialects supported

### Handling Noisy/Distorted Audio

For robust handling of radio communications:

1. **Pre-processing**

   ```typescript
   // Use optimal sample rate
   const audioResult = await audioProcessor.extractAudio(
     iqSamples,
     DemodulationType.FM,
     {
       sampleRate: 16000, // Best for speech recognition
       enableDeEmphasis: true, // Remove high-frequency noise
     },
   );
   ```

2. **Noise Detection**

   ```typescript
   recognizer.setCallbacks({
     onError: (error) => {
       if (error.error === SpeechRecognitionErrorCode.NO_SPEECH) {
         // Audio may be pure noise, skip processing
       }
     },
   });
   ```

3. **Confidence Filtering**

   ```typescript
   recognizer.setCallbacks({
     onResult: (result) => {
       const alt = result.alternatives[0];
       if (result.isFinal && alt.confidence > 0.8) {
         // Only accept high-confidence results
         processTranscript(alt.transcript);
       }
     },
   });
   ```

4. **Multiple Alternatives**
   ```typescript
   // Request multiple transcription options
   const recognizer = new SpeechRecognitionProcessor({
     maxAlternatives: 3,
   });
   ```

### Performance Considerations

- **Latency**: 1-3 seconds typical for cloud-based recognition
- **CPU Usage**: Minimal (processing done server-side in most browsers)
- **Memory**: Small footprint, automatic cleanup
- **Network**: Audio sent to cloud services, bandwidth varies

## Error Handling

### Error Types and Recovery

```typescript
import {
  SpeechRecognitionProcessor,
  SpeechRecognitionErrorCode,
} from "./utils/speechRecognition";

const recognizer = new SpeechRecognitionProcessor();

recognizer.setCallbacks({
  onError: (error) => {
    switch (error.error) {
      case SpeechRecognitionErrorCode.NO_SPEECH:
        // No speech detected - audio may be silence or noise
        console.log("No speech in audio segment");
        // Retry or skip
        break;

      case SpeechRecognitionErrorCode.AUDIO_CAPTURE:
        // Microphone access failed
        console.error("Cannot access audio input");
        // Request permissions
        break;

      case SpeechRecognitionErrorCode.NETWORK:
        // Network connectivity issue
        console.error("Network error during recognition");
        // Retry with exponential backoff
        break;

      case SpeechRecognitionErrorCode.NOT_ALLOWED:
        // User denied permission
        console.error("Speech recognition permission denied");
        // Show permission request UI
        break;

      case SpeechRecognitionErrorCode.LANGUAGE_NOT_SUPPORTED:
        // Language not available
        console.error("Language not supported");
        // Fallback to default language
        recognizer.updateConfig({ lang: "en-US" });
        break;

      default:
        console.error(`Recognition error: ${error.message}`);
    }
  },
});
```

### Retry Strategy

```typescript
async function recognizeWithRetry(
  audioResult: AudioStreamResult,
  maxRetries = 3,
): Promise<string> {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      return await recognizeSpeech(audioResult);
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries) {
        throw error;
      }
      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempts) * 1000),
      );
    }
  }

  throw new Error("Recognition failed after retries");
}
```

## Testing

The module includes comprehensive tests covering:

- ✅ Browser support detection
- ✅ Configuration management
- ✅ Recognition lifecycle (start/stop/abort)
- ✅ Result handling (final/interim, alternatives)
- ✅ Error handling (all error codes)
- ✅ Language support
- ✅ Integration with AudioStream
- ✅ Continuous recognition
- ✅ Robustness (empty audio, noise, short clips)

### Running Tests

```bash
# Run all speech recognition tests
npm test -- speechRecognition.test.ts

# Run with coverage
npm run test:coverage -- speechRecognition.test.ts

# Watch mode
npm run test:watch -- speechRecognition.test.ts
```

### Test Coverage

- **Unit Tests**: 40+ tests covering all public APIs
- **Integration Tests**: End-to-end scenarios with AudioStream
- **Error Tests**: All error codes and recovery paths
- **Mock Implementation**: Complete Web Speech API mock for testing

### Example Test

```typescript
import { SpeechRecognitionProcessor } from "../speechRecognition";

it("should transcribe audio successfully", async () => {
  const recognizer = new SpeechRecognitionProcessor();

  let transcript = "";
  recognizer.setCallbacks({
    onResult: (result) => {
      if (result.isFinal) {
        transcript = result.alternatives[0].transcript;
      }
    },
  });

  const audioResult = createMockAudioStreamResult();
  await recognizer.recognizeFromAudioStream(audioResult);

  expect(transcript).toBeTruthy();
  recognizer.cleanup();
});
```

## Related Documentation

- [Audio Stream Extraction API](./AUDIO_STREAM_API.md) - Demodulation pipeline
- [Architecture Documentation](../ARCHITECTURE.md) - Overall system design
- [Web Speech API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - Browser API reference
- [SpeechRecognition Interface](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) - Detailed API docs

## License

Part of the rad.io project. See repository LICENSE for details.
