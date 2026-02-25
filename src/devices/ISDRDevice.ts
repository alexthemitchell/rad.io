import type { SDRStreamFrame } from './streamFrame';

export interface SDRGainStage {
    name: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number; // Current or Default
}

export type SDRDataCallback = (data: DataView, frame?: SDRStreamFrame) => void;

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
    getDebugSnapshot?(): DeviceDebugSnapshot;
}
