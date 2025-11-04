/**
 * Device Integration Hook
 *
 * Bridges React hooks (useUSBDevice) with Zustand store for device management.
 * This hook should be called once at the app level to set up device management.
 */

import { useEffect, useCallback, useRef } from "react";
import { SDRDriverRegistry, registerBuiltinDrivers } from "../drivers";
import { MockSDRDevice } from "../models/MockSDRDevice";
import { useStore } from "../store";
import { getDeviceId } from "../store/slices/deviceSlice";
import { shouldUseMockSDR } from "../utils/e2e";
import { deviceLogger } from "../utils/logger";
import { useUSBDevice } from "./useUSBDevice";

/**
 * Initialize device management integration
 * Call this once at the app level (e.g., in App.tsx)
 */
export function useDeviceIntegration(): void {
  const { addDevice, setIsCheckingPaired, closeAllDevices } = useStore();

  // Track if mock device has been initialized to avoid redundant checks
  const mockInitializedRef = useRef(false);

  // Register built-in drivers on mount
  useEffect(() => {
    registerBuiltinDrivers();
  }, []);

  // Use the existing useUSBDevice hook for device discovery
  const {
    device: usbDevice,
    requestDevice: usbRequestDevice,
    isCheckingPaired,
  } = useUSBDevice(SDRDriverRegistry.getAllUSBFilters());

  // Sync isCheckingPaired state
  useEffect(() => {
    setIsCheckingPaired(isCheckingPaired);
  }, [isCheckingPaired, setIsCheckingPaired]);

  /**
   * Initialize a USB device when it's connected
   */
  const initializeDevice = useCallback(
    async (usb: USBDevice): Promise<void> => {
      const deviceId = getDeviceId(usb);

      try {
        // Use driver registry to automatically select the correct adapter
        const adapter = await SDRDriverRegistry.createDevice(usb);

        // Ensure device is ready: always invoke adapter.open()
        await adapter.open();

        // Add to store
        addDevice(deviceId, { device: adapter, usbDevice: usb });

        deviceLogger.info("Device initialized", {
          deviceId,
          deviceInfo: await adapter.getDeviceInfo(),
        });
      } catch (err) {
        deviceLogger.error("Failed to initialize device", err, {
          deviceId,
          productId: usb.productId,
          vendorId: usb.vendorId,
          wasOpened: usb.opened,
        });
        throw err;
      }
    },
    [addDevice],
  );

  /**
   * Connect a previously paired USB device without opening the native picker
   */
  const connectPairedUSBDevice = useCallback(
    async (usb: USBDevice): Promise<void> => {
      // Ensure we switch the primary device to the selected one
      await closeAllDevices();
      await initializeDevice(usb);
    },
    [initializeDevice, closeAllDevices],
  );

  // Set the functions in the store so components can call them
  // Use direct store update to avoid effect dependency loops if setter identities change
  useEffect(() => {
    useStore.setState({
      requestDevice: usbRequestDevice,
      connectPairedUSBDevice,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usbRequestDevice, connectPairedUSBDevice]);

  /**
   * Initialize USB device when it becomes available
   */
  useEffect(() => {
    if (!usbDevice) {
      return;
    }

    void initializeDevice(usbDevice);
  }, [usbDevice, initializeDevice]);

  /**
   * E2E/CI mock mode: create a mock SDR device when flag is enabled
   */
  const useMock = shouldUseMockSDR();
  useEffect(() => {
    if (!useMock) {
      return;
    }
    // Only create a mock device if we haven't already initialized one
    if (mockInitializedRef.current) {
      return;
    }

    const setupMock = async (): Promise<void> => {
      try {
        const mock = new MockSDRDevice();
        await mock.open();
        addDevice("mock:device", { device: mock });
        mockInitializedRef.current = true;
        deviceLogger.info("Mock SDR device initialized for E2E", {
          reason: "shouldUseMockSDR()",
        });
      } catch (err) {
        deviceLogger.error("Failed to initialize mock SDR device", err);
      }
    };
    void setupMock();
  }, [useMock, addDevice]);

  /**
   * Cleanup all devices on unmount only
   */
  useEffect(() => {
    return (): void => {
      closeAllDevices().catch((err: unknown) =>
        deviceLogger.error("Cleanup failed during unmount", err),
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount/unmount
}
