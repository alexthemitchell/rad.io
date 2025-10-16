import { useState } from "react";

export const useUSBDevice = (
  filters: USBDeviceFilter[],
): {
  device: USBDevice | undefined;
  requestDevice: () => Promise<void>;
} => {
  const [device, setDevice] = useState<USBDevice>();
  const requestDevice = async (): Promise<void> => {
    const device = await navigator.usb.requestDevice({
      filters,
    });
    setDevice(device);
  };
  return {
    requestDevice,
    device,
  };
};
