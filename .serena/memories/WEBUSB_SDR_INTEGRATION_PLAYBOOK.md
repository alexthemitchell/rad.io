Purpose: Reliable, low-noise playbook for WebUSB SDR device integration and debugging in rad.io.

Prereqs & constraints
- HTTPS context only; requires explicit user gesture to connect.
- Device drivers/firmware must be healthy (verify with vendor tools first).

Canonical sequence (HackRF example)
```ts
await device.open();
await device.selectConfiguration(1);
await device.claimInterface(0);
await device.setSampleRate(20_000_000); // CRITICAL: set first
await device.setFrequency(100_000_000);
await device.setBandwidth(20_000_000); // optional
await device.setLNAGain(16);           // optional
await device.setAmpEnable(false);      // optional
await device.receive(handleChunk);     // sets transceiver mode RECEIVE
```

Data formats
- HackRF: Int8 interleaved IQ → normalize via v/128 to ±1.0.
- RTL-SDR: Uint8 interleaved IQ (127 offset) → (v-127)/128.

Robust streaming loop
- Add timeout guards around `transferIn` to avoid infinite hangs.
- Count consecutive empty transfers; bail out after threshold.
- Track `activeBuffers` to monitor memory usage and clear on stop.

User-assisted flows
- Expect a browser device picker. Provide instructions in UI and retry logic.
- Ask user to unplug/replug or press device reset if stuck.

Diagnostics to log
- Opened state, configuration index, claimed interface
- Sample rate, frequency, bandwidth, gains
- Endpoint numbers; transfer size requested/received; result.status
- Parsed sample count and first-sample preview

Common failure patterns
- "Receiving" but no data → sample rate not set before receive().
- transferIn hangs → wrong endpoint/interface or device not configured.
- Visualizations blank → parseSamples returns empty or React updates throttled too aggressively.

References
- `src/models/HackRFOne.ts`, `src/models/HackRFOneAdapter.ts`
- Debug guide: `WEBUSB_STREAMING_DEBUG_GUIDE`
- MDN WebUSB API