import { usb, getDeviceList, findByIds } from 'usb';

const HACKRF_USB_VID = 0x1d50;
const HACKRF_USB_PID = 0x6089;
const HACKRF_VENDOR_REQUEST = 0x40; 
const HACKRF_DEVICE_TO_HOST = 0xC0; 

enum HackRFCommand {
    SET_TRANSCEIVER_MODE = 1,
    SET_FREQ = 2,
    SET_AMP_ENABLE = 19,
    SET_LNA_GAIN = 16,
    SET_VGA_GAIN = 17,
    SET_SAMPLE_RATE = 6,
    BOARD_ID_READ = 14,
    VERSION_STRING_READ = 15,
    BASEBAND_FILTER_BANDWIDTH_SET = 18
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runDiagnostic() {
    console.log("🔍 Scanning for HackRF One...");
    const device = findByIds(HACKRF_USB_VID, HACKRF_USB_PID);
    
    if (!device) {
        console.error("❌ No HackRF found!");
        process.exit(1);
    }
    console.log("✅ HackRF Found.");

    try {
        device.open();
        
        const iface = device.interfaces[0];
        try {
            if (iface.isKernelDriverActive()) iface.detachKernelDriver();
        } catch (e) {}
        
        iface.claim();
        console.log("✅ Interface Claimed");

        // Helpers
        const controlTransfer = (type: number, req: number, val: number, idx: number, dataOrLen: Buffer | number): Promise<Buffer | number> => {
            return new Promise((resolve, reject) => {
                device.controlTransfer(type, req, val, idx, dataOrLen, (err, data) => {
                    if (err) reject(err);
                    else resolve(data as Buffer | number);
                });
            });
        };

        // 1. Board ID
        console.log("Reading Board ID...");
        const boardId = await controlTransfer(HACKRF_DEVICE_TO_HOST, HackRFCommand.BOARD_ID_READ, 0, 0, 1);
        console.log("ℹ️  Board ID:", (boardId as Buffer)[0]);

        // 2. Sample Rate (2 MSPS)
        console.log("Setting Sample Rate...");
        const srBuf = Buffer.alloc(12);
        srBuf.writeBigUInt64LE(2_000_000n, 0); // Freq
        srBuf.writeUInt32LE(1, 8); // Divider
        await controlTransfer(HACKRF_VENDOR_REQUEST, HackRFCommand.SET_SAMPLE_RATE, 0, 0, srBuf);
        console.log("✅ Sample Rate: 2 MSPS");

        // 3. Filter
        console.log("Setting Filter...");
        const bw = 1_750_000;
        await controlTransfer(HACKRF_VENDOR_REQUEST, HackRFCommand.BASEBAND_FILTER_BANDWIDTH_SET, bw & 0xFFFF, (bw >>> 16) & 0xFFFF, Buffer.alloc(0));
        console.log("✅ Filter: 1.75 MHz");

        // 4. Gains
        console.log("Setting Gains...");
        // Reverting to wValue=Gain based on empirical success in Run 3
        await controlTransfer(HACKRF_VENDOR_REQUEST, HackRFCommand.SET_LNA_GAIN, 32, 0, Buffer.alloc(0)); 
        console.log("✅ LNA Gain: 32dB");

        await controlTransfer(HACKRF_VENDOR_REQUEST, HackRFCommand.SET_VGA_GAIN, 20, 0, Buffer.alloc(0)); 
        console.log("✅ VGA Gain: 20dB");

        // 5. Frequency (100 MHz)
        console.log("Tuning to 100 MHz...");
        const freqBuf = Buffer.alloc(8);
        freqBuf.writeBigUInt64LE(100_000_000n, 0);
        await controlTransfer(HACKRF_VENDOR_REQUEST, HackRFCommand.SET_FREQ, 0, 0, freqBuf);
        console.log("✅ Freq: 100 MHz");

        // 6. Stream
        console.log("🧪 Streaming 1s...");
        const inEndpoint = iface.endpoints.find(e => e.direction === 'in');
        if (!inEndpoint) throw new Error("No IN EP");

        // Enable RX
        await controlTransfer(HACKRF_VENDOR_REQUEST, HackRFCommand.SET_TRANSCEIVER_MODE, 1, 0, Buffer.alloc(0)); 

        let bytes = 0;
        inEndpoint.startPoll(3, 262144);
        inEndpoint.on('data', d => bytes += d.length);
        inEndpoint.on('error', console.error);

        await sleep(1000);
        inEndpoint.stopPoll();

        // Disable RX
        await controlTransfer(HACKRF_VENDOR_REQUEST, HackRFCommand.SET_TRANSCEIVER_MODE, 0, 0, Buffer.alloc(0)); 
        console.log("✅ Stream Complete. Bytes:", bytes);

        device.close();
        process.exit(0);

    } catch (e) {
        console.error("💥 Error:", e);
        process.exit(1);
    }
}

runDiagnostic();
