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
  const addDevice = useStore((s) => s.addDevice);
  const closeAllDevices = useStore((s) => s.closeAllDevices);
  // Global guard across HMR reloads to avoid duplicated device sessions
  // and to offer a centralized shutdown callable from HMR/beforeunload.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore augment global at runtime without declaring ambient types
  interface GlobalWithRadio {
    radIo?: Record<string, unknown>;
  }
  const globalWithRadio = globalThis as unknown as GlobalWithRadio;
  const globalRad = (globalWithRadio.radIo ??= {});

  // Track closing state on the global to let new code paths short-circuit.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore runtime attachment only
  globalRad["closing"] = globalRad["closing"] ?? false;

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

  // Sync isCheckingPaired state with equality guard to avoid redundant updates
  useEffect(() => {
    const curr = useStore.getState().isCheckingPaired;
    if (curr !== isCheckingPaired) {
      useStore.setState({ isCheckingPaired });
    }
  }, [isCheckingPaired]);

  /**
   * Initialize a USB device when it's connected
   */
  const initializeDevice = useCallback(
    async (usb: USBDevice): Promise<void> => {
      // Skip initialization if a shutdown is in progress (e.g., HMR dispose)
      if (globalRad["closing"]) {
        deviceLogger.warn("Skipping device init during shutdown phase", {
          reason: "global closing",
        });
        return;
      }
      const deviceId = getDeviceId(usb);

      try {
        // Use driver registry to automatically select the correct adapter
        const adapter = await SDRDriverRegistry.createDevice(usb);

        // Ensure device is ready: always invoke adapter.open()
        await adapter.open();

        // Add to store
        addDevice(deviceId, { device: adapter, usbDevice: usb });

        // In development, expose primary device on global for debugging
        if (process.env["NODE_ENV"] === "development") {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore runtime global
          globalRad["primaryDevice"] = adapter;
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addDevice], // globalRad is a runtime global, not a React dependency
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

  // Stable function proxies: keep latest implementations via refs
  const requestRef = useRef(usbRequestDevice);
  const connectRef = useRef(connectPairedUSBDevice);
  useEffect(() => {
    requestRef.current = usbRequestDevice;
  }, [usbRequestDevice]);
  useEffect(() => {
    connectRef.current = connectPairedUSBDevice;
  }, [connectPairedUSBDevice]);

  // Expose stable wrappers in the store once (mount-only)
  useEffect(() => {
    useStore.setState({
      requestDevice: async (...args: unknown[]) =>
        // @ts-expect-error propagate args
        await requestRef.current(...args),
      connectPairedUSBDevice: async (usb: USBDevice) =>
        await connectRef.current(usb),
    });
  }, []);

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
      // Reset mock initialization flag when mock mode is disabled
      mockInitializedRef.current = false;
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
    // Expose a global shutdown that HMR dispose / beforeunload can call.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore attach runtime global function (idempotent)
    const g = (globalWithRadio.radIo ??= {});
    Object.assign(g, {
      // Provide an idempotent async shutdown
      shutdown: async (): Promise<void> => {
        try {
          g["closing"] = true;
          await closeAllDevices();
          // Terminate DSP workers if present
          try {
            const pool = g["dspWorkerPool"] as
              | { terminate: () => void }
              | undefined;
            pool?.terminate();
          } catch {
            // ignore worker termination errors during shutdown
          }
        } catch (err) {
          deviceLogger.error("Shutdown error during global teardown", err);
        } finally {
          // Keep closing true briefly; new init paths will skip until reload completes
          g["closing"] = false;
        }
      },
    });

    return (): void => {
      // Local unmount cleanup; do not await
      void closeAllDevices().catch((err: unknown) =>
        deviceLogger.error("Cleanup failed during unmount", err),
      );
      // Best-effort DSP worker termination on unmount
      try {
        const pool = globalRad["dspWorkerPool"] as
          | { terminate: () => void }
          | undefined;
        pool?.terminate();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeAllDevices]); // globalRad and globalWithRadio are runtime globals, not React dependencies
}
