import { useState } from "react";

export const useUSBDevice = (filters: USBDeviceFilter[]) => {
  const [device, setDevice] = useState<USBDevice>();
  const requestDevice = async () => {
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
