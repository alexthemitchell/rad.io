# MVP Demo Script (10 Minutes)

**Goal:** Demonstrate the "Vertical Slice" is complete and usable.

## Setup
- **Hardware:** Laptop (Chrome) + HackRF One (via USB).
- **Backup:** Mock Device mode (if hardware fails).

## The Script

### 1. The "Zero Install" Opening (2 min)
- **Action:** Open Incognito window. Navigate to `localhost:3000`.
- **Narration:** "This is a fresh session. No drivers installed."
- **Action:** Click "Connect" -> Select "HackRF".
- **Result:** Browser permission prompt appears. Select device. Waterfall starts immediately.
- **Wow Factor:** Instant visuals.

### 2. The "Smooth Tuning" (3 min)
- **Action:** Drag the spectrum to tune. Zoom in on a signal (FM Broadcast).
- **Narration:** "60 FPS rendering. Smooth zoom. No lag."
- **Action:** Click center of signal.
- **Result:** Signal centers. Demod starts (audio muted).

### 3. The "Listening" (2 min)
- **Action:** Select "WFM". Unmute.
- **Result:** Clear FM radio audio.
- **Action:** Adjust bandwidth filter edges.
- **Result:** Audio changes instantly.

### 4. The "Record & Replay" (3 min)
- **Action:** Click "Record". Wait 10s. Stop.
- **Action:** Disconnect device.
- **Action:** Click "Load Recording". Select the session.
- **Result:** Playback starts. Spectrogram matches exactly. Audio matches exactly.
- **Narration:** "I can send this file to a colleague, and they see exactly what I saw."
