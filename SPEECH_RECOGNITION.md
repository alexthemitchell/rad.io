# Web Speech API Integration

## Overview

The rad.io Speech Recognition API provides near-real-time speech-to-text transcription capabilities for demodulated audio from radio signals using the browser's native Web Speech API.

## ⚠️ Important Limitations

### Internet Connection Required

The Web Speech API **requires an internet connection** in most browsers:

- **Chrome/Edge**: Uses Google's cloud-based speech recognition service
- **Safari**: Uses Apple's cloud-based speech recognition service  
- **Firefox**: Limited or no support for Web Speech API

**There is NO true offline speech recognition available via the Web Speech API.** The issue request for "offline" recognition cannot be fully met with browser-native APIs alone.

### Audio Quality Considerations

- Radio demodulation quality affects recognition accuracy
- Best results with clear speech signals (FM radio talk shows, AM radio news broadcasts)
- Noisy or distorted signals may produce inaccurate transcriptions
- Music and non-speech audio will not produce meaningful transcriptions

### Browser Support

| Browser | Support | Engine |
|---------|---------|--------|
| Chrome 25+ | ✅ Full | Google Cloud Speech API |
| Edge 79+ | ✅ Full | Google Cloud Speech API |
| Safari 14.1+ | ✅ Full | Apple Speech Recognition |
| Firefox | ❌ None | N/A |
| Opera 27+ | ✅ Full | Google Cloud Speech API |

## Quick Start

### Basic Usage

```typescript
import {
  SpeechRecognitionProcessor,
  createSpeechRecognizer,
} from "./utils/speechRecognition";
import { AudioStreamProcessor, DemodulationType } from "./utils/audioStream";

// Create speech recognizer
const recognizer = createSpeechRecognizer(
  (transcript) => {
    if (transcript.isFinal) {
      console.log(`Final: ${transcript.text}`);
    } else {
      console.log(`Interim: ${transcript.text}`);
    }
  },
  {
    lang: "en-US",
    interimResults: true,
    continuous: true,
  }
);

// Start recognition
await recognizer.start();

// In your SDR receive callback:
device.receive(async (dataView) => {
  const iqSamples = device.parseSamples(dataView);
  
  // Extract audio from IQ samples
  const audioResult = await audioProcessor.extractAudio(
    iqSamples,
    DemodulationType.FM,
    { sampleRate: 48000 }
  );
  
  // Process audio for speech recognition
  await recognizer.processAudio(audioResult);
});
```

### Integration with Visualizer

```typescript
import { useState, useEffect } from "react";
import { useHackRFDevice } from "./hooks/useHackRFDevice";
import { SpeechRecognitionProcessor } from "./utils/speechRecognition";
import type { SpeechRecognitionTranscript } from "./utils/speechRecognition";

function RadioTranscription() {
  const { device } = useHackRFDevice();
  const [transcript, setTranscript] = useState<string>("");
  const [recognizer] = useState(() => new SpeechRecognitionProcessor({
    lang: "en-US",
    interimResults: true,
  }));

  useEffect(() => {
    recognizer.onTranscript = (result: SpeechRecognitionTranscript) => {
      if (result.isFinal) {
        setTranscript(prev => prev + " " + result.text);
      }
    };

    recognizer.onError = (error) => {
      console.error("Recognition error:", error);
    };

    return () => {
      recognizer.cleanup();
    };
  }, [recognizer]);

  const startRecognition = async () => {
    await recognizer.start();
  };

  const stopRecognition = async () => {
    await recognizer.stop();
  };

  return (
    <div>
      <h3>Live Transcription</h3>
      <button onClick={startRecognition}>Start</button>
      <button onClick={stopRecognition}>Stop</button>
      <div>{transcript}</div>
    </div>
  );
}
```

## API Reference

### `SpeechRecognitionProcessor`

Main class for speech recognition integration.

#### Constructor

```typescript
new SpeechRecognitionProcessor(config?: SpeechRecognitionConfig)
```

**Configuration Options:**

```typescript
type SpeechRecognitionConfig = {
  /** Language code (e.g., 'en-US', 'es-ES', 'fr-FR') */
  lang?: string;
  
  /** Return interim results as speech is being recognized */
  interimResults?: boolean;
  
  /** Maximum number of alternative transcriptions to return */
  maxAlternatives?: number;
  
  /** Continuous recognition (keeps listening after results) */
  continuous?: boolean;
};
```

**Defaults:**
- `lang`: "en-US"
- `interimResults`: true
- `maxAlternatives`: 1
- `continuous`: true

#### Methods

**`static isSupported(): boolean`**

Check if Web Speech API is supported in the current browser.

```typescript
if (SpeechRecognitionProcessor.isSupported()) {
  const recognizer = new SpeechRecognitionProcessor();
}
```

**`async start(): Promise<void>`**

Initialize and start speech recognition.

Throws `SpeechRecognitionError` if API is not supported.

**`async stop(): Promise<void>`**

Stop speech recognition and cleanup audio context.

**`async processAudio(audioResult: AudioStreamResult): Promise<void>`**

Process audio from SDR audio stream for recognition.

**`getMediaStream(): MediaStream | null`**

Get the MediaStream for direct connection to Web Audio API nodes.

**`isActive(): boolean`**

Check if recognition is currently active.

**`async cleanup(): Promise<void>`**

Clean up all resources and remove event listeners.

#### Events

Set callback functions to handle recognition events:

```typescript
recognizer.onTranscript = (transcript: SpeechRecognitionTranscript) => {
  console.log(transcript.text, transcript.confidence);
};

recognizer.onError = (error: SpeechRecognitionError) => {
  console.error(error.errorType, error.message);
};

recognizer.onStart = () => {
  console.log("Recognition started");
};

recognizer.onEnd = () => {
  console.log("Recognition ended");
};
```

### Transcript Object

```typescript
type SpeechRecognitionTranscript = {
  /** The transcribed text */
  text: string;
  
  /** Confidence score (0-1, where 1 is highest confidence) */
  confidence: number;
  
  /** Whether this is a final result or interim */
  isFinal: boolean;
  
  /** Timestamp when recognition occurred */
  timestamp: number;
};
```

### Error Types

```typescript
enum SpeechRecognitionErrorType {
  NO_SPEECH = "no-speech",           // No speech detected
  ABORTED = "aborted",               // Recognition aborted
  AUDIO_CAPTURE = "audio-capture",   // Audio capture failed
  NETWORK = "network",               // Network error
  NOT_ALLOWED = "not-allowed",       // Permission denied
  SERVICE_NOT_ALLOWED = "service-not-allowed",
  BAD_GRAMMAR = "bad-grammar",
  LANGUAGE_NOT_SUPPORTED = "language-not-supported",
  NO_MATCH = "no-match",             // No match found
  UNKNOWN = "unknown"                // Unknown error
}
```

## Language Support

The Web Speech API supports multiple languages. Common language codes:

- `en-US` - English (United States)
- `en-GB` - English (United Kingdom)
- `es-ES` - Spanish (Spain)
- `es-MX` - Spanish (Mexico)
- `fr-FR` - French (France)
- `de-DE` - German (Germany)
- `it-IT` - Italian (Italy)
- `ja-JP` - Japanese (Japan)
- `ko-KR` - Korean (South Korea)
- `zh-CN` - Chinese (Simplified)
- `pt-BR` - Portuguese (Brazil)
- `ru-RU` - Russian (Russia)
- `ar-SA` - Arabic (Saudi Arabia)

[Full list of supported languages](https://cloud.google.com/speech-to-text/docs/languages)

## Best Practices

### 1. Error Handling

Always handle recognition errors gracefully:

```typescript
recognizer.onError = (error) => {
  if (error.errorType === SpeechRecognitionErrorType.NETWORK) {
    console.error("Network error - check internet connection");
  } else if (error.errorType === SpeechRecognitionErrorType.NO_SPEECH) {
    console.log("No speech detected");
  }
};
```

### 2. Clean Up Resources

Always clean up when done:

```typescript
useEffect(() => {
  const recognizer = new SpeechRecognitionProcessor();
  // ... setup ...
  return () => {
    recognizer.cleanup();
  };
}, []);
```

### 3. Handle Interim vs Final Results

Distinguish between interim and final transcriptions:

```typescript
recognizer.onTranscript = (transcript) => {
  if (transcript.isFinal) {
    // Save or display final result
    saveFinalTranscript(transcript.text);
  } else {
    // Show interim result temporarily
    showInterimTranscript(transcript.text);
  }
};
```

### 4. Audio Quality

For best recognition results:
- Use FM demodulation for voice broadcasts
- Ensure adequate signal strength
- Tune to clear speech channels (talk radio, news)
- Avoid music channels

### 5. Privacy Considerations

**Important**: Audio is sent to cloud services for processing.

- Be aware of privacy implications
- Don't transmit sensitive communications
- Inform users that transcription requires internet
- Check local laws regarding recording/transcription

## Testing

The speech recognition module includes 29 comprehensive unit tests covering:

- Browser support detection
- Configuration handling
- Audio processing
- Transcription results (interim and final)
- Error handling (network, no-speech, permissions, etc.)
- Resource cleanup
- Integration with audio streams

Run tests:

```bash
npm test -- --testPathPatterns='speechRecognition.test'
```

## Troubleshooting

### "Web Speech API is not supported"

**Solutions:**
- Use Chrome, Edge, or Safari browser
- Ensure you're on HTTPS (required for WebUSB and Web Speech API)
- Update your browser to the latest version

### "Network error" or recognition stops

**Solutions:**
- Check internet connection
- Verify firewall isn't blocking speech API requests
- Try refreshing the page

### Low accuracy transcriptions

**Solutions:**
- Ensure good signal quality from SDR
- Tune to clear speech broadcasts (not music)
- Try adjusting demodulation parameters
- Use appropriate language code for the broadcast

### Permission denied errors

**Solutions:**
- Grant microphone permissions if prompted
- Check browser privacy settings
- Reload the page after granting permissions

## Examples

### Example 1: FM Radio Talk Show Transcription

```typescript
const processor = new AudioStreamProcessor(2048000); // HackRF sample rate
const recognizer = new SpeechRecognitionProcessor({
  lang: "en-US",
  interimResults: false, // Only final results
  continuous: true,
});

recognizer.onTranscript = (transcript) => {
  console.log(`[${new Date(transcript.timestamp).toLocaleTimeString()}] ${transcript.text}`);
};

await device.setFrequency(94.7e6); // NPR station
await recognizer.start();

await device.receive(async (dataView) => {
  const iqSamples = device.parseSamples(dataView);
  const audio = await processor.extractAudio(iqSamples, DemodulationType.FM);
  await recognizer.processAudio(audio);
});
```

### Example 2: Multi-Language Support

```typescript
const languages = ["en-US", "es-ES", "fr-FR"];
let currentLangIndex = 0;

const recognizer = new SpeechRecognitionProcessor({
  lang: languages[currentLangIndex],
  continuous: false, // Restart after each result
});

recognizer.onEnd = async () => {
  // Rotate language on each recognition cycle
  currentLangIndex = (currentLangIndex + 1) % languages.length;
  await recognizer.stop();
  await recognizer.start(); // Restart with new language
};
```

### Example 3: Real-time Closed Captioning

```typescript
function ClosedCaptioning() {
  const [captions, setCaptions] = useState<string[]>([]);
  
  const recognizer = useMemo(() => 
    createSpeechRecognizer(
      (transcript) => {
        if (transcript.isFinal) {
          setCaptions(prev => [...prev.slice(-10), transcript.text]);
        }
      },
      { lang: "en-US", interimResults: false }
    ),
    []
  );

  return (
    <div className="closed-captions">
      {captions.map((caption, i) => (
        <p key={i}>{caption}</p>
      ))}
    </div>
  );
}
```

## See Also

- [Web Speech API Documentation (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Audio Stream Extraction API](./AUDIO_STREAM.md)
- [DSP Pipeline Documentation](./DSP.md)
- [HackRF Device Integration](./HACKRF.md)

## License

Part of the rad.io SDR Visualizer project. See main README for license information.
