# Competitive & Reference App Review

## 1. SDR++ (Native / Desktop)
**The Gold Standard.**
*   **Pros:** Extremely performant (C++), modular (plugins), supports every device.
*   **Cons:** Requires install, driver hell on Windows/Mac.
*   **Takeaway:** Copy the VFO interaction model (click-to-tune, drag-to-pan) and the modular panel layout.

## 2. WebSDR.org (Web)
**The Old Guard.**
*   **Pros:** Works everywhere, massive user base.
*   **Cons:** Ancient UI, server-side processing only (high latency), no local hardware support.
*   **Takeaway:** We beat this by allowing *local* device access.

## 3. OpenWebRX+ (Web)
**The Modern Server.**
*   **Pros:** Good decoders (digital modes), nice waterfall.
*   **Cons:** Still server-centric.
*   **Takeaway:** Their "bookmarks" and "metadata" features are excellent.

## 4. IQEngine (Web/Analysis)
**The Analyzer.**
*   **Pros:** Excellent SigMF support, great spectrogram navigation.
*   **Cons:** Not a real-time receiver (analysis only).
*   **Takeaway:** Adopt their zooming/navigation interactions for our "Replay" mode.

## 5. Universal Radio Hacker (Native)
**The Protocol Reverser.**
*   **Pros:** Visualizing bits/symbols.
*   **Cons:** Not for listening.
*   **Takeaway:** Inspiration for our future "Logic Analyzer" views.
