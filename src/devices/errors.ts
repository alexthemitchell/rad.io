export type SDRDeviceErrorCode =
    | 'PERMISSION_DENIED'
    | 'DEVICE_NOT_FOUND'
    | 'DEVICE_BUSY'
    | 'DEVICE_DISCONNECTED'
    | 'USB_STALL'
    | 'USB_TRANSFER_FAILED'
    | 'STREAM_START_FAILED'
    | 'STREAM_RUNTIME_FAILED'
    | 'UNKNOWN';

export class SDRDeviceError extends Error {
    constructor(
        public readonly code: SDRDeviceErrorCode,
        message: string,
        public readonly cause?: unknown
    ) {
        super(message);
        this.name = 'SDRDeviceError';
    }
}

export function normalizeDeviceError(error: unknown): SDRDeviceError {
    if (error instanceof SDRDeviceError) {
        return error;
    }

    const domError = error as Partial<DOMException> & { message?: string };
    const message = domError.message ?? '';

    if (domError.name === 'NotFoundError') {
        return new SDRDeviceError('DEVICE_NOT_FOUND', 'No device selected. Choose a device and try again.', error);
    }

    if (domError.name === 'NotAllowedError' || domError.name === 'SecurityError') {
        return new SDRDeviceError('PERMISSION_DENIED', 'Permission denied. Grant USB/audio permissions and retry.', error);
    }

    if (domError.name === 'InvalidStateError') {
        return new SDRDeviceError('DEVICE_BUSY', 'Device is already claimed by another app/tab. Close the other session and retry.', error);
    }

    if (domError.name === 'NotReadableError' || domError.name === 'AbortError') {
        return new SDRDeviceError('DEVICE_DISCONNECTED', 'Device became unavailable. Reconnect the device, then start streaming again.', error);
    }

    if (/clearhalt|stall|endpoint halt/i.test(message)) {
        return new SDRDeviceError(
            'USB_STALL',
            'USB endpoint stalled during streaming. Replug the device and retry, or switch to Stable latency mode.',
            error
        );
    }

    if (/disconnected|unavailable|closed while|device disappeared/i.test(message)) {
        return new SDRDeviceError(
            'DEVICE_DISCONNECTED',
            'Device disconnected during operation. Reconnect and retry.',
            error
        );
    }

    if (domError.name === 'NetworkError') {
        if (/transfer error/i.test(message)) {
            return new SDRDeviceError(
                'USB_TRANSFER_FAILED',
                'USB transfer failed while configuring the radio. Unplug/replug HackRF, close other SDR apps, then retry.',
                error
            );
        }

        return new SDRDeviceError('DEVICE_BUSY', 'Device busy or unavailable. Disconnect other apps and retry.', error);
    }

    if (/already claimed|claimed by another|busy/i.test(message)) {
        return new SDRDeviceError('DEVICE_BUSY', 'Device is already claimed by another app/tab. Close the other session and retry.', error);
    }

    if (message) {
        return new SDRDeviceError('STREAM_START_FAILED', message, error);
    }

    return new SDRDeviceError('UNKNOWN', 'Unable to start stream due to an unknown error.', error);
}
