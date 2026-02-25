import type { DeviceDebugSnapshot } from './ISDRDevice';

export type StableDeviceIdentity = {
  key: string;
  fallbackUsed: boolean;
};

const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, '-');

export const deriveStableDeviceIdentity = (
  sourceType: 'MOCK' | 'HACKRF' | 'RTLSDR' | 'FILE',
  deviceName: string,
  snapshot: DeviceDebugSnapshot | null
): StableDeviceIdentity => {
  const serial = snapshot?.descriptor?.serialNumber?.trim();
  if (serial) {
    return {
      key: `${sourceType}:${normalize(deviceName)}:sn-${normalize(serial)}`,
      fallbackUsed: false
    };
  }

  const vendor = snapshot?.descriptor?.vendorId ?? 0;
  const product = snapshot?.descriptor?.productId ?? 0;
  const manufacturer = snapshot?.descriptor?.manufacturerName ?? 'unknown-mfg';
  const productName = snapshot?.descriptor?.productName ?? deviceName;

  return {
    key: `${sourceType}:${normalize(manufacturer)}:${normalize(productName)}:${vendor.toString(16)}:${product.toString(16)}`,
    fallbackUsed: true
  };
};
