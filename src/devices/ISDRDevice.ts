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
}
