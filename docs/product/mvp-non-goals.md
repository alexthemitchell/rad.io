# rad.io MVP Non-Goals

## Explicitly Excluded Features

These features are valuable but are strictly out of scope for the MVP release to ensure we ship the core "receiver" experience first.

### 1. Complex DSP / Modes

- **Digital Decoding**: No P25, DMR, FT8, APRS, or ADS-B decoding.
- **SSB (Single Sideband)**: Deferred to post-MVP (requires finer tuning UX and BFO logic).
- **RDS/RBDS**: No subcarrier text decoding for WFM.
- **Stereo FM Separation**: Mono WFM is acceptable for MVP if stereo adds significant DSP complexity.

### 2. Advanced Device Support

- **RTL-SDR (Legacy)**: No support for rtl_tcp or non-WebUSB RTL-SDR bridges.
- **Airspy / SDRplay**: No proprietary driver wrappers.
- **Transmitting (TX)**: Receiver (RX) only. No transmit capability.

### 3. Advanced Analysis & Recording

- **IQ Recording/Replay**: No saving raw IQ data to disk. Audio recording only (maybe).
- **Signal Analysis**: No vector scope, constellation diagrams, or eye patterns.
- **Measurement Grade**: We make no claims of calibrated amplitude (dBm) or frequency accuracy (PPM correction) for MVP. "Relative signal strength" is sufficient.

### 4. Ecosystem & Extensibility

- **Plugins**: No extension API.
- **Remote Control**: No network transparency or remote server mode.
- **User Accounts**: Local-only state. No cloud sync of presets/favorites.

### 5. Advanced UX

- **Multiple VFOs**: Single active VFO only.
- **Scanning**: No automated frequency scanning or memory banks.
- **Mobile Support**: Desktop/Laptop form factor optimization only. Touch support is "best effort".

## "Not In MVP Even If Easy"

To avoid scope creep, even "low hanging fruit" is excluded if it doesn't serve the core loop.

- **Theming**: Dark mode is the only mode. No light mode or custom themes.
- **Localization**: English only.
- **Keyboard Mapping**: Hardcoded shortcuts only; no user remapping.
- **Frequency Manager**: No "Favorites" list or frequency database integration.

## Rationale

The MVP must prove the **technical architecture** (WebUSB performance, DSP worker stability, AudioWorklet latency) and the **UX Core** (tuning, listening, seeing). Adding features like digital modes or recording distracts from stabilizing the critical rendering and processing path.
