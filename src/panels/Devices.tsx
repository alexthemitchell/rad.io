import React from "react";

/**
 * Devices panel/page for WebUSB SDR management
 *
 * Purpose: WebUSB SDR management (RTL-SDR, HackRF), per-device settings, connection recovery
 * Dependencies: ADR-0002 (Web Worker DSP), WebUSB integration
 *
 * Features to implement:
 * - Device discovery and connection
 * - Device claim/release
 * - Per-device settings (sample rate, gain, PPM, bias-T, direct sampling)
 * - Test mode
 * - Connection health and recovery
 *
 * Success criteria:
 * - Support 4+ devices
 * - <5ms sync skew target (future multi-device)
 *
 * TODO: Implement device discovery UI
 * TODO: Add connection/claim controls
 * TODO: Add per-device settings panels
 * TODO: Implement connection recovery logic
 * TODO: Add test mode for validation
 * TODO: Support multiple devices with sync
 */
interface DevicesProps {
  isPanel?: boolean; // True when rendered as a side panel, false for full-page route
}

function Devices({ isPanel = false }: DevicesProps): React.JSX.Element {
  const containerClass = isPanel ? "panel-container" : "page-container";

  return (
    <div
      className={containerClass}
      role={isPanel ? "complementary" : "main"}
      aria-labelledby="devices-heading"
    >
      <h2 id="devices-heading">Devices</h2>

      <section aria-label="Device Discovery">
        <h3>Available Devices</h3>
        {/* TODO: Device discovery with WebUSB */}
        {/* TODO: Connect/Claim buttons */}
        <button>Scan for Devices</button>
        <p>No devices found. Click &ldquo;Scan for Devices&rdquo; to search.</p>
      </section>

      <section aria-label="Connected Devices">
        <h3>Connected Devices</h3>
        {/* TODO: List of connected devices with status */}
        {/* TODO: Device settings (sample rate, gain, PPM, bias-T) */}
        {/* TODO: Connection health indicators */}
        <p>No devices connected yet.</p>
      </section>

      <section aria-label="Device Settings">
        {/* TODO: Per-device configuration panel */}
        {/* Sample rate, gain, PPM correction, bias-T, direct sampling */}
        <h3>Device Configuration</h3>
        <p>Select a device to configure settings.</p>
      </section>

      <section aria-label="Test Mode">
        <h3>Test Mode</h3>
        {/* TODO: Test signal generation and validation */}
        <p>Test mode coming soon</p>
      </section>
    </div>
  );
}

export default Devices;
