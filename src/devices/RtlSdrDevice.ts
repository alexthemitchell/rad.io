import { ISDRDevice, SDRGainStage } from './ISDRDevice';

// Common RTL-SDR VID/PIDs
// 0x0BDA:0x2838 is the most common generic RTL2832U dongle
const RTLSDR_FILTERS = [
    { vendorId: 0x0bda, productId: 0x2838 },
    { vendorId: 0x0bda, productId: 0x2832 }
];

export class RtlSdrDevice implements ISDRDevice {
    name = "RTL-SDR (RTL2832U)";
    private device: USBDevice | null = null;
    private interfaceIndex = 0;
    private isStreaming = false;

    // State
    private frequency = 100_000_000;
    private sampleRate = 2_048_000;
    private tunerGain = 0; // Automatic? Or manual index?
    
    // Tuner Type (To be detected)
    private tunerType: 'R820T' | 'Unknown' = 'Unknown';

    getGainStages(): SDRGainStage[] {
        // RTL-SDR Gain is usually a list of valid dB values, not linear.
        // For MVP skeleton, we'll expose a generic "Tuner Gain" index (0-49)
        // In reality, we map this to the Tuner's gain table.
        return [
            { name: 'TUNER', label: 'Tuner Gain (idx)', min: 0, max: 29, step: 1, value: 0 }
        ];
    }

    async open(): Promise<void> {
        console.log("RTL-SDR: Looking for device...");
        const devices = await navigator.usb.getDevices();
        // Simple match
        const existing = devices.find(d => 
            (d.vendorId === 0x0bda && (d.productId === 0x2838 || d.productId === 0x2832))
        );

        if (existing) {
            this.device = existing;
            console.log("RTL-SDR: Found existing:", existing.productName);
        } else {
            console.log("RTL-SDR: Requesting permission...");
            this.device = await navigator.usb.requestDevice({
                filters: RTLSDR_FILTERS
            });
        }

        console.log("RTL-SDR: Opening...");
        await this.device.open();
        
        console.log("RTL-SDR: Selecting Config 1...");
        await this.device.selectConfiguration(1);
        
        console.log("RTL-SDR: Claiming Interface 0...");
        await this.device.claimInterface(0);

        // Reset/Init Sequence (Stub)
        // Real driver needs to:
        // 1. Check if Kernel Driver is detached (WebUSB doesn't do this, OS does)
        // 2. Init RTL2832U registers
        // 3. Enable I2C Repeater
        // 4. Probe Tuner (R820T check)
        // 5. Init Tuner
        
        console.log("RTL-SDR: Device Opened (Skeleton)");
        this.tunerType = 'R820T'; // Assume R820T for now
    }

    async close(): Promise<void> {
        if (!this.device) return;
        await this.stop();
        await this.device.releaseInterface(0);
        await this.device.close();
        this.device = null;
    }

    async setFrequency(hz: number): Promise<void> {
        this.frequency = hz;
        console.log(`RTL-SDR: Set Freq ${hz} (Stub)`);
        // TODO: Calculate PLL parameters for Tuner (R820T)
    }

    async setSampleRate(hz: number): Promise<void> {
        this.sampleRate = hz;
        console.log(`RTL-SDR: Set Rate ${hz} (Stub)`);
        // TODO: Set Sample Rate on RTL2832U
    }

    async setGain(name: string, value: number): Promise<void> {
        if (name === 'TUNER') {
            this.tunerGain = value;
            console.log(`RTL-SDR: Set Tuner Gain Index ${value} (Stub)`);
            // TODO: Lookup gain value in table and set Tuner LNA
        }
    }

    async start(onData: (data: DataView) => void): Promise<void> {
        if (!this.device) throw new Error("Device not open");
        this.isStreaming = true;

        console.log("RTL-SDR: Start Streaming (Stub)");
        
        // Real Driver:
        // 1. Reset Endpoint
        // 2. Loop transferIn (Bulk, Endpoint 1 usually)
        
        // For Skeleton: Just log
        console.warn("RTL-SDR: Logic not implemented yet.");
        
        /* 
        const ENDPOINT = 1;
        const SIZE = 16384 * 16; 
        
        while (this.isStreaming && this.device.opened) {
             const res = await this.device.transferIn(ENDPOINT, SIZE);
             if (res.data) onData(res.data);
        }
        */
    }

    async stop(): Promise<void> {
        this.isStreaming = false;
        console.log("RTL-SDR: Stop");
    }
}
