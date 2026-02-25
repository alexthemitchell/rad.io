import {
    DeviceGpioPatch,
    DeviceGpioState,
    DeviceDebugSnapshot,
    DeviceDriverState,
    DeviceFrontEndCorrectionPatch,
    DeviceFrontEndCorrectionState,
    DeviceIqControlPatch,
    DeviceIqControlState,
    DeviceRfPowerPatch,
    DeviceRfPowerState,
    DeviceStateMachineSnapshot,
    DeviceStreamContinuityContract,
    DeviceSweepCapability,
    ISDRDevice,
    SDRDataCallback,
    SDRGainStage
} from './ISDRDevice';
import type { SDRDiscontinuityCause, SDRDiscontinuityEvent } from './streamFrame';
import { defaultCapabilityModel, type DeviceCapabilityModel } from './CapabilityModel';
import { recommendUsbStreamingProfile } from '../measurements/usbStreamingPolicy';

// HackRF One Constants
const HACKRF_USB_VID = 0x1d50;
const HACKRF_USB_PID = 0x6089;
const HACKRF_BOOTLOADER_USB_PIDS = new Set([0x608b, 0x608c]);

enum HackRFCommand {
    SET_TRANSCEIVER_MODE = 1,
    SET_FREQ = 16,
    SET_SAMPLE_RATE = 6,
    BASEBAND_FILTER_BANDWIDTH_SET = 7,
    SET_LNA_GAIN = 19,
    SET_VGA_GAIN = 20,
    SET_AMP_ENABLE = 17,
    SET_ANTENNA_ENABLE = 23,
    BOARD_ID_READ = 14,
    VERSION_STRING_READ = 15,
}

type HackRfDescriptorSelection = {
    interfaceIndex: number;
    alternateSetting: number;
    inEndpointNumber: number;
    warnings: string[];
    candidateCount: number;
};

const describeAlternate = (iface: USBInterface, alt: USBAlternateInterface): string => {
    const endpointSummary = alt.endpoints
        .map((endpoint) => `${endpoint.direction}:${endpoint.type}:ep${endpoint.endpointNumber}`)
        .join(', ');
    return `if=${iface.interfaceNumber} alt=${alt.alternateSetting} [${endpointSummary || 'no-endpoints'}]`;
};

export const resolveHackRfStreamingInterface = (config: USBConfiguration): HackRfDescriptorSelection => {
    const warnings: string[] = [];
    const candidates: Array<{
        iface: USBInterface;
        alt: USBAlternateInterface;
        inEndpoint: USBEndpoint;
    }> = [];
    const inspectedAlternates: string[] = [];

    for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
            inspectedAlternates.push(describeAlternate(iface, alt));

            const bulkInEndpoints = alt.endpoints.filter((endpoint) => endpoint.direction === 'in' && endpoint.type === 'bulk');
            if (bulkInEndpoints.length === 0) {
                continue;
            }

            const selectedEndpoint = [...bulkInEndpoints].sort((a, b) => a.endpointNumber - b.endpointNumber)[0];
            if (bulkInEndpoints.length > 1) {
                warnings.push(
                    `Interface ${iface.interfaceNumber} alt ${alt.alternateSetting} exposes ${bulkInEndpoints.length} bulk-in endpoints; selected ep${selectedEndpoint.endpointNumber}.`
                );
            }

            if (selectedEndpoint.packetSize < 256) {
                warnings.push(
                    `Interface ${iface.interfaceNumber} alt ${alt.alternateSetting} endpoint ep${selectedEndpoint.endpointNumber} packetSize=${selectedEndpoint.packetSize} may be unstable for IQ throughput.`
                );
            }

            candidates.push({ iface, alt, inEndpoint: selectedEndpoint });
        }
    }

    if (candidates.length === 0) {
        const detail = inspectedAlternates.length > 0
            ? inspectedAlternates.join('; ')
            : 'no USB interfaces/alternates exposed by descriptor';
        throw new Error(`HackRF descriptor has no bulk-in IQ endpoint candidate (${detail}).`);
    }

    const selected = [...candidates].sort((a, b) => {
        if (b.inEndpoint.packetSize !== a.inEndpoint.packetSize) {
            return b.inEndpoint.packetSize - a.inEndpoint.packetSize;
        }

        if (a.iface.interfaceNumber !== b.iface.interfaceNumber) {
            return a.iface.interfaceNumber - b.iface.interfaceNumber;
        }

        return a.alt.alternateSetting - b.alt.alternateSetting;
    })[0];

    if (candidates.length > 1) {
        warnings.push(`Multiple streaming candidates found (${candidates.length}); preferred largest packet-size path.`);
    }

    return {
        interfaceIndex: selected.iface.interfaceNumber,
        alternateSetting: selected.alt.alternateSetting,
        inEndpointNumber: selected.inEndpoint.endpointNumber,
        warnings,
        candidateCount: candidates.length
    };
};

export class HackRFDevice implements ISDRDevice {
    name = "HackRF One";
    private static readonly CONTROL_TRANSFER_TIMEOUT_MS = 1500;
    private static readonly MODE_SETTLE_DELAY_MS = 30;
    private static readonly STREAM_MAX_CONSECUTIVE_FAILURES = 8;
    private static readonly STREAM_RETRY_DELAY_MS = 20;
    private static readonly STREAM_TRANSFER_SIZE_BYTES = 16_384;
    private static readonly STALL_STORM_WINDOW_MS = 2_000;
    private static readonly STALL_STORM_THRESHOLD = 4;
    private device: USBDevice | null = null;
    private interfaceIndex = 0;
    private inEndpointNumber = 1;
    private isStreaming = false;

    private frequency = 90_000_000; 
    private sampleRate = 2_000_000;
    
    // Internal state for gains
    private lnaGain = 32;
    private vgaGain = 20;
    private ampEnable = 0;
    private sequence = 0;
    private sampleIndex = 0;
    private timestampNs = 0;
    private pendingDiscontinuity: SDRDiscontinuityCause | null = null;
    private lastTickWallClockMs = 0;
    private activeAlternateSetting = 0;
    private readonly usbTrace: NonNullable<DeviceDebugSnapshot['recentTrace']> = [];
    private debugCounters: NonNullable<DeviceDebugSnapshot['counters']> = {
        controlInCount: 0,
        controlOutCount: 0,
        bulkInCount: 0,
        bulkInErrorCount: 0,
        shortPacketCount: 0,
        retryCount: 0,
        stallRecoveryCount: 0,
        lastTransferBytes: 0,
        lastTransferStatus: 'n/a',
        transferRateBps: 0,
        transferIntervalMsAvg: 0,
        transferIntervalMsJitter: 0,
        shortPacketRatio: 0,
        transferCadenceExpectedMs: 0,
        transferBurstiness01: 0,
        longGapCount: 0
    };
    private lastTransferAtMs: number | null = null;
    private rateWindowStartedAtMs = performance.now();
    private rateWindowBytes = 0;
    private intervalEwmaMs = 0;
    private intervalJitterEwmaMs = 0;
    private streamTransferSizeBytes = HackRFDevice.STREAM_TRANSFER_SIZE_BYTES;
    private streamRetryDelayMs = HackRFDevice.STREAM_RETRY_DELAY_MS;
    private streamMaxConsecutiveFailures = HackRFDevice.STREAM_MAX_CONSECUTIVE_FAILURES;
    private streamProfileName: 'low-latency' | 'balanced' | 'stable' | 'custom' = 'balanced';
    private boardId: number | null = null;
    private firmwareVersion = 'unknown';
    private recentStallCount = 0;
    private recentStallWindowStartedAtMs = 0;

    private isBootloaderPersonality(device: Pick<USBDevice, 'productId' | 'productName'>): boolean {
        if (HACKRF_BOOTLOADER_USB_PIDS.has(device.productId)) {
            return true;
        }

        return /bootloader|dfu/i.test(device.productName ?? '');
    }

    private buildBootloaderRecoveryMessage(device: Pick<USBDevice, 'productId' | 'productName'>): string {
        const label = device.productName ?? `USB PID 0x${device.productId.toString(16)}`;
        return `Detected HackRF in bootloader/DFU mode (${label}). Flash normal firmware, power-cycle/replug the device, then retry Start.`;
    }
    private descriptorWarnings: string[] = [];
    private descriptorCandidateCount = 0;
    private iqControlState: DeviceIqControlState = {
        swapEnabled: false,
        invertEnabled: false,
        implementation: 'none'
    };
    private frontEndCorrectionState: DeviceFrontEndCorrectionState = {
        dcOffsetEnabled: false,
        iqBalanceEnabled: false,
        implementation: 'none'
    };
    private rfPowerState: DeviceRfPowerState = {
        biasTeeEnabled: false,
        ampEnabled: false
    };
    private gpioState: DeviceGpioState = {
        outputPins: {}
    };
    private driverState: DeviceDriverState = 'idle';
    private transitionCount = 0;
    private lastTransitionAtIso = new Date(0).toISOString();
    private lastStateEvent = 'init';

    private transitionState(next: DeviceDriverState, event: string): void {
        this.driverState = next;
        this.transitionCount += 1;
        this.lastStateEvent = event;
        this.lastTransitionAtIso = new Date().toISOString();
    }

    private updateTransferTelemetry(bytes: number, transferSize: number): void {
        const nowMs = performance.now();
        const expectedCadenceMs = Math.max(0.01, ((transferSize / 2) / Math.max(1, this.sampleRate)) * 1000);
        this.debugCounters.transferCadenceExpectedMs = expectedCadenceMs;

        this.rateWindowBytes += bytes;
        const windowElapsedMs = nowMs - this.rateWindowStartedAtMs;
        if (windowElapsedMs >= 250) {
            this.debugCounters.transferRateBps = Math.max(0, (this.rateWindowBytes * 1000) / windowElapsedMs);
            this.rateWindowBytes = 0;
            this.rateWindowStartedAtMs = nowMs;
        }

        if (this.lastTransferAtMs !== null) {
            const intervalMs = Math.max(0, nowMs - this.lastTransferAtMs);
            if (this.intervalEwmaMs <= 0) {
                this.intervalEwmaMs = intervalMs;
            } else {
                this.intervalEwmaMs = (this.intervalEwmaMs * 0.9) + (intervalMs * 0.1);
            }

            const jitterMs = Math.abs(intervalMs - this.intervalEwmaMs);
            this.intervalJitterEwmaMs = (this.intervalJitterEwmaMs * 0.9) + (jitterMs * 0.1);

            if (intervalMs > expectedCadenceMs * 1.8) {
                this.debugCounters.longGapCount += 1;
            }

            this.debugCounters.transferBurstiness01 = Math.max(
                0,
                Math.min(1, this.intervalJitterEwmaMs / Math.max(1, expectedCadenceMs))
            );

            this.debugCounters.transferIntervalMsAvg = this.intervalEwmaMs;
            this.debugCounters.transferIntervalMsJitter = this.intervalJitterEwmaMs;
        }

        this.lastTransferAtMs = nowMs;

        if (this.debugCounters.bulkInCount > 0) {
            this.debugCounters.shortPacketRatio = this.debugCounters.shortPacketCount / this.debugCounters.bulkInCount;
        }

        if (bytes < transferSize) {
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'bulk-short-packet',
                bytes,
                detail: `expected=${transferSize}`
            });
        }
    }

    private pushUsbTrace(event: NonNullable<DeviceDebugSnapshot['recentTrace']>[number]): void {
        this.usbTrace.push(event);
        if (this.usbTrace.length > 200) {
            this.usbTrace.shift();
        }
    }

    private markDiscontinuity(cause: SDRDiscontinuityCause): void {
        if (this.pendingDiscontinuity === 'restart') {
            return;
        }

        if (cause === 'restart' || this.pendingDiscontinuity === null) {
            this.pendingDiscontinuity = cause;
            return;
        }

        if (this.pendingDiscontinuity === 'sample_rate_change' && cause === 'retune') {
            return;
        }

        this.pendingDiscontinuity = cause;
    }

    private async withTimeout<T>(operation: Promise<T>, label: string, timeoutMs = HackRFDevice.CONTROL_TRANSFER_TIMEOUT_MS): Promise<T> {
        let timeoutHandle: number | undefined;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = window.setTimeout(() => {
                reject(new Error(`${label} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([operation, timeoutPromise]);
        } finally {
            if (timeoutHandle !== undefined) {
                window.clearTimeout(timeoutHandle);
            }
        }
    }

    private async vendorOut(
        request: number,
        value = 0,
        index = 0,
        data?: BufferSource
    ): Promise<void> {
        if (!this.device) {
            throw new Error('Device not open');
        }

        const startedAt = performance.now();
        try {
            const result = await this.withTimeout(this.device.controlTransferOut({
                requestType: 'vendor',
                recipient: 'device',
                request,
                value,
                index
            }, data), `controlTransferOut(device) req=${request}`);

            this.debugCounters.controlOutCount += 1;
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'control-out',
                status: result.status,
                request,
                bytes: data ? (data as ArrayBufferLike).byteLength ?? 0 : 0,
                durationMs: performance.now() - startedAt
            });

            if (result.status !== 'ok') {
                throw new Error(`controlTransferOut(device) status=${result.status} req=${request}`);
            }
        } catch (error) {
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'control-out-error',
                request,
                durationMs: performance.now() - startedAt,
                detail: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private async vendorIn(
        request: number,
        length: number,
        value = 0,
        index = 0
    ): Promise<DataView | null> {
        if (!this.device) {
            throw new Error('Device not open');
        }

        const startedAt = performance.now();
        try {
            const res = await this.withTimeout(this.device.controlTransferIn({
                requestType: 'vendor',
                recipient: 'device',
                request,
                value,
                index
            }, length), `controlTransferIn(device) req=${request}`);

            this.debugCounters.controlInCount += 1;
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'control-in',
                status: res.status,
                request,
                bytes: res.data?.byteLength ?? 0,
                durationMs: performance.now() - startedAt
            });

            if (res.status !== 'ok') {
                throw new Error(`controlTransferIn(device) status=${res.status} req=${request}`);
            }

            return res.data ?? null;
        } catch (error) {
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'control-in-error',
                request,
                durationMs: performance.now() - startedAt,
                detail: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private async sleep(ms: number): Promise<void> {
        await new Promise<void>((resolve) => {
            window.setTimeout(resolve, ms);
        });
    }

    private async setTransceiverMode(mode: 0 | 1): Promise<void> {
        try {
            await this.vendorOut(HackRFCommand.SET_TRANSCEIVER_MODE, mode, 0);
        } catch (modeError) {
            console.warn('Transceiver mode command failed; retrying once after handle recovery.', modeError);
            await this.recoverHandle();
            await this.vendorOut(HackRFCommand.SET_TRANSCEIVER_MODE, mode, 0);
        }
    }

    private async recoverHandle(): Promise<void> {
        if (!this.device) return;

        this.transitionState('recovering', 'recover-handle');

        try {
            if (this.device.opened) {
                await this.device.close();
            }
        } catch (closeError) {
            console.debug('Close during recovery failed:', closeError);
        }

        await this.openAndClaim(this.device);
        this.transitionState(this.isStreaming ? 'streaming' : 'open', 'recover-handle-complete');
    }

    private async recoverStreamingEndpoint(): Promise<boolean> {
        if (!this.device) {
            return false;
        }

        this.transitionState('recovering', 'recover-endpoint');

        try {
            await this.device.clearHalt('in', this.inEndpointNumber);
            this.debugCounters.stallRecoveryCount += 1;
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'clear-halt',
                status: 'ok',
                detail: `in endpoint ${this.inEndpointNumber}`
            });
            this.transitionState(this.isStreaming ? 'streaming' : 'open', 'recover-endpoint-complete');
            return true;
        } catch (clearHaltError) {
            console.debug('clearHalt(in) failed during streaming recovery:', clearHaltError);
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'clear-halt-error',
                detail: clearHaltError instanceof Error ? clearHaltError.message : String(clearHaltError)
            });
            this.transitionState('error', 'recover-endpoint-failed');
            return false;
        }
    }

    private classifyTransferFailure(error: unknown): 'stall' | 'disconnect' | 'unknown' {
        const detail = error instanceof Error
            ? error.message
            : typeof error === 'string'
                ? error
                : JSON.stringify(error ?? 'unknown');

        if (/stall|clearhalt|endpoint halt|halted|babble/i.test(detail)) {
            return 'stall';
        }

        if (/disconnected|unavailable|device disappeared|closed/i.test(detail)) {
            return 'disconnect';
        }

        return 'unknown';
    }

    private async recoverFromTransferFailure(kind: 'stall' | 'disconnect' | 'unknown'): Promise<void> {
        if (!this.device || !this.device.opened) {
            return;
        }

        if (kind === 'stall') {
            const endpointRecovered = await this.recoverStreamingEndpoint();
            if (!endpointRecovered) {
                this.pushUsbTrace({
                    ts: new Date().toISOString(),
                    event: 'clear-halt-escalate',
                    detail: 'clearHalt failed; escalating to handle reopen + RX reset'
                });
                await this.recoverHandle();
                await this.setTransceiverMode(0);
                await this.sleep(HackRFDevice.MODE_SETTLE_DELAY_MS);
                await this.setTransceiverMode(1);
                this.markDiscontinuity('reset');
                this.recentStallCount = 0;
                return;
            }

            const nowMs = performance.now();
            if (nowMs - this.recentStallWindowStartedAtMs > HackRFDevice.STALL_STORM_WINDOW_MS) {
                this.recentStallWindowStartedAtMs = nowMs;
                this.recentStallCount = 0;
            }

            this.recentStallCount += 1;
            if (this.recentStallCount < HackRFDevice.STALL_STORM_THRESHOLD) {
                return;
            }

            // Escalate repeated stalls to a handle + RX mode refresh.
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'stall-storm-recover',
                detail: `stallCount=${this.recentStallCount}`
            });
            await this.recoverHandle();
            await this.setTransceiverMode(0);
            await this.sleep(HackRFDevice.MODE_SETTLE_DELAY_MS);
            await this.setTransceiverMode(1);
            this.markDiscontinuity('reset');
            this.recentStallCount = 0;
            return;
        }

        if (kind === 'unknown') {
            await this.recoverHandle();
            this.markDiscontinuity('reset');
        }
    }

    private async probeDevice(): Promise<void> {
        if (!this.device) return;

        const boardData = await this.vendorIn(HackRFCommand.BOARD_ID_READ, 1, 0, 0);
        const versionData = await this.vendorIn(HackRFCommand.VERSION_STRING_READ, 64, 0, 0);

        const board = boardData?.getUint8(0);
        const rawVersion = versionData;
        const version = rawVersion
            ? new TextDecoder().decode(rawVersion.buffer).replace(/\0+$/, '')
            : 'unknown';

        this.boardId = board ?? null;
        this.firmwareVersion = version;

        console.log(`HackRF probe: board=${board ?? 'n/a'} version=${version}`);
    }

    private getCompatibilityStatus(): NonNullable<DeviceDebugSnapshot['compatibility']> {
        const knownGoodPrefix = ['2021.03.1', '2022.09.1', '2024.02.1'];
        const knownUnsupportedPrefix = ['2014.', '2015.', '2016.'];
        const version = this.firmwareVersion;
        const status = /dfu|bootloader/i.test(version)
            ? 'known-unsupported'
            : knownUnsupportedPrefix.some((prefix) => version.startsWith(prefix))
                ? 'known-unsupported'
                : knownGoodPrefix.some((prefix) => version.startsWith(prefix))
            ? 'known-good'
            : version === 'unknown'
                ? 'unknown'
                : 'unknown';

        let note = 'Firmware not in known-good list; continue with conservative defaults and diagnostics.';
        if (status === 'known-good') {
            note = 'Validated against current WebUSB profile defaults.';
        } else if (/dfu|bootloader/i.test(version)) {
            note = 'Device appears to be in DFU/bootloader mode; flash normal firmware and reconnect.';
        } else if (status === 'known-unsupported') {
            note = 'Firmware likely too old for reliable WebUSB streaming; update HackRF firmware and retry.';
        }

        return {
            boardId: this.boardId ?? undefined,
            firmwareVersion: version,
            status,
            note
        };
    }

    private getCompatibilityGatingDecision(): {
        blocked: boolean;
        forcedProfile?: 'balanced' | 'stable';
        message?: string;
    } {
        const compatibility = this.getCompatibilityStatus();
        if (compatibility.status === 'known-unsupported') {
            return {
                blocked: true,
                message: compatibility.note
            };
        }

        if (compatibility.status === 'unknown') {
            return {
                blocked: false,
                forcedProfile: 'balanced',
                message: 'Compatibility unknown; low-latency profile is gated to balanced defaults.'
            };
        }

        return {
            blocked: false
        };
    }

    getSweepCapability(): DeviceSweepCapability {
        return {
            hardwareSupported: false,
            fallbackMode: 'software-sweep-stitch',
            command: 'hackrf_sweep',
            note: 'hackrf_sweep requires host-native execution; WebUSB path falls back to software tune/settle/stitch.'
        };
    }

    private async openAndClaim(device: USBDevice): Promise<void> {
        if (!device.opened) {
            await device.open();
        }

        if (!device.configuration) {
            await device.selectConfiguration(1);
        }

        const config = device.configuration;
        if (!config) {
            throw new Error('HackRF configuration unavailable after selectConfiguration.');
        }

        const selected = resolveHackRfStreamingInterface(config);
        this.interfaceIndex = selected.interfaceIndex;
        this.inEndpointNumber = selected.inEndpointNumber;
        this.descriptorWarnings = selected.warnings;
        this.descriptorCandidateCount = selected.candidateCount;

        await device.claimInterface(this.interfaceIndex);

        const currentAlt = config.interfaces.find((i) => i.interfaceNumber === this.interfaceIndex)?.alternate?.alternateSetting;
        const targetAlt = selected.alternateSetting;

        if (
            typeof targetAlt === 'number' &&
            typeof currentAlt === 'number' &&
            targetAlt !== currentAlt
        ) {
            await device.selectAlternateInterface(this.interfaceIndex, targetAlt);
            this.activeAlternateSetting = targetAlt;
        } else {
            this.activeAlternateSetting = currentAlt ?? targetAlt ?? 0;
        }

        console.log(`Claimed interface=${this.interfaceIndex} inEp=${this.inEndpointNumber}`);
    }

    getGainStages(): SDRGainStage[] {
        return [
            { name: 'LNA', label: 'LNA Gain', min: 0, max: 40, step: 8, value: this.lnaGain },
            { name: 'VGA', label: 'VGA Gain', min: 0, max: 62, step: 2, value: this.vgaGain },
            { name: 'AMP', label: 'RF Amp (+14dB)', min: 0, max: 1, step: 1, value: this.ampEnable }
        ];
    }

    getCapabilityModel(): DeviceCapabilityModel {
        return {
            ...defaultCapabilityModel('HACKRF', this.name),
            supportedSampleRatesHz: [1_000_000, 2_000_000, 2_500_000, 5_000_000, 8_000_000, 10_000_000],
            supportedAnalogBandwidthsHz: [1_750_000, 2_500_000, 5_000_000, 10_000_000],
            gainStages: [
                { name: 'LNA', min: 0, max: 40, step: 8, order: 1 },
                { name: 'VGA', min: 0, max: 62, step: 2, order: 2 },
                { name: 'AMP', min: 0, max: 1, step: 1, order: 3, coupledWith: ['LNA', 'VGA'] }
            ],
            agcControl: 'unsupported',
            dcCorrectionControl: 'unsupported',
            loOffsetControl: 'supported',
            basebandFilterControl: 'supported',
            rfPower: {
                biasTee: 'supported',
                ampControl: 'supported',
                gpioControl: 'unsupported'
            },
            sampleFormat: {
                iqOrder: 'iq',
                sampleType: 'i8',
                interleaved: true,
                normalizedToUnitRange: false,
                invertIQSupported: 'unsupported',
                swapIQSupported: 'unsupported'
            },
            iqControl: {
                swap: 'unsupported',
                invert: 'unsupported',
                implementation: 'none'
            },
            frontEndCorrection: {
                dcOffset: 'unsupported',
                iqBalance: 'unsupported',
                implementation: 'none'
            }
        };
    }

    getIqControlState(): DeviceIqControlState {
        return { ...this.iqControlState };
    }

    async setIqControlState(patch: DeviceIqControlPatch): Promise<void> {
        if (patch.swapEnabled === true || patch.invertEnabled === true) {
            throw new Error('HackRF WebUSB driver does not support device-side IQ swap/invert controls.');
        }

        this.iqControlState = {
            ...this.iqControlState,
            ...(patch.swapEnabled !== undefined ? { swapEnabled: patch.swapEnabled } : {}),
            ...(patch.invertEnabled !== undefined ? { invertEnabled: patch.invertEnabled } : {})
        };
    }

    getFrontEndCorrectionState(): DeviceFrontEndCorrectionState {
        return { ...this.frontEndCorrectionState };
    }

    async setFrontEndCorrectionState(patch: DeviceFrontEndCorrectionPatch): Promise<void> {
        if (patch.dcOffsetEnabled === true || patch.iqBalanceEnabled === true) {
            throw new Error('HackRF WebUSB driver does not support device-side DC/IQ correction toggles.');
        }

        this.frontEndCorrectionState = {
            ...this.frontEndCorrectionState,
            ...(patch.dcOffsetEnabled !== undefined ? { dcOffsetEnabled: patch.dcOffsetEnabled } : {}),
            ...(patch.iqBalanceEnabled !== undefined ? { iqBalanceEnabled: patch.iqBalanceEnabled } : {})
        };
    }

    getRfPowerState(): DeviceRfPowerState {
        return {
            ...this.rfPowerState,
            ampEnabled: this.ampEnable > 0
        };
    }

    async setRfPowerState(patch: DeviceRfPowerPatch): Promise<void> {
        if (patch.biasTeeEnabled !== undefined) {
            this.rfPowerState = {
                ...this.rfPowerState,
                biasTeeEnabled: patch.biasTeeEnabled
            };

            if (this.device) {
                await this.vendorOut(HackRFCommand.SET_ANTENNA_ENABLE, patch.biasTeeEnabled ? 1 : 0, 0);
            }
        }

        if (patch.ampEnabled !== undefined) {
            await this.setGain('AMP', patch.ampEnabled ? 1 : 0);
            this.rfPowerState = {
                ...this.rfPowerState,
                ampEnabled: patch.ampEnabled
            };
        }
    }

    getGpioState(): DeviceGpioState {
        return {
            outputPins: { ...this.gpioState.outputPins }
        };
    }

    async setGpioState(patch: DeviceGpioPatch): Promise<void> {
        if (!patch.outputPins || Object.keys(patch.outputPins).length === 0) {
            return;
        }

        throw new Error('HackRF WebUSB driver does not currently support GPIO pin control commands.');
    }

    getStateMachineSnapshot(): DeviceStateMachineSnapshot {
        return {
            state: this.driverState,
            opened: Boolean(this.device?.opened),
            streaming: this.isStreaming,
            transitionCount: this.transitionCount,
            lastEvent: this.lastStateEvent,
            lastTransitionAtIso: this.lastTransitionAtIso
        };
    }

    getStreamContinuityContract(): DeviceStreamContinuityContract {
        return {
            timestampModel: 'monotonic-with-explicit-gaps',
            sampleIndexModel: 'continuous-with-gap-accounting',
            glitchlessOperations: ['gain_change', 'streaming_profile_change', 'recover_endpoint'],
            discontinuityOperations: [
                { operation: 'start', cause: 'restart', note: 'Each stream start emits a restart marker.' },
                { operation: 'retune', cause: 'retune' },
                { operation: 'sample_rate_change', cause: 'sample_rate_change' },
                { operation: 'recover_handle', cause: 'reset', note: 'Handle reopen forces RX mode reset.' },
                { operation: 'reset', cause: 'reset' }
            ],
            emittedDiscontinuityCauses: ['restart', 'retune', 'sample_rate_change', 'reset', 'overflow', 'dropped_samples']
        };
    }

    async open(): Promise<void> {
        this.transitionState('opening', 'open-begin');
        const normalFilter = { vendorId: HACKRF_USB_VID, productId: HACKRF_USB_PID };
        const broadHackRfFilter = { vendorId: HACKRF_USB_VID };
        console.log("Checking for previously paired HackRF devices...");

        const pairedDevices = await navigator.usb.getDevices();
        const existing = pairedDevices.find((d) => d.vendorId === HACKRF_USB_VID && d.productId === HACKRF_USB_PID);
        const pairedBootloader = pairedDevices.find((d) => d.vendorId === HACKRF_USB_VID && this.isBootloaderPersonality(d));

        if (existing) {
            console.log("Using previously paired HackRF without showing picker.");
            this.device = existing;
        } else if (pairedBootloader) {
            throw new Error(this.buildBootloaderRecoveryMessage(pairedBootloader));
        } else {
            console.log("No paired HackRF found. Requesting device selection...");
            const selectedDevice = await navigator.usb.requestDevice({ filters: [normalFilter, broadHackRfFilter] });

            if (selectedDevice.vendorId === HACKRF_USB_VID && this.isBootloaderPersonality(selectedDevice)) {
                throw new Error(this.buildBootloaderRecoveryMessage(selectedDevice));
            }

            if (selectedDevice.vendorId === HACKRF_USB_VID && selectedDevice.productId !== HACKRF_USB_PID) {
                const pid = `0x${selectedDevice.productId.toString(16)}`;
                throw new Error(`Unsupported HackRF USB personality detected (${pid}). Ensure normal firmware mode is active and retry.`);
            }

            this.device = selectedDevice;
        }

        if (!this.device) {
            this.transitionState('error', 'open-no-device');
            throw new Error('HackRF device not available.');
        }

        try {
            console.log('Opening and claiming interface...');
            await this.openAndClaim(this.device);
        } catch (firstError) {
            console.warn('Initial open/claim failed; retrying once on current device handle.', firstError);
            await this.recoverHandle();
        }

        // Probe is useful for diagnostics but must never block startup.
        try {
            await this.probeDevice();
        } catch (probeError) {
            console.warn('Probe failed; continuing with initialization.', probeError);
        }

        // Sequence
        console.log("Step 1: Set Sample Rate");
        try {
            await this.setSampleRate(this.sampleRate);
        } catch (error) {
            console.warn("Sample rate init failed; proceeding with device defaults.", error);
        }

        console.log("Step 2: Set Freq (90 MHz)");
        try {
            await this.setFrequency(this.frequency);
        } catch (error) {
            console.warn("Frequency init failed; proceeding with device defaults.", error);
        }

        console.log('Step 2b: Set Baseband Filter (1.75 MHz)');
        try {
            await this.setBasebandFilter(1_750_000);
        } catch (error) {
            console.warn('Baseband filter init failed; proceeding with device defaults.', error);
        }

        console.log("Step 3: LNA Gain");
        try {
            await this.setGain('LNA', 32);
        } catch (error) {
            console.warn("LNA init failed; continuing.", error);
        }

        console.log("Step 4: VGA Gain");
        try {
            await this.setGain('VGA', 20);
        } catch (error) {
            console.warn("VGA init failed; continuing.", error);
        }

        console.log("Step 5: AMP");
        try {
            await this.setGain('AMP', 0);
        } catch (error) {
            console.warn("AMP init failed; continuing.", error);
        }

        try {
            await this.setRfPowerState({ biasTeeEnabled: false });
        } catch (error) {
            console.warn('Bias-tee init failed; continuing with previous hardware state.', error);
        }
        
        console.log("Open Sequence Complete.");
        this.transitionState('open', 'open-complete');
    }

    async close(): Promise<void> {
        if (!this.device) return;
        this.transitionState('closing', 'close-begin');
        await this.stop();
        try {
            await this.device.releaseInterface(this.interfaceIndex);
        } catch (releaseError) {
            console.debug('Release interface failed during close:', releaseError);
        }

        try {
            await this.device.close();
        } catch (closeError) {
            console.debug('Close failed:', closeError);
        }

        this.device = null;
        this.transitionState('idle', 'close-complete');
    }

    async setFrequency(hz: number): Promise<void> {
        this.frequency = hz;
        if (!this.device) return;

        // Official SET_FREQ payload is two LE uint32 values: MHz and Hz remainder.
        const mhz = Math.floor(hz / 1_000_000);
        const hzRemainder = hz - (mhz * 1_000_000);
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setUint32(0, mhz, true);
        view.setUint32(4, hzRemainder, true);

        await this.vendorOut(HackRFCommand.SET_FREQ, 0, 0, buf);

        if (this.isStreaming) {
            this.markDiscontinuity('retune');
        }
    }

    async setBasebandFilter(hz: number): Promise<void> {
        if (!this.device) return;

        const value = hz & 0xffff;
        const index = (hz >>> 16) & 0xffff;
        await this.vendorOut(HackRFCommand.BASEBAND_FILTER_BANDWIDTH_SET, value, index);
    }

    async setSampleRate(hz: number): Promise<void> {
        this.sampleRate = hz;
        if (!this.device) return;

        // Official SAMPLE_RATE_SET payload is two LE uint32 values: freq_hz and divider.
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setUint32(0, hz, true);
        view.setUint32(4, 1, true);

        await this.vendorOut(HackRFCommand.SET_SAMPLE_RATE, 0, 0, buf);

        if (this.isStreaming) {
            this.markDiscontinuity('sample_rate_change');
        }
    }

    async setGain(name: string, value: number): Promise<void> {
        if (name === 'LNA') this.lnaGain = value;
        if (name === 'VGA') this.vgaGain = value;
        if (name === 'AMP') {
            this.ampEnable = value;
            this.rfPowerState = {
                ...this.rfPowerState,
                ampEnabled: value > 0
            };
        }

        if (!this.device) return;
        
                // Official API uses control IN with gain in wIndex and a 1-byte success response.
        if (name === 'LNA' || name === 'VGA') {
                        const cmd = name === 'LNA' ? HackRFCommand.SET_LNA_GAIN : HackRFCommand.SET_VGA_GAIN;
                        const gainResult = await this.vendorIn(cmd, 1, 0, value);
                        if (!gainResult || gainResult.getUint8(0) === 0) {
                                throw new Error(`${name} gain rejected by device: ${value}`);
                        }
                        return;
        }

        // AMP is OUT transfer with value in wValue
        if (name === 'AMP') {
            await this.vendorOut(HackRFCommand.SET_AMP_ENABLE, value ? 1 : 0, 0);
            return;
        }
    }

    async start(onData: SDRDataCallback): Promise<void> {
        if (!this.device) throw new Error("Device not open");
        if (this.isStreaming) return;

        const compatibilityGate = this.getCompatibilityGatingDecision();
        if (compatibilityGate.blocked) {
            this.transitionState('error', 'compatibility-gate-blocked');
            throw new Error(`HackRF streaming blocked by compatibility gate: ${compatibilityGate.message ?? 'unsupported firmware/board profile'}`);
        }

        this.transitionState('streaming', 'stream-start-requested');
        this.isStreaming = true;
        this.sequence = 0;
        this.sampleIndex = 0;
        this.timestampNs = 0;
        this.lastTickWallClockMs = Date.now();
        this.lastTransferAtMs = null;
        this.rateWindowStartedAtMs = performance.now();
        this.rateWindowBytes = 0;
        this.intervalEwmaMs = 0;
        this.intervalJitterEwmaMs = 0;
        this.debugCounters.longGapCount = 0;
        this.recentStallCount = 0;
        this.recentStallWindowStartedAtMs = 0;
        this.markDiscontinuity('restart');

        console.log("Starting RX Mode...");
        try {
            // Always force an idle -> RX transition to avoid stale mode state on first start.
            await this.setTransceiverMode(0);
            await this.sleep(HackRFDevice.MODE_SETTLE_DELAY_MS);
            await this.setTransceiverMode(1);
        } catch (startError) {
            this.isStreaming = false;
            this.transitionState('error', 'stream-start-failed');
            throw startError;
        }

        const transferSizeBytes = this.streamTransferSizeBytes;
        let consecutiveFailures = 0;
        console.log("RX Mode Active. Entering Loop...");
        
        while (this.isStreaming && this.device.opened) {
            try {
                // console.log("Requesting transfer...");
                const result = await this.device.transferIn(this.inEndpointNumber, transferSizeBytes);
                this.debugCounters.bulkInCount += 1;
                if (result.status !== 'ok') {
                    this.debugCounters.bulkInErrorCount += 1;
                    this.debugCounters.lastTransferStatus = result.status;
                    this.pushUsbTrace({
                        ts: new Date().toISOString(),
                        event: 'bulk-in-error',
                        status: result.status,
                        bytes: 0,
                        detail: `endpoint=${this.inEndpointNumber}`
                    });
                    throw new Error(`USB transfer status=${result.status}`);
                }

                if (result.data && result.data.byteLength > 0) {
                    this.debugCounters.lastTransferBytes = result.data.byteLength;
                    this.debugCounters.lastTransferStatus = result.status;
                    if (result.data.byteLength < transferSizeBytes) {
                        this.debugCounters.shortPacketCount += 1;
                    }
                    this.updateTransferTelemetry(result.data.byteLength, transferSizeBytes);
                    this.pushUsbTrace({
                        ts: new Date().toISOString(),
                        event: 'bulk-in',
                        status: result.status,
                        bytes: result.data.byteLength
                    });
                    consecutiveFailures = 0;
                    const nowMs = Date.now();
                    const transferSampleCount = Math.floor(result.data.byteLength / 2);
                    const expectedChunkMs = (transferSampleCount / this.sampleRate) * 1000;
                    const elapsedMs = Math.max(0, nowMs - this.lastTickWallClockMs);
                    this.lastTickWallClockMs = nowMs;

                    const elapsedChunks = Math.max(1, Math.floor(elapsedMs / Math.max(1, expectedChunkMs)));
                    const droppedSamples = Math.max(0, (elapsedChunks - 1) * transferSampleCount);
                    if (droppedSamples > 0) {
                        this.sampleIndex += droppedSamples;
                        this.timestampNs += Math.floor((droppedSamples * 1_000_000_000) / this.sampleRate);
                    }

                    const sequence = this.sequence;
                    const sampleIndex = this.sampleIndex;
                    const timestampNs = this.timestampNs;

                    let discontinuity: SDRDiscontinuityEvent | undefined;
                    const cause = this.pendingDiscontinuity ?? (droppedSamples > 0 ? 'dropped_samples' : null);
                    if (cause) {
                        discontinuity = {
                            cause,
                            sequence,
                            sampleIndex,
                            droppedSamples: droppedSamples > 0 ? droppedSamples : undefined,
                            wallClockMs: nowMs
                        };
                        this.pendingDiscontinuity = null;
                    }

                    onData(result.data, {
                        sequence,
                        sampleIndex,
                        sampleCount: transferSampleCount,
                        timestampNs,
                        sampleRate: this.sampleRate,
                        droppedSamples,
                        discontinuity,
                        sampleClock: {
                            truthMode: 'unknown'
                        }
                    });

                    this.sequence += 1;
                    this.sampleIndex += transferSampleCount;
                    this.timestampNs += Math.floor((transferSampleCount * 1_000_000_000) / this.sampleRate);
                } else {
                    this.debugCounters.shortPacketCount += 1;
                    throw new Error('USB transfer returned empty payload');
                }
            } catch (e) {
                if (!this.isStreaming || !this.device.opened) {
                    break;
                }

                console.error("USB Transfer Error:", e);
                this.markDiscontinuity('overflow');
                consecutiveFailures += 1;
                this.debugCounters.retryCount += 1;

                try {
                    const kind = this.classifyTransferFailure(e);
                    await this.recoverFromTransferFailure(kind);
                } catch (recoveryError) {
                    this.pushUsbTrace({
                        ts: new Date().toISOString(),
                        event: 'transfer-recovery-error',
                        detail: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
                    });
                }

                if (consecutiveFailures >= this.streamMaxConsecutiveFailures) {
                    this.isStreaming = false;
                    try {
                        await this.setTransceiverMode(0);
                    } catch (modeStopError) {
                        console.debug('Failed to leave RX mode after transfer failures:', modeStopError);
                    }

                    const detail = e instanceof Error ? e.message : String(e);
                    this.transitionState('error', 'stream-failure-budget-exhausted');
                    throw new Error(`HackRF stream aborted after ${consecutiveFailures} consecutive transfer failures: ${detail}`);
                }

                await this.sleep(this.streamRetryDelayMs);
            }
        }

        // If the loop exits while still marked as streaming, surface it as a hard
        // failure so the app can recover UI/device state instead of stalling.
        if (this.isStreaming) {
            this.isStreaming = false;
            try {
                await this.setTransceiverMode(0);
            } catch (modeStopError) {
                console.debug('Failed to leave RX mode after unexpected loop exit:', modeStopError);
            }

            this.transitionState('error', 'stream-loop-unexpected-exit');
            throw new Error('HackRF stream loop exited unexpectedly while streaming');
        }

        this.transitionState('open', 'stream-loop-exit');
    }

    async stop(): Promise<void> {
        this.isStreaming = false;
        this.transitionState(this.device ? 'open' : 'idle', 'stream-stop');
        if (this.device) {
            try {
                await this.setTransceiverMode(0);
            } catch (modeStopError) {
                console.debug('Failed to leave RX mode cleanly:', modeStopError);
            }
        }
    }

    async setStreamingProfile(profile: {
        transferSizeBytes: number;
        retryDelayMs: number;
        maxConsecutiveFailures: number;
        profileName?: 'low-latency' | 'balanced' | 'stable' | 'custom';
    }): Promise<void> {
        const compatibilityGate = this.getCompatibilityGatingDecision();
        if (compatibilityGate.blocked) {
            throw new Error(`HackRF streaming profile update blocked by compatibility gate: ${compatibilityGate.message ?? 'unsupported firmware/board profile'}`);
        }

        const requestedProfileName = profile.profileName ?? 'custom';
        const profileName = requestedProfileName === 'low-latency' && compatibilityGate.forcedProfile === 'balanced'
            ? 'balanced'
            : requestedProfileName;

        this.streamTransferSizeBytes = Math.max(4096, Math.min(65536, Math.round(profile.transferSizeBytes)));
        this.streamRetryDelayMs = Math.max(5, Math.min(200, Math.round(profile.retryDelayMs)));
        this.streamMaxConsecutiveFailures = Math.max(2, Math.min(32, Math.round(profile.maxConsecutiveFailures)));
        this.streamProfileName = profileName;

        if (profileName !== requestedProfileName) {
            this.pushUsbTrace({
                ts: new Date().toISOString(),
                event: 'compatibility-profile-gate',
                detail: compatibilityGate.message ?? `${requestedProfileName} gated to ${profileName}`
            });
        }

        this.pushUsbTrace({
            ts: new Date().toISOString(),
            event: 'streaming-profile-update',
            detail: `${this.streamProfileName}:${this.streamTransferSizeBytes}/${this.streamRetryDelayMs}/${this.streamMaxConsecutiveFailures}`
        });
    }

    getDebugSnapshot(): DeviceDebugSnapshot {
        return {
            driver: 'HackRFDevice',
            capturedAt: new Date().toISOString(),
            descriptor: {
                vendorId: this.device?.vendorId ?? HACKRF_USB_VID,
                productId: this.device?.productId ?? HACKRF_USB_PID,
                productName: this.device?.productName ?? undefined,
                manufacturerName: this.device?.manufacturerName ?? undefined,
                serialNumber: this.device?.serialNumber ?? undefined,
                configurationValue: this.device?.configuration?.configurationValue,
                interfaceIndex: this.interfaceIndex,
                alternateSetting: this.activeAlternateSetting,
                inEndpointNumber: this.inEndpointNumber,
                endpointWarnings: [...this.descriptorWarnings],
                alternateCandidates: this.descriptorCandidateCount
            },
            streamingProfile: {
                transferSizeBytes: this.streamTransferSizeBytes,
                retryDelayMs: this.streamRetryDelayMs,
                maxConsecutiveFailures: this.streamMaxConsecutiveFailures,
                profileName: this.streamProfileName,
                scheduleRecommendation: recommendUsbStreamingProfile({
                    transferIntervalMsAvg: this.debugCounters.transferIntervalMsAvg,
                    transferIntervalMsJitter: this.debugCounters.transferIntervalMsJitter,
                    shortPacketRatio: this.debugCounters.shortPacketRatio,
                    retryCount: this.debugCounters.retryCount,
                    bulkInErrorCount: this.debugCounters.bulkInErrorCount,
                    audioUnderruns: 0,
                    droppedFrameEvents: 0
                })
            },
            counters: { ...this.debugCounters },
            recentTrace: [...this.usbTrace],
            compatibility: this.getCompatibilityStatus(),
            rfPowerState: this.getRfPowerState(),
            gpioState: this.getGpioState(),
            sweep: this.getSweepCapability()
        };
    }
}
