export interface ISDRDevice {
    name: string;
    
    open(): Promise<void>;
    close(): Promise<void>;
    
    setFrequency(hz: number): Promise<void>;
    setSampleRate(hz: number): Promise<void>;
    setGain(name: string, value: number): Promise<void>;
    
    start(onData: (data: DataView) => void): Promise<void>;
    stop(): Promise<void>;
}
