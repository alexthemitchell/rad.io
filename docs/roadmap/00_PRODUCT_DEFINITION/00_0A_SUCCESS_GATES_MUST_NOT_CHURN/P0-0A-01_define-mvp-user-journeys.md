# MVP User Journey: Tune → Listen → Record

## 1. Connect Source

- **User Action:** Clicks "Connect" → Selects "Mock Device" or "HackRF".
- **System:** Initializes Worker → Requests Device → Starts Stream.
- **Success:** Waterfall starts flowing; noise floor visible.

## 2. Tune & Visualize

- **User Action:** Drags spectrum or clicks center frequency.
- **System:** Sends retune command → DDC shifts → Visuals update.
- **Success:** Signal appears in center of passband.

## 3. Listen

- **User Action:** Clicks "NFM" mode → Clicks "Audio On".
- **System:** Demodulator starts → AudioWorklet buffer fills → Sound output.
- **Success:** Audio is audible (static or tone) without stutter.

## 4. Record

- **User Action:** Clicks "Record IQ".
- **System:** Forks sample stream to IndexedDB writer.
- **Success:** "Recording..." indicator active; storage counter increments.

## 5. Replay

- **User Action:** Clicks "Stop" → "Load Recording".
- **System:** Disconnects device → Connects FileSource → Plays back.
- **Success:** Original spectrum and audio reproduce exactly.
