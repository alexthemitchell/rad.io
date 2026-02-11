import { ISDRDevice } from './ISDRDevice';

// HackRF One Constants
const HACKRF_USB_VID = 0x1d50;
const HACKRF_USB_PID = 0x6089;

enum HackRFCommand {
    SET_TRANSCEIVER_MODE = 1,
    SET_FREQ = 16,
    SET_AMP_ENABLE = 17,
    SET_LNA_GAIN = 19,
    SET_VGA_GAIN = 20,
    SET_SAMPLE_RATE = 6,
    BASEBAND_FILTER_BANDWIDTH_SET = 7
}

export class HackRFDevice implements ISDRDevice {
    name = "HackRF One";
    private device: USBDevice | null = null;
    private interfaceIndex = 0;
    private isStreaming = false;

    private frequency = 90_000_000; 
    private sampleRate = 2_000_000;

    async open(): Promise<void> {
        console.log("Looking for previous devices...");
        const devices = await navigator.usb.getDevices();
        const existing = devices.find(d => d.vendorId === HACKRF_USB_VID && d.productId === HACKRF_USB_PID);

        if (existing) {
            console.log("Found existing paired device:", existing.productName);
            this.device = existing;
        } else {
            console.log("Requesting new device (User Interaction Required)...");
            this.device = await navigator.usb.requestDevice({
                filters: [{ vendorId: HACKRF_USB_VID, productId: HACKRF_USB_PID }]
            });
        }

        console.log("Opening device...");
        await this.device.open();
        console.log("Selecting Config...");
        await this.device.selectConfiguration(1);
        console.log("Claiming Interface...");
        await this.device.claimInterface(this.interfaceIndex);

        // Step 0: Force OFF (Reset State)
        console.log("Step 0: Force Transceiver OFF");
        try {
            await this.device.controlTransferOut({
                requestType: 'vendor',
                recipient: 'device',
                request: HackRFCommand.SET_TRANSCEIVER_MODE,
                value: 0, 
                index: 0
            });
        } catch (e) {
            console.warn("Force OFF failed (might be stalled):", e);
            // Attempt to clear halt?
            try { await this.device.clearHalt('out', 0); } catch(e2) {} 
        }

        // Sequence
        console.log("Step 1: Set Sample Rate");
        await this.setSampleRate(this.sampleRate);
        
        console.log("Step 2: Set Freq (90 MHz)");
        await this.setFrequency(this.frequency);
        
        console.log("Step 3: LNA Gain");
        await this.setGain('LNA', 32);
        
        console.log("Step 4: VGA Gain");
        await this.setGain('VGA', 20);
        
        console.log("Step 5: AMP");
        await this.setGain('AMP', 0);
        
        console.log("Open Sequence Complete.");
    }

    async close(): Promise<void> {
        if (!this.device) return;
        await this.stop();
        await this.device.releaseInterface(this.interfaceIndex);
        await this.device.close();
        this.device = null;
    }

    async setFrequency(hz: number): Promise<void> {
        this.frequency = hz;
        if (!this.device) return;
        
        // Correct implementation based on firmware source:
        // struct set_freq_params_t { uint32_t freq_mhz; uint32_t freq_hz; };
        const mhz = Math.floor(hz / 1_000_000);
        const sub_hz = hz % 1_000_000;

        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setUint32(0, mhz, true); // Little Endian
        view.setUint32(4, sub_hz, true); // Little Endian

        await this.device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: HackRFCommand.SET_FREQ,
            value: 0,
            index: 0
        }, buf);
    }

    async setSampleRate(hz: number): Promise<void> {
        this.sampleRate = hz;
        if (!this.device) return;
        
        // Correct implementation:
        // uint32_t freq_hz;
        // uint32_t divider;
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setUint32(0, hz, true);     // 32-bit Hz
        view.setUint32(4, 1, true);      // 32-bit Divider (1)

        await this.device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: HackRFCommand.SET_SAMPLE_RATE,
            value: 0,
            index: 0
        }, buf);
    }

    async setGain(name: string, value: number): Promise<void> {
        if (!this.device) return;
        
        // LNA/VGA are IN transfers with value in wIndex
        if (name === 'LNA' || name === 'VGA') {
             const cmd = name === 'LNA' ? HackRFCommand.SET_LNA_GAIN : HackRFCommand.SET_VGA_GAIN;
             // They return 1 byte (success flag)
             await this.device.controlTransferIn({
                requestType: 'vendor',
                recipient: 'device',
                request: cmd,
                value: 0,
                index: value // Value goes in Index!
             }, 1);
             return;
        }

        // AMP is OUT transfer with value in wValue
        if (name === 'AMP') {
            await this.device.controlTransferOut({
                requestType: 'vendor',
                recipient: 'device',
                request: HackRFCommand.SET_AMP_ENABLE,
                value: value ? 1 : 0, // Value goes in Value
                index: 0
            });
            return;
        }
    }

    async start(onData: (data: DataView) => void): Promise<void> {
        if (!this.device) throw new Error("Device not open");
        this.isStreaming = true;

        console.log("Starting RX Mode...");
        await this.device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: HackRFCommand.SET_TRANSCEIVER_MODE,
            value: 1, 
            index: 0
        });

        const TRANSFER_SIZE = 16384; // Reduced size for debug
        console.log("RX Mode Active. Entering Loop...");
        
        while (this.isStreaming && this.device.opened) {
            try {
                // console.log("Requesting transfer...");
                const result = await this.device.transferIn(1, TRANSFER_SIZE);
                if (result.data) {
                    // console.log("Got Data:", result.data.byteLength);
                    onData(result.data);
                } else {
                    console.warn("Empty Transfer?");
                }
            } catch (e) {
                console.error("USB Transfer Error:", e);
                if (!this.device.opened) break;
            }
        }
    }

    async stop(): Promise<void> {
        this.isStreaming = false;
        if (this.device) {
             await this.device.controlTransferOut({
                requestType: 'vendor',
                recipient: 'device',
                request: HackRFCommand.SET_TRANSCEIVER_MODE,
                value: 0, 
                index: 0
            });
        }
    }
}
