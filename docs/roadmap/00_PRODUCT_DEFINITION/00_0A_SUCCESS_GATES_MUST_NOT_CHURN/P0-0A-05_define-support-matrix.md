# Support Matrix

## Browsers (Desktop)
**Requirement:** `WebUSB` and `AudioWorklet` support.

| Browser | OS | Support Level | Notes |
| :--- | :--- | :--- | :--- |
| **Chrome / Chromium** | Windows 10/11 | **Tier 1** | Primary dev target. Best driver support. |
| **Edge** | Windows 10/11 | **Tier 1** | Enterprise/Org standard. |
| **Chrome / Chromium** | macOS | **Tier 1** | |
| **Chrome / Chromium** | Linux | **Tier 2** | Requires udev rule setup (user friction). |
| **Firefox** | Any | **Unsupported** | No WebUSB support planned by Mozilla. |
| **Safari** | macOS | **Unsupported** | No WebUSB support. |

## Mobile / Tablet
**Requirement:** OTG Adapter + Android.

| Browser | OS | Support Level | Notes |
| :--- | :--- | :--- | :--- |
| **Chrome for Android** | Android 10+ | **Tier 2** | Works well, thermal/battery constraints apply. |
| **iOS / iPadOS** | iOS | **Unsupported** | No WebUSB access on iOS. |

## Hardware Constraints
- **RAM:** Minimum 4GB (8GB recommended).
- **CPU:** Dual-core 2GHz+ (DSP runs in Worker).
- **USB:** USB 2.0 High Speed minimum.
