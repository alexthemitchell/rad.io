import { useEffect, useState } from "react";
import { useUSBDevice } from "./useUSBDevice";
import { HackRFDevice } from "../models/HackRFDevice";

export function useHackRFDevice() {
  const [device, setDevice] = useState<HackRFDevice>();
  const { device: usbDevice, requestDevice } = useUSBDevice([
    {
      // HackRF devices
      vendorId: 0x1d50,
    },
  ]);

  useEffect(() => {
    if (!usbDevice) {
      return;
    }
    if (!usbDevice.opened) {
      HackRFDevice.openDevice(usbDevice).then(setDevice);
    }
  }, [usbDevice]);
  useEffect(() => {
    return () => {
      device?.close().catch(console.error);
    };
  }, [device]);

  return {
    device,
    initialize: requestDevice,
  };
}
