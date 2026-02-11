# Data Privacy & Security Policy

## 1. Principles
rad.io is a **local-first** application. We prioritize user privacy and data sovereignty.

1.  **Local Processing:** All DSP and audio processing happens in the browser. No audio or IQ data is sent to the cloud.
2.  **Explicit Consent:** We never access USB devices or microphone inputs without a user-initiated gesture (click).
3.  **Transparency:** Telemetry is opt-in and clearly disclosed.

## 2. Device Access (WebUSB)
- **Permission Model:** We rely on the browser's native WebUSB permission prompt.
- **Persistence:** We store the `vendorId` and `productId` of paired devices in `localStorage` to facilitate reconnection, but we do not fingerprint the user based on this.

## 3. Data Storage
- **Settings:** Stored in `localStorage`.
- **Recordings:** Stored in `IndexedDB` (locally).
- **Retention:** Users must explicitly delete recordings; we do not auto-delete unless a quota policy is set (future).

## 4. Telemetry (Planned)
- **Scope:** Crash reports, performance metrics (FPS, drops).
- **Exclusions:** No frequency data, no audio snippets, no location data.
- **Opt-In:** Users must enable "Share Diagnostics" in settings.

## 5. Third-Party Services
- **None.** The MVP operates entirely client-side. (Future: Proxy services for CORS headers if needed, but TBD).
