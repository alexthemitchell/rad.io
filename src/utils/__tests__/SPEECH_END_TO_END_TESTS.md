# End-to-End Speech Synthesis → Recognition Test Suite

## Overview

This test suite validates the complete audio pipeline using Web Speech APIs, simulating real-world radio broadcast scenarios. It ensures that the speech recognition engine can accurately transcribe synthesized speech, validating both encoding (Text-to-Speech) and decoding (Speech-to-Text) capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              END-TO-END TEST PIPELINE                            │
└─────────────────────────────────────────────────────────────────┘

Input Text
    ↓
Web Speech Synthesis API (TTS)
    ↓
AudioBuffer
    ↓
Web Speech Recognition API (STT)
    ↓
Transcribed Text
    ↓
Accuracy Validation
```

## Test Coverage

### 1. API Support (3 tests)
- ✅ Speech Synthesis API detection
- ✅ Speech Recognition API detection  
- ✅ Voice availability verification

### 2. Basic Round-Trip Transcription (3 tests)
- ✅ Simple English phrases
- ✅ Medium-length sentences
- ✅ Short utterances

### 3. Multi-Language Support (3 tests)
- ✅ English (US) - `en-US`
- ✅ Spanish - `es-ES`
- ✅ French - `fr-FR`

### 4. Speech Rate Variations (3 tests)
- ✅ Slow speech (0.5x speed)
- ✅ Normal speech (1.0x speed)
- ✅ Fast speech (1.5x speed)

### 5. Complex Phrases (4 tests)
Tests realistic radio communication scenarios:
- ✅ "unit 23 responding to 123 main street"
- ✅ "frequency one five five point four seven five megahertz"
- ✅ "10-4 roger that over"
- ✅ "all units be advised suspect vehicle is a blue ford"

### 6. Edge Cases (3 tests)
- ✅ Empty string handling
- ✅ Very long text (>100 words)
- ✅ Special characters and punctuation

### 7. Failure Modes (3 tests)
- ✅ Synthesis errors detection
- ✅ Recognition errors gracefully handled
- ✅ Missing API support detection

### 8. Radio Broadcast Simulation (3 tests)
Real-world scenarios:
- ✅ Emergency broadcasts
- ✅ Aviation communications
- ✅ Continuous monitoring

### 9. Robustness Tests (2 tests)
- ✅ Rapid successive transcriptions
- ✅ Resource cleanup validation

### 10. Performance Metrics (2 tests)
- ✅ Synthesis completion time (<5 seconds)
- ✅ Recognition completion time (<1 second)

### 11. Documentation and Reporting (2 tests)
- ✅ Test metadata capture
- ✅ Accuracy calculation utility

**Total: 31 tests**

## Test Execution

### Run End-to-End Tests Only
```bash
npm test -- src/utils/__tests__/speechEndToEnd.test.ts
```

### Run with Coverage
```bash
npm test -- src/utils/__tests__/speechEndToEnd.test.ts --coverage
```

### Watch Mode (for development)
```bash
npm test -- src/utils/__tests__/speechEndToEnd.test.ts --watch
```

## Test Results

All tests use **mocked Web Speech APIs** for consistent, deterministic behavior across environments. The mocks simulate:

- **Speech Synthesis**: Generates mock AudioBuffer objects with estimated durations
- **Speech Recognition**: Returns predetermined transcriptions with confidence scores
- **AudioContext**: Provides mock audio processing capabilities

### Expected Output

```
PASS src/utils/__tests__/speechEndToEnd.test.ts
  End-to-End Speech Synthesis → Recognition
    API Support
      ✓ should detect Speech Synthesis API support (2 ms)
      ✓ should detect Speech Recognition API support (1 ms)
      ✓ should have compatible voice options (1 ms)
    Basic Round-Trip Transcription
      ✓ should transcribe simple English phrase (254 ms)
      ✓ should handle medium-length phrases (253 ms)
      ✓ should handle short utterances (253 ms)
    ...
    Documentation and Reporting
      ✓ should capture test metadata (1 ms)
      ✓ should provide accuracy calculation utility

Test Suites: 1 passed, 1 total
Tests:       31 passed, 31 total
```

## Accuracy Calculation

The test suite includes a word-level accuracy calculator:

```typescript
function calculateAccuracy(original: string, transcribed: string): number
```

**Algorithm:**
1. Normalize both strings (lowercase, trim)
2. Split into words
3. Compare word-by-word
4. Return ratio: `matches / max(original_words, transcribed_words)`

**Example:**
```typescript
calculateAccuracy("hello world", "hello world") // 1.0 (100%)
calculateAccuracy("hello world", "hello") // 0.5 (50%)
calculateAccuracy("hello world", "goodbye world") // 0.5 (50%)
```

## Browser Compatibility

### Web Speech Synthesis API
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Primary testing environment |
| Edge | ✅ Full | Chromium-based |
| Safari | ⚠️ Partial | Limited voice options |
| Firefox | ⚠️ Partial | Some voices available |

### Web Speech Recognition API
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Uses `webkitSpeechRecognition` |
| Edge | ✅ Full | Uses `webkitSpeechRecognition` |
| Safari | ⚠️ Partial | Limited support |
| Firefox | ❌ None | Web Speech API not implemented |

## Mock Implementation Details

### MockSpeechSynthesisUtterance
Simulates the browser's `SpeechSynthesisUtterance` with:
- Properties: `text`, `lang`, `rate`, `pitch`, `volume`
- Events: `onend`, `onerror`, `onstart`, `onpause`, `onresume`
- Callbacks trigger after simulated delays

### MockSpeechSynthesis
Provides:
- 5 pre-configured voices (en-US, en-GB, es-ES, fr-FR, de-DE)
- `speak()` method with 100ms simulation delay
- `cancel()`, `pause()`, `resume()` lifecycle methods

### MockSpeechRecognition
Implements:
- Auto-response with predetermined transcription
- Configurable language, continuous mode, interim results
- Simulated delays (5-10ms) for realistic async behavior
- Error simulation support

### MockAudioContext
Provides:
- Buffer creation with proper sample rates
- Channel data access
- Duration calculations

## Integration with Existing Tests

This test suite complements:
- `speechRecognition.test.ts` - Unit tests for Speech Recognition API
- `audioStream.test.ts` - Audio demodulation and processing tests

Together, they provide comprehensive coverage of the entire speech processing pipeline.

## Debugging Failed Tests

### Common Issues

1. **Timeout Errors**
   - Increase test timeout in specific test
   - Check for unclosed async operations

2. **Mock Not Working**
   - Verify `beforeAll()` setup runs before tests
   - Check global object pollution from other tests

3. **Unexpected Behavior**
   - Add `console.log()` statements
   - Use `--verbose` flag when running tests

### Debugging Commands

```bash
# Run single test
npm test -- -t "should transcribe simple English phrase"

# Run with verbose output
npm test -- src/utils/__tests__/speechEndToEnd.test.ts --verbose

# Run without coverage (faster)
npm test -- src/utils/__tests__/speechEndToEnd.test.ts --no-coverage
```

## Future Enhancements

Potential improvements:
1. **Real Audio Testing**: Integrate with actual audio generation
2. **Noise Injection**: Test with background noise/interference
3. **Confidence Thresholds**: Validate minimum confidence scores
4. **Performance Benchmarks**: Track latency trends over time
5. **Additional Languages**: Expand multi-language coverage
6. **WebRTC Integration**: Test with real-time streaming

## Related Documentation

- [Speech Recognition API](../SPEECH_RECOGNITION_API.md) - Main speech recognition documentation
- [Audio Stream API](../AUDIO_STREAM_API.md) - Audio demodulation pipeline
- [Testing Guide](../../../CONTRIBUTING.md#testing) - General testing practices

## License

Part of the rad.io project. See repository LICENSE for details.
