import { describe, expect, it } from 'vitest';
import { deriveStableDeviceIdentity } from './deviceIdentity';

describe('deviceIdentity', () => {
  it('prefers serial-backed identity key when serial exists', () => {
    const identity = deriveStableDeviceIdentity('HACKRF', 'HackRF One', {
      driver: 'HackRFDevice',
      capturedAt: new Date().toISOString(),
      descriptor: {
        vendorId: 0x1d50,
        productId: 0x6089,
        serialNumber: 'ABC-123'
      }
    });

    expect(identity.fallbackUsed).toBe(false);
    expect(identity.key).toContain('sn-abc-123');
  });

  it('falls back to descriptor fingerprint when serial is unavailable', () => {
    const identity = deriveStableDeviceIdentity('HACKRF', 'HackRF One', {
      driver: 'HackRFDevice',
      capturedAt: new Date().toISOString(),
      descriptor: {
        vendorId: 0x1d50,
        productId: 0x6089,
        manufacturerName: 'Great Scott Gadgets',
        productName: 'HackRF One'
      }
    });

    expect(identity.fallbackUsed).toBe(true);
    expect(identity.key).toContain('great-scott-gadgets');
    expect(identity.key).toContain('1d50');
    expect(identity.key).toContain('6089');
  });
});
