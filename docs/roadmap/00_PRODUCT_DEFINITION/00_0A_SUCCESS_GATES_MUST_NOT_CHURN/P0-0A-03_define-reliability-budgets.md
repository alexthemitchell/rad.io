# Reliability Budgets

## Connectivity
- **WebUSB Reconnect:** 100% success rate on tab reload (if device not claimed).
- **Disconnect Recovery:** Graceful UI state (no white screen) on device pull.

## Streaming
- **Overrun Behavior:** 
  - Visuals: Skip frames (preserve responsiveness).
  - Audio: Gap concealment (fade out/in) - NO LOUD POPS.
- **Glitch Tolerance:** < 1 audible glitch per hour on "Stable" profile.

## State
- **Crash Recovery:** "Safe Mode" boot option available if previous session crashed < 10s after load.
