import { useEffect, useState } from "react";
import { useUSBDevice } from "./useUSBDevice";
import { HackRFOne } from "../models/HackRFOne";

export function useHackRFDevice() {
  const [device, setDevice] = useState<HackRFOne>();
  const { device: usbDevice, requestDevice } = useUSBDevice([
    {
      // HackRF devices
      vendorId: 0x1d50,
    },
  ]);

  const cleanup = () => {
    device?.close().catch(console.error);
  };
  useEffect(() => {
    if (!usbDevice) {
      return;
    }
    if (!usbDevice.opened) {
      const hackRF = new HackRFOne(usbDevice);
      hackRF.open().then(() => setDevice(hackRF));
    }
  }, [usbDevice]);
  useEffect(() => {
    return cleanup;
  }, [device]);

  return {
    device,
    initialize: requestDevice,
    cleanup,
  };
}
