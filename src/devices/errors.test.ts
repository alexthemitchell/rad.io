import { describe, expect, it } from 'vitest';
import { normalizeDeviceError, SDRDeviceError } from './errors';

describe('normalizeDeviceError', () => {
    it('maps NotFoundError to DEVICE_NOT_FOUND', () => {
        const err = normalizeDeviceError({ name: 'NotFoundError' } as DOMException);
        expect(err.code).toBe('DEVICE_NOT_FOUND');
    });

    it('preserves SDRDeviceError instances', () => {
        const base = new SDRDeviceError('UNKNOWN', 'x');
        const out = normalizeDeviceError(base);
        expect(out).toBe(base);
    });

    it('maps NetworkError transfer failures to USB_TRANSFER_FAILED', () => {
        const err = normalizeDeviceError({
            name: 'NetworkError',
            message: "Failed to execute 'controlTransferOut' on 'USBDevice': A transfer error has occurred."
        } as DOMException);

        expect(err.code).toBe('USB_TRANSFER_FAILED');
        expect(err.message).toContain('Unplug/replug HackRF');
    });
});
