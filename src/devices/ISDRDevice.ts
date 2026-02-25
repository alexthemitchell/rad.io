import type { SDRStreamFrame } from './streamFrame';
import type { DeviceCapabilityModel } from './CapabilityModel';
import type { SDRDiscontinuityCause } from './streamFrame';

export interface SDRGainStage {
    name: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number; // Current or Default
}

export type SDRDataCallback = (data: DataView, frame?: SDRStreamFrame) => void;

export type DeviceIqControlState = {
    swapEnabled: boolean;
    invertEnabled: boolean;
    implementation: 'device' | 'dsp' | 'none';
};

export type DeviceIqControlPatch = {
    swapEnabled?: boolean;
    invertEnabled?: boolean;
};

export type DeviceFrontEndCorrectionState = {
    dcOffsetEnabled: boolean;
    iqBalanceEnabled: boolean;
    implementation: 'device' | 'dsp' | 'none';
};

export type DeviceFrontEndCorrectionPatch = {
    dcOffsetEnabled?: boolean;
    iqBalanceEnabled?: boolean;
};

export type DeviceRfPowerState = {
    biasTeeEnabled: boolean;
    ampEnabled: boolean;
};

export type DeviceRfPowerPatch = {
    biasTeeEnabled?: boolean;
    ampEnabled?: boolean;
};

export type DeviceGpioState = {
    outputPins: Record<string, boolean>;
};

export type DeviceGpioPatch = {
    outputPins?: Record<string, boolean>;
};

export type DeviceDriverState =
    | 'idle'
    | 'opening'
    | 'open'
    | 'streaming'
    | 'recovering'
    | 'closing'
    | 'error';

export type DeviceStateMachineSnapshot = {
    state: DeviceDriverState;
    opened: boolean;
    streaming: boolean;
    transitionCount: number;
    lastEvent: string;
    lastTransitionAtIso: string;
};

export type DeviceContinuityOperation =
    | 'start'
    | 'stop'
    | 'retune'
    | 'sample_rate_change'
    | 'gain_change'
    | 'streaming_profile_change'
    | 'recover_handle'
    | 'recover_endpoint'
    | 'reset';

export type DeviceStreamContinuityContract = {
    timestampModel: 'monotonic-with-explicit-gaps' | 'best-effort';
    sampleIndexModel: 'continuous-with-gap-accounting' | 'best-effort';
    glitchlessOperations: DeviceContinuityOperation[];
    discontinuityOperations: Array<{
        operation: DeviceContinuityOperation;
        cause: SDRDiscontinuityCause;
        note?: string;
    }>;
    emittedDiscontinuityCauses: SDRDiscontinuityCause[];
};

export type DeviceDebugSnapshot = {
    driver: string;
    capturedAt: string;
    descriptor?: {
        vendorId: number;
        productId: number;
        productName?: string;
        manufacturerName?: string;
        serialNumber?: string;
        configurationValue?: number;
        interfaceIndex?: number;
        alternateSetting?: number;
        inEndpointNumber?: number;
        endpointWarnings?: string[];
        alternateCandidates?: number;
    };
    streamingProfile?: {
        transferSizeBytes: number;
        retryDelayMs: number;
        maxConsecutiveFailures: number;
        profileName?: 'low-latency' | 'balanced' | 'stable' | 'custom';
        scheduleRecommendation?: 'low-latency' | 'balanced' | 'stable';
    };
    counters?: {
        controlInCount: number;
        controlOutCount: number;
        bulkInCount: number;
        bulkInErrorCount: number;
        shortPacketCount: number;
        retryCount: number;
        stallRecoveryCount: number;
        lastTransferBytes: number;
        lastTransferStatus: string;
        transferRateBps: number;
        transferIntervalMsAvg: number;
        transferIntervalMsJitter: number;
        shortPacketRatio: number;
        transferCadenceExpectedMs: number;
        transferBurstiness01: number;
        longGapCount: number;
    };
    recentTrace?: Array<{
        ts: string;
        event: string;
        status?: string;
        request?: number;
        bytes?: number;
        durationMs?: number;
        detail?: string;
    }>;
    compatibility?: {
        boardId?: number;
        firmwareVersion?: string;
        status: 'known-good' | 'unknown' | 'known-unsupported';
        note?: string;
    };
    rfPowerState?: DeviceRfPowerState;
    gpioState?: DeviceGpioState;
    sweep?: {
        hardwareSupported: boolean;
        fallbackMode: 'software-sweep-stitch' | 'none';
        command?: string;
        note?: string;
    };
};

export type DeviceSweepCapability = {
    hardwareSupported: boolean;
    fallbackMode: 'software-sweep-stitch' | 'none';
    command?: string;
    note?: string;
};

export interface ISDRDevice {
    name: string;
    
    open(): Promise<void>;
    close(): Promise<void>;
    
    setFrequency(hz: number): Promise<void>;
    setSampleRate(hz: number): Promise<void>;
    setGain(name: string, value: number): Promise<void>;
    
    // Capabilities
    getGainStages(): SDRGainStage[];
    
    start(onData: SDRDataCallback): Promise<void>;
    stop(): Promise<void>;
    setStreamingProfile?(profile: {
        transferSizeBytes: number;
        retryDelayMs: number;
        maxConsecutiveFailures: number;
        profileName?: 'low-latency' | 'balanced' | 'stable' | 'custom';
    }): Promise<void>;
    getSweepCapability?(): DeviceSweepCapability;
    getCapabilityModel?(): DeviceCapabilityModel;
    getDebugSnapshot?(): DeviceDebugSnapshot;
    getIqControlState?(): DeviceIqControlState;
    setIqControlState?(patch: DeviceIqControlPatch): Promise<void>;
    getFrontEndCorrectionState?(): DeviceFrontEndCorrectionState;
    setFrontEndCorrectionState?(patch: DeviceFrontEndCorrectionPatch): Promise<void>;
    getRfPowerState?(): DeviceRfPowerState;
    setRfPowerState?(patch: DeviceRfPowerPatch): Promise<void>;
    getGpioState?(): DeviceGpioState;
    setGpioState?(patch: DeviceGpioPatch): Promise<void>;
    getStateMachineSnapshot?(): DeviceStateMachineSnapshot;
    getStreamContinuityContract?(): DeviceStreamContinuityContract;
}
