# rad.io MVP Scope

## Overview

This document defines the functional and non-functional scope for the Minimum Viable Product (MVP) of rad.io. The goal of the MVP is to deliver a stable, performant, and usable browser-based Software Defined Radio (SDR) receiver that proves the architecture (WebUSB → Worker → WebAudio) is viable for daily use.

## Core Capabilities (In-Scope)

### 1. Hardware Connectivity

- **WebUSB Device Support**: Native support for HackRF One.
- **Device Management**:
  - Connect/Disconnect via browser permission prompt.
  - Hot-plug detection and recovery.
  - Firmware version check and warning on incompatibility.

### 2. Digital Signal Processing (DSP)

- **Architecture**: Threaded DSP pipeline (WebWorker) using WebAssembly (WASM) for critical paths.
- **Demodulation**:
  - **WFM**: Wideband FM (Broadcast radio) with stereo pilot detection (mono audio out for MVP ok, stereo preferred if cheap).
  - **NFM**: Narrowband FM (Two-way radio) with squelch.
  - **AM**: Amplitude Modulation (Airband/SW).
- **Filtering**: Basic channel filtration per mode.

### 3. Visualization

- **Real-time Spectrum Analyzer**:
  - 60 FPS GPU-accelerated rendering.
  - Configurable Reference Level (dBFS).
- **Waterfall Display**:
  - Smooth scrolling history.
  - Auto-ranging or manual color mapping.
- **Navigation**:
  - Click-to-tune.
  - Drag-to-pan frequency.
  - Scroll-to-zoom (bandwidth).

### 4. Audio Output

- **WebAudio Sink**: Low-latency audio output.
- **Controls**:
  - Main Volume.
  - Mute/Unmute.
  - Squelch Level (NFM/AM).

### 5. Application Shell

- **Responsive Layout**: Usable on Desktop (Windows/Mac/Linux) Chrome & Edge.
- **Status Reporting**:
  - Drop counter / Underrun indicator.
  - CPU load indicator.
  - Connection status.

## Quality Bar

### Reliability

- **Crash-Free**: The UI thread must never freeze. DSP crashes should restart the worker, not kill the tab.
- **Recoverability**: Unplugging the device and plugging it back in should automatically resume streaming (or offer a one-click resume) without a page reload.
- **Audio Stability**: No audible glitches (pops/clicks) under normal desktop load.

### Performance

- **Frame Rate**: Consistent 60fps spectrum rendering on standard integrated graphics.
- **Latency**: End-to-end latency (RF to Audio) < 200ms (aiming for "feels realtime").
- **Memory**: Stable heap usage (no leaks over 1-hour session).

### Accessibility

- **Keyboard Navigation**: Core tuning (frequency step up/down) and mute toggle accessible via keyboard.
- **Contrast**: UI elements meet WCAG AA contrast ratios.

## Dependencies & Assumptions

- **Browser**: Chromium-based browsers (Chrome, Edge) with WebUSB and AudioWorklet support.
- **Hardware**: HackRF One (primary dev target).
- **Environment**: "Secure Context" (HTTPS or localhost) required for WebUSB.
