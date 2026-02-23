import { ISDRDevice, SDRGainStage } from './ISDRDevice';

// HackRF One Constants
const HACKRF_USB_VID = 0x1d50;
const HACKRF_USB_PID = 0x6089;

enum HackRFCommand {
    SET_TRANSCEIVER_MODE = 1,
    SET_FREQ = 16,
    SET_SAMPLE_RATE = 6,
    BASEBAND_FILTER_BANDWIDTH_SET = 7,
    SET_LNA_GAIN = 19,
    SET_VGA_GAIN = 20,
    SET_AMP_ENABLE = 17,
    BOARD_ID_READ = 14,
    VERSION_STRING_READ = 15,
}

export class HackRFDevice implements ISDRDevice {
    name = "HackRF One";
    private static readonly CONTROL_TRANSFER_TIMEOUT_MS = 1500;
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

        const result = await this.withTimeout(this.device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request,
            value,
            index
        }, data), `controlTransferOut(device) req=${request}`);

        if (result.status !== 'ok') {
            throw new Error(`controlTransferOut(device) status=${result.status} req=${request}`);
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

        const res = await this.withTimeout(this.device.controlTransferIn({
            requestType: 'vendor',
            recipient: 'device',
            request,
            value,
            index
        }, length), `controlTransferIn(device) req=${request}`);

        if (res.status !== 'ok') {
            throw new Error(`controlTransferIn(device) status=${res.status} req=${request}`);
        }

        return res.data ?? null;
    }

    private async recoverHandle(): Promise<void> {
        if (!this.device) return;

        try {
            if (this.device.opened) {
                await this.device.close();
            }
        } catch (closeError) {
            console.debug('Close during recovery failed:', closeError);
        }

        await this.openAndClaim(this.device);
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

        console.log(`HackRF probe: board=${board ?? 'n/a'} version=${version}`);
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

        const candidate = config.interfaces
            .map((iface) => {
                const alt = iface.alternates.find((a) =>
                    a.endpoints.some((e) => e.direction === 'in' && e.type === 'bulk')
                );
                return alt ? { iface, alt } : null;
            })
            .find((entry): entry is { iface: USBInterface; alt: USBAlternateInterface } => entry !== null);

        if (candidate) {
            this.interfaceIndex = candidate.iface.interfaceNumber;
            const inEp = candidate.alt.endpoints.find((e) => e.direction === 'in' && e.type === 'bulk');
            if (inEp) {
                this.inEndpointNumber = inEp.endpointNumber;
            }
        }

        await device.claimInterface(this.interfaceIndex);

        const currentAlt = config.interfaces.find((i) => i.interfaceNumber === this.interfaceIndex)?.alternate;
        const targetAlt = config.interfaces
            .find((i) => i.interfaceNumber === this.interfaceIndex)
            ?.alternates.find((a) =>
                a.endpoints.some((e) => e.direction === 'in' && e.type === 'bulk')
            )?.alternateSetting;

        if (
            typeof targetAlt === 'number' &&
            typeof currentAlt === 'number' &&
            targetAlt !== currentAlt
        ) {
            await device.selectAlternateInterface(this.interfaceIndex, targetAlt);
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

    async open(): Promise<void> {
        const filter = { vendorId: HACKRF_USB_VID, productId: HACKRF_USB_PID };
        console.log("Checking for previously paired HackRF devices...");

        const pairedDevices = await navigator.usb.getDevices();
        const existing = pairedDevices.find((d) => d.vendorId === HACKRF_USB_VID && d.productId === HACKRF_USB_PID);

        if (existing) {
            console.log("Using previously paired HackRF without showing picker.");
            this.device = existing;
        } else {
            console.log("No paired HackRF found. Requesting device selection...");
            this.device = await navigator.usb.requestDevice({ filters: [filter] });
        }

        if (!this.device) {
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
        
        console.log("Open Sequence Complete.");
    }

    async close(): Promise<void> {
        if (!this.device) return;
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
    }

    async setGain(name: string, value: number): Promise<void> {
        if (name === 'LNA') this.lnaGain = value;
        if (name === 'VGA') this.vgaGain = value;
        if (name === 'AMP') this.ampEnable = value;

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

    async start(onData: (data: DataView) => void): Promise<void> {
        if (!this.device) throw new Error("Device not open");
        this.isStreaming = true;

        console.log("Starting RX Mode...");
        try {
            await this.vendorOut(HackRFCommand.SET_TRANSCEIVER_MODE, 1, 0);
        } catch (modeError) {
            console.warn('Failed to enter RX mode; attempting one handle recovery retry.', modeError);
            await this.recoverHandle();
            if (!this.device) throw modeError;
            await this.vendorOut(HackRFCommand.SET_TRANSCEIVER_MODE, 1, 0);
        }

        const TRANSFER_SIZE = 16384; // Reduced size for debug
        console.log("RX Mode Active. Entering Loop...");
        
        while (this.isStreaming && this.device.opened) {
            try {
                // console.log("Requesting transfer...");
                const result = await this.device.transferIn(this.inEndpointNumber, TRANSFER_SIZE);
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
            try {
                await this.vendorOut(HackRFCommand.SET_TRANSCEIVER_MODE, 0, 0);
            } catch (modeStopError) {
                console.debug('Failed to leave RX mode cleanly:', modeStopError);
            }
        }
    }
}
