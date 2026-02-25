import {
    DeviceDebugSnapshot,
    DeviceGpioPatch,
    DeviceGpioState,
    DeviceFrontEndCorrectionPatch,
    DeviceFrontEndCorrectionState,
    DeviceIqControlPatch,
    DeviceIqControlState,
    DeviceRfPowerPatch,
    DeviceRfPowerState,
    DeviceStateMachineSnapshot,
    DeviceStreamContinuityContract,
    ISDRDevice,
    SDRDataCallback,
    SDRGainStage
} from './ISDRDevice';
import { defaultCapabilityModel, DeviceCapabilityModel } from './CapabilityModel';
import { SDRDiscontinuityCause, SDRDiscontinuityEvent, SDRStreamFrame } from './streamFrame';

export type RtlDirectSamplingMode = 'off' | 'i-branch' | 'q-branch';

export class RtlSdrDevice implements ISDRDevice {
    name = 'RTL-SDR (RTL2832U)';

    private isOpen = false;
    private isStreaming = false;
    private intervalId: ReturnType<typeof setInterval> | null = null;

    private frequencyHz = 100_000_000;
    private sampleRateHz = 2_048_000;
    private tunerGainDb = 24;
    private directSamplingMode: RtlDirectSamplingMode = 'off';

    private sequence = 0;
    private sampleIndex = 0;
    private timestampNs = 0;
    private pendingDiscontinuity: SDRDiscontinuityCause | null = null;
    private lastTickWallClockMs = 0;

    private iqControlState: DeviceIqControlState = {
        swapEnabled: false,
        invertEnabled: false,
        implementation: 'none'
    };

    private frontEndCorrectionState: DeviceFrontEndCorrectionState = {
        dcOffsetEnabled: true,
        iqBalanceEnabled: true,
        implementation: 'device'
    };

    private rfPowerState: DeviceRfPowerState = {
        biasTeeEnabled: false,
        ampEnabled: false
    };

    private gpioState: DeviceGpioState = {
        outputPins: {}
    };

    private state: DeviceStateMachineSnapshot = {
        state: 'idle',
        opened: false,
        streaming: false,
        transitionCount: 0,
        lastEvent: 'init',
        lastTransitionAtIso: new Date(0).toISOString()
    };

    private readonly blockIntervalMs = 10;

    private transitionState(next: DeviceStateMachineSnapshot['state'], event: string): void {
        this.state = {
            ...this.state,
            state: next,
            transitionCount: this.state.transitionCount + 1,
            lastEvent: event,
            lastTransitionAtIso: new Date().toISOString()
        };
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

    private assertDirectSamplingFrequency(hz: number): void {
        if (this.directSamplingMode !== 'off' && hz > 28_000_000) {
            throw new Error('RTL-SDR direct sampling supports HF tuning only (<= 28 MHz). Disable direct sampling for VHF/UHF.');
        }
    }

    getGainStages(): SDRGainStage[] {
        return [
            { name: 'TUNER', label: 'Tuner Gain (dB)', min: 0, max: 49.6, step: 0.8, value: this.tunerGainDb }
        ];
    }

    getCapabilityModel(): DeviceCapabilityModel {
        return {
            ...defaultCapabilityModel('RTLSDR', this.name),
            supportedSampleRatesHz: [250_000, 1_024_000, 2_048_000, 2_400_000, 2_560_000],
            supportedAnalogBandwidthsHz: [200_000, 1_000_000, 2_000_000, 2_400_000],
            gainStages: [{ name: 'TUNER', min: 0, max: 49.6, step: 0.8, order: 1 }],
            agcControl: 'supported',
            dcCorrectionControl: 'supported',
            loOffsetControl: 'unsupported',
            basebandFilterControl: 'supported',
            sampleFormat: {
                iqOrder: 'iq',
                sampleType: 'u8',
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
                dcOffset: 'supported',
                iqBalance: 'supported',
                implementation: 'device'
            }
        };
    }

    getDirectSamplingMode(): RtlDirectSamplingMode {
        return this.directSamplingMode;
    }

    async setDirectSamplingMode(mode: RtlDirectSamplingMode): Promise<void> {
        this.directSamplingMode = mode;
        this.assertDirectSamplingFrequency(this.frequencyHz);
        if (this.isStreaming) {
            this.markDiscontinuity('retune');
        }
    }

    async open(): Promise<void> {
        if (this.isOpen) {
            return;
        }
        this.transitionState('opening', 'open-begin');
        this.isOpen = true;
        this.state = {
            ...this.state,
            opened: true,
            streaming: false
        };
        this.transitionState('open', 'open-complete');
    }

    async close(): Promise<void> {
        this.transitionState('closing', 'close-begin');
        await this.stop();
        this.isOpen = false;
        this.state = {
            ...this.state,
            opened: false,
            streaming: false
        };
        this.transitionState('idle', 'close-complete');
    }

    async setFrequency(hz: number): Promise<void> {
        if (!Number.isFinite(hz) || hz <= 0) {
            throw new Error(`Invalid RTL-SDR frequency: ${hz}`);
        }

        this.assertDirectSamplingFrequency(hz);
        this.frequencyHz = Math.round(hz);

        if (this.isStreaming) {
            this.markDiscontinuity('retune');
        }
    }

    async setSampleRate(hz: number): Promise<void> {
        if (!Number.isFinite(hz) || hz <= 0) {
            throw new Error(`Invalid RTL-SDR sample rate: ${hz}`);
        }

        this.sampleRateHz = Math.round(hz);
        if (this.isStreaming) {
            this.markDiscontinuity('sample_rate_change');
        }
    }

    async setGain(name: string, value: number): Promise<void> {
        if (name !== 'TUNER') {
            throw new Error(`Unknown RTL-SDR gain stage: ${name}`);
        }
        this.tunerGainDb = Math.max(0, Math.min(49.6, value));
    }

    private buildPayload(complexSamples: number): DataView {
        const payload = new Uint8Array(complexSamples * 2);
        const directSamplingShift = this.directSamplingMode === 'q-branch' ? Math.PI / 2 : 0;

        for (let i = 0; i < complexSamples; i += 1) {
            const t = (this.sampleIndex + i) / this.sampleRateHz;
            const carrier = Math.sin((2 * Math.PI * 1_200 * t) + directSamplingShift + this.frequencyHz / 1_000_000);
            const quadrature = Math.cos((2 * Math.PI * 1_200 * t) + directSamplingShift + this.frequencyHz / 1_000_000);

            payload[i * 2] = Math.max(0, Math.min(255, Math.round((carrier * 0.48 + 0.5) * 255)));
            payload[i * 2 + 1] = Math.max(0, Math.min(255, Math.round((quadrature * 0.48 + 0.5) * 255)));
        }

        return new DataView(payload.buffer);
    }

    async start(onData: SDRDataCallback): Promise<void> {
        if (!this.isOpen) {
            throw new Error('RTL-SDR must be opened before start().');
        }
        if (this.isStreaming) {
            return;
        }

        this.isStreaming = true;
        this.state = {
            ...this.state,
            streaming: true
        };
        this.transitionState('streaming', 'stream-start');
        this.markDiscontinuity('restart');
        this.lastTickWallClockMs = Date.now();

        const complexSamplesPerBlock = Math.max(64, Math.round((this.sampleRateHz * this.blockIntervalMs) / 1000));

        this.intervalId = setInterval(() => {
            if (!this.isStreaming) {
                return;
            }

            const nowMs = Date.now();
            const elapsedMs = Math.max(0, nowMs - this.lastTickWallClockMs);
            this.lastTickWallClockMs = nowMs;

            const elapsedBlocks = Math.max(1, Math.round(elapsedMs / this.blockIntervalMs));
            const droppedSamples = (elapsedBlocks - 1) * complexSamplesPerBlock;
            if (droppedSamples > 0) {
                this.sampleIndex += droppedSamples;
                this.timestampNs += Math.floor((droppedSamples * 1_000_000_000) / this.sampleRateHz);
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
                    wallClockMs: nowMs,
                    droppedSamples: droppedSamples > 0 ? droppedSamples : undefined
                };
                this.pendingDiscontinuity = null;
            }

            const frame: SDRStreamFrame = {
                sequence,
                sampleIndex,
                sampleCount: complexSamplesPerBlock,
                timestampNs,
                sampleRate: this.sampleRateHz,
                droppedSamples,
                discontinuity,
                sampleClock: {
                    truthMode: 'unknown'
                }
            };

            onData(this.buildPayload(complexSamplesPerBlock), frame);

            this.sequence += 1;
            this.sampleIndex += complexSamplesPerBlock;
            this.timestampNs += Math.floor((complexSamplesPerBlock * 1_000_000_000) / this.sampleRateHz);
        }, this.blockIntervalMs);
    }

    async stop(): Promise<void> {
        this.isStreaming = false;
        this.state = {
            ...this.state,
            streaming: false
        };
        this.transitionState(this.state.opened ? 'open' : 'idle', 'stream-stop');

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    getIqControlState(): DeviceIqControlState {
        return { ...this.iqControlState };
    }

    async setIqControlState(patch: DeviceIqControlPatch): Promise<void> {
        void patch;
        throw new Error('RTL-SDR path does not expose device-side IQ swap/invert controls.');
    }

    getFrontEndCorrectionState(): DeviceFrontEndCorrectionState {
        return { ...this.frontEndCorrectionState };
    }

    async setFrontEndCorrectionState(patch: DeviceFrontEndCorrectionPatch): Promise<void> {
        this.frontEndCorrectionState = {
            ...this.frontEndCorrectionState,
            ...(patch.dcOffsetEnabled !== undefined ? { dcOffsetEnabled: patch.dcOffsetEnabled } : {}),
            ...(patch.iqBalanceEnabled !== undefined ? { iqBalanceEnabled: patch.iqBalanceEnabled } : {})
        };
    }

    getRfPowerState(): DeviceRfPowerState {
        return { ...this.rfPowerState };
    }

    async setRfPowerState(patch: DeviceRfPowerPatch): Promise<void> {
        this.rfPowerState = {
            ...this.rfPowerState,
            ...(patch.biasTeeEnabled !== undefined ? { biasTeeEnabled: patch.biasTeeEnabled } : {}),
            ...(patch.ampEnabled !== undefined ? { ampEnabled: patch.ampEnabled } : {})
        };
    }

    getGpioState(): DeviceGpioState {
        return {
            outputPins: { ...this.gpioState.outputPins }
        };
    }

    async setGpioState(patch: DeviceGpioPatch): Promise<void> {
        if (!patch.outputPins) {
            return;
        }

        this.gpioState = {
            outputPins: {
                ...this.gpioState.outputPins,
                ...patch.outputPins
            }
        };
    }

    getStateMachineSnapshot(): DeviceStateMachineSnapshot {
        return { ...this.state };
    }

    getStreamContinuityContract(): DeviceStreamContinuityContract {
        return {
            timestampModel: 'monotonic-with-explicit-gaps',
            sampleIndexModel: 'continuous-with-gap-accounting',
            glitchlessOperations: ['gain_change'],
            discontinuityOperations: [
                { operation: 'start', cause: 'restart' },
                { operation: 'retune', cause: 'retune' },
                { operation: 'sample_rate_change', cause: 'sample_rate_change' }
            ],
            emittedDiscontinuityCauses: ['restart', 'retune', 'sample_rate_change', 'dropped_samples']
        };
    }

    getDebugSnapshot(): DeviceDebugSnapshot {
        return {
            driver: 'RtlSdrDevice',
            capturedAt: new Date().toISOString(),
            descriptor: {
                vendorId: 0x0bda,
                productId: 0x2838,
                manufacturerName: 'Realtek',
                productName: this.name
            },
            recentTrace: [
                {
                    ts: new Date().toISOString(),
                    event: 'direct-sampling',
                    detail: this.directSamplingMode
                }
            ]
        };
    }
}
