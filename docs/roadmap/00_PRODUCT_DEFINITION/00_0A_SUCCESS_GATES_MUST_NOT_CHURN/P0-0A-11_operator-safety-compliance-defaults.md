# Operator Safety & Compliance Defaults

## 1. Hearing Safety (Audio)
Software Defined Radios can output sudden, full-scale noise (static) if a signal drops or demodulation settings change. We must protect the user's ears/speakers.

### 1.1 The "First-Do-No-Harm" Limiter
- **Requirement:** A hard limiter (or fast compressor) must be the final stage of the audio pipeline before the `AudioContext` destination.
- **Threshold:** -1.0 dBFS.
- **Attack:** < 1ms (Instant catch).

### 1.2 Default Mute Policy
- **Startup:** App starts **MUTED** by default. User must explicitly click "Audio On".
- **Device Change:** Audio **MUTES** automatically if the input device changes (e.g., swapping from HackRF to File).
- **Mode Change:** Audio **MUTES** (or ramps) when switching modes (e.g., NFM -> WFM) to prevent gain jumps.

### 1.3 Gain Staging Defaults
- **Default Volume:** 50% (-6dB).
- **Squelch:** Enabled by default for NFM/AM (to silence static).

## 2. RF Compliance (Receive Only)
rad.io is a **Receive-Only** application.

- **TX Lockout:** The application shall not expose any controls to transmit, even if the connected hardware supports it (e.g., HackRF).
- **frequency Range:** We do not artificially limit receive range (users are responsible for lawful monitoring), but we do not facilitate transmission.

## 3. Recording Provenance (Compliance)
For professional workflows, knowing *where* and *when* a recording was made is critical.

- **Metadata:** All recordings (SigMF/WAV) must automatically include:
  - Timestamp (UTC).
  - Center Frequency & Sample Rate.
  - Device Name.
  - Software Version.
- **Privacy:** Location data (GPS) is **NOT** included by default (see Privacy Policy).
