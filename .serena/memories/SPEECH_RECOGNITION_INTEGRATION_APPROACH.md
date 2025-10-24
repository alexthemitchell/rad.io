# Web Speech API Integration for SDR Audio Transcription

## Critical Understanding: Web Speech API Limitation

**The Web Speech API is fundamentally designed for live microphone input via getUserMedia(), NOT for pre-recorded or processed audio buffers.**

### Why Direct Integration Doesn't Work

1. **SpeechRecognition requires MediaStream from getUserMedia()**
   - Cannot feed AudioBuffer directly to Web Speech API
   - `createMediaStreamSource()` is for live streams, not buffers
   - Attempts to convert AudioBuffer → MediaStream fail in practice

2. **Browser Security Model**
   - Speech recognition tied to user's microphone permission
   - Cannot "inject" audio into recognition pipeline
   - Designed to prevent spoofing/manipulation

### Practical Approaches for SDR Audio Transcription

#### Approach 1: Loopback Audio (Recommended for User Testing)
- Play demodulated audio through speakers
- User captures with microphone using Web Speech API
- Pros: Works with Web API, tests full pipeline
- Cons: Requires external audio routing, quality loss, not fully automated

#### Approach 2: UI Pattern - Manual Activation
**This is the most practical browser-native solution:**

```typescript
// When user wants transcription of current audio:
1. User clicks "Transcribe" button
2. Prompt user to speak into microphone (reading what they hear)
3. OR: Display message: "To transcribe radio audio, enable system audio loopback"
4. Run speech recognition on live microphone input
```

**Benefits:**
- Works within Web Speech API constraints
- Clear UX: user controls when transcription happens
- Properly shows real-world limitation
- No need for server-side APIs

#### Approach 3: Display-Only Implementation
**Focus on demonstrating the technology:**

```typescript
// Show what transcription would look like
- Create UI component for displaying transcripts
- Use Speech Synthesis to demonstrate (TTS → STT round-trip)
- Document limitation clearly
- Provide manual transcription mode via microphone
```

### Recommended Implementation for rad.io

Given that rad.io is:
- Educational SDR visualization tool
- Browser-based (no server)
- Real-time audio processing

**Best approach: Hybrid Demonstration + Manual Mode**

1. **Create SpeechTranscription UI Component**
   - Display area for live transcripts
   - Language selector
   - Confidence indicators
   - Clear status messages

2. **Two Operating Modes**

   **Mode A: Demonstration (Using Speech Synthesis)**
   - Generate test phrases with TTS
   - Feed to Speech Recognition
   - Show round-trip transcription
   - Educate users about the technology

   **Mode B: Manual Transcription**
   - User enables microphone
   - Transcribe what user speaks/hears
   - Useful for logging radio communications
   - Works with actual radio audio (user repeats what they hear)

3. **Clear Documentation**
   - Explain Web Speech API limitation
   - Guide users on system audio loopback (advanced)
   - Show educational value of demonstration mode

### Implementation Files

**New Components:**
- `src/components/SpeechTranscription.tsx` - UI for displaying transcripts
- `src/hooks/useSpeechRecognition.ts` - React hook wrapping SpeechRecognitionProcessor

**Integration Point:**
- `src/pages/Visualizer.tsx` - Add transcription card alongside visualizations

**No Changes Needed:**
- `src/utils/speechRecognition.ts` - Already implements Web Speech API correctly
- Test suite - Already comprehensive for API usage

### Code Pattern

```typescript
// In Visualizer.tsx
const [transcriptionMode, setTranscriptionMode] = useState<'off' | 'demo' | 'manual'>('off');
const [transcript, setTranscript] = useState('');

// Mode A: Demo with synthesis
const runDemoTranscription = async () => {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance("Test radio message");
  synth.speak(utterance);
  // Start recognition to capture it (if browser allows)
};

// Mode B: Manual microphone transcription
const startManualTranscription = async () => {
  recognizer.setCallbacks({
    onResult: (result) => setTranscript(result.alternatives[0].transcript)
  });
  await recognizer.start(); // Uses getUserMedia
};
```

### Testing Strategy

**E2E Tests Already Exist:**
- 31 tests in `speechEndToEnd.test.ts`
- Full round-trip TTS → STT validation
- Multiple languages, edge cases, performance

**New UI Tests:**
- Component rendering
- Mode switching
- Error states
- Accessibility (ARIA live regions)

### UX Messages

**Clear user communication is essential:**

```
"Web Speech Recognition uses your microphone.
 
For transcribing radio audio:
- Option 1: Enable system audio loopback (advanced)
- Option 2: Speak what you hear into the microphone
- Option 3: Use Demo mode to see how it works"
```

## Summary

Web Speech API cannot directly transcribe SDR demodulated audio due to browser security model. Best implementation:
1. Create polished UI component
2. Support microphone-based manual transcription
3. Add demo mode using Speech Synthesis
4. Document limitations clearly
5. Provide educational value

This aligns with rad.io's educational mission while working within browser constraints.
