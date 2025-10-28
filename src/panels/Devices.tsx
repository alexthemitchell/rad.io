import { useState, useEffect } from "react";
import { useDevice } from "../contexts/DeviceContext";
import { notify } from "../lib/notifications";
import { formatFrequency, formatSampleRate } from "../utils/frequency";
import { extractUSBDevice, formatUsbId } from "../utils/usb";

/**
 * Devices panel/page for WebUSB SDR management
 *
 * Purpose: WebUSB SDR management (RTL-SDR, HackRF), per-device settings, connection recovery
 * Dependencies: ADR-0002 (Web Worker DSP), WebUSB integration
 *
 * Features:
 * - Device discovery and connection
 * - Device claim/release
 * - Per-device settings (sample rate, gain, PPM)
 * - Connection health display
 *
 * Success criteria:
 * - Support 4+ devices
 * - <5ms sync skew target (future multi-device)
 *
 * TODO: Add per-device settings panels (gain control, PPM correction)
 * TODO: Implement connection recovery logic
 * TODO: Add test mode for validation
 * TODO: Support multiple devices with sync
 */
interface DevicesProps {
  isPanel?: boolean; // True when rendered as a side panel, false for full-page route
}

// WebUSB adapter extraction lives in src/utils/usb.ts

function Devices({ isPanel = false }: DevicesProps): React.JSX.Element {
  const { device, initialize, cleanup, isCheckingPaired } = useDevice();
  // Unified notifications

  const [sampleRate, setSampleRate] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{
    productName?: string;
    serialNumber?: string;
    vendorId?: number;
    productId?: number;
  }>({});

  // Load device info and settings when device connects
  useEffect(() => {
    if (!device) {
      return;
    }

    const loadDeviceInfo = async (): Promise<void> => {
      try {
        const rate = await device.getSampleRate();
        setSampleRate(rate);

        const freq = await device.getFrequency();
        setFrequency(freq);

        // Get device info (on the underlying USB device) if exposed by adapter
        const usbDevice: USBDevice | undefined = extractUSBDevice(
          device as unknown,
        );
        if (usbDevice) {
          setDeviceInfo({
            productName: usbDevice.productName ?? undefined,
            serialNumber: usbDevice.serialNumber ?? undefined,
            vendorId: usbDevice.vendorId,
            productId: usbDevice.productId,
          });
        }

        notify({
          message: "Device connected successfully",
          sr: "polite",
          visual: true,
          tone: "success",
        });
      } catch (error) {
        console.error("Failed to load device info:", error);
      }
    };

    void loadDeviceInfo();
  }, [device]);

  const handleScanForDevices = async (): Promise<void> => {
    try {
      await initialize();
      notify({ message: "Device picker opened", sr: "polite", visual: false });
    } catch (error) {
      console.error("Failed to initialize device:", error);
      notify({
        message: "Failed to open device picker",
        sr: "assertive",
        visual: true,
        tone: "error",
      });
    }
  };

  const handleDisconnect = (): void => {
    void cleanup();
    setSampleRate(null);
    setFrequency(null);
    setDeviceInfo({});
    notify({
      message: "Device disconnected",
      sr: "polite",
      visual: true,
      tone: "warning",
    });
  };

  const containerClass = isPanel ? "panel-container" : "page-container";

  return (
    <div
      className={containerClass}
      role={isPanel ? "complementary" : "main"}
      aria-labelledby="devices-heading"
    >
      <h2 id="devices-heading">Devices</h2>

      {!device && !isCheckingPaired && (
        <section aria-label="Device Discovery">
          <h3>Available Devices</h3>
          <p>
            Click the button below to open the device picker and select your SDR
            device.
          </p>
          <button
            onClick={(): void => {
              void handleScanForDevices();
            }}
            disabled={isCheckingPaired}
          >
            Scan for Devices
          </button>
        </section>
      )}

      {isCheckingPaired && (
        <section aria-label="Checking for Devices">
          <p>Checking for previously paired devices...</p>
        </section>
      )}

      {device && (
        <>
          <section aria-label="Connected Device">
            <h3>Connected Device</h3>
            <dl className="device-info">
              <dt>Device:</dt>
              <dd>{deviceInfo.productName ?? "Unknown Device"}</dd>

              {deviceInfo.serialNumber && (
                <>
                  <dt>Serial Number:</dt>
                  <dd>{deviceInfo.serialNumber}</dd>
                </>
              )}

              {deviceInfo.vendorId && deviceInfo.productId && (
                <>
                  <dt>USB ID:</dt>
                  <dd>
                    {formatUsbId(deviceInfo.vendorId, deviceInfo.productId)}
                  </dd>
                </>
              )}

              <dt>Status:</dt>
              <dd className="status-connected">
                {device.isOpen() ? "Connected" : "Disconnected"}
              </dd>
            </dl>

            <button onClick={handleDisconnect}>Disconnect Device</button>
          </section>

          <section aria-label="Device Settings">
            <h3>Current Settings</h3>
            <dl className="device-settings">
              <dt>Frequency:</dt>
              <dd>{frequency ? formatFrequency(frequency) : "--"}</dd>

              <dt>Sample Rate:</dt>
              <dd>{sampleRate ? formatSampleRate(sampleRate) : "--"}</dd>
            </dl>

            <p>
              <small>
                To change device settings, use the controls on the Monitor page.
              </small>
            </p>
          </section>

          <section aria-label="Connection Health">
            <h3>Connection Health</h3>
            <dl className="connection-health">
              <dt>Connection:</dt>
              <dd className="status-good">Stable</dd>

              <dt>Buffer Health:</dt>
              <dd className="status-good">100%</dd>
            </dl>
          </section>
        </>
      )}

      <section aria-label="Help">
        <h3>WebUSB Support</h3>
        <p>
          This application uses WebUSB to connect directly to SDR hardware.
          Currently supported devices:
        </p>
        <ul>
          <li>HackRF One (VID 0x1d50)</li>
        </ul>
        <p>
          <strong>Note:</strong> WebUSB requires HTTPS (or localhost for
          development) and a compatible browser (Chrome, Edge, Opera).
        </p>
      </section>
    </div>
  );
}

export default Devices;
