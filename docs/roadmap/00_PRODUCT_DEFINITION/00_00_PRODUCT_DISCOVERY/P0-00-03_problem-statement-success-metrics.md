# Problem Statement & Success Metrics

## Problem Statement
**"SDR software is either powerful but hard to install, or easy to access but underpowered."**

Professional-grade SDR tools (SDR++, GQRX, GNURadio) require native installation, complex driver setups (Zadig, udev rules), and are platform-dependent. Existing web-based tools (WebSDR) rely on server-side processing, introducing high latency and preventing users from using their own local hardware.

**rad.io** bridges this gap by delivering a **native-class SDR experience entirely in the browser**. It leverages WebUSB and WebAssembly to provide zero-install, low-latency, privacy-first radio analysis on any modern device.

## Success Metrics (MVP)

### 1. Activation Rate ("First Signal")
- **Metric:** % of users who successfully see a waterfall/spectrum within 60s of landing.
- **Goal:** > 80% (for Mock Source), > 50% (for WebUSB).

### 2. Performance ("FPS")
- **Metric:** % of sessions maintaining > 50 FPS during active tuning.
- **Goal:** > 90% on target hardware (i5 + Chrome).

### 3. Reliability ("Crash-Free")
- **Metric:** % of sessions > 5 mins with zero audio dropouts or unrecoverable errors.
- **Goal:** > 95%.

### 4. Retention ("Coming Back")
- **Metric:** % of users who return within 7 days.
- **Goal:** Baseline measurement (Phase 1).
