# WebUSB SDR Practical Gotchas

- User gesture: connect must be triggered by click; retries needed if dialog canceled.
- HTTPS only: localhost exception exists but enforce secure context checks.
- Endpoint sizes: 512/1024 bytes typical; request multiples to avoid short packets.
- Transfer pacing: queue next transfer immediately after previous resolves; keep 2–3 inflight for throughput.
- Hot‑unplug: watch for NetworkError; cleanup interface/streams; update UI.
- Power/ports: prefer USB 3.0; avoid unpowered hubs.
- Sample parsing: Int8 (HackRF) vs Uint8 (RTL‑SDR) normalization differences.
- Backpressure: if UI can’t keep up, drop visualization frames first; keep DSP chain real‑time.

Code links

- Models: src/models/HackRFOne.ts, HackRFOneAdapter.ts
- Hooks: src/hooks/useUSBDevice.ts, useHackRFDevice.ts
- Debug: WEBUSB_STREAMING_DEBUG_GUIDE
