import { WfmDemodulator } from './WfmDemodulator';
import { Downsampler } from './Downsampler';

let fftSize = 2048;
let fftWindow = new Float32Array(fftSize);
let fftIndex = 0;

// DSP Components
const demodulator = new WfmDemodulator();
const downsampler = new Downsampler();

self.onmessage = (e: MessageEvent) => {
    if (e.data.command === 'START_USB_MODE') {
        // Reset state
        fftIndex = 0;
        console.log("Worker: Started USB Mode");
    } else if (e.data.type === 'USB_DATA') {
        processUSBData(e.data.data);
    }
};

function processUSBData(buffer: ArrayBuffer) {
    // 1. Convert Raw IQ (Int8)
    const iqData = new Int8Array(buffer);
    
    // 2. FFT Processing (Visualize Input)
    processFFT(iqData);

    // 3. Demodulate (WFM)
    // Input is IQ (2MSPS), Output is Audio (2MSPS - still high sample rate)
    // We will allocate output buffer half the size of input (since input is I+Q pairs)
    const rawAudio = new Float32Array(iqData.length / 2);
    demodulator.process(iqData, rawAudio);

    // 4. Downsample (2M -> 50k)
    const audioOut = downsampler.process(rawAudio);

    // 5. Send Audio to Main Thread (for playback)
    // We transfer the buffer to avoid copy overhead
    if (audioOut.length > 0) {
        self.postMessage({ 
            type: 'AUDIO_DATA', 
            data: audioOut 
        }, [audioOut.buffer]);
    }

    // 6. Send "Audio" stats back to main thread (for visualization/debug)
    // Use the downsampled audio for the scope now (it looks better)
    if (Math.random() < 0.1) { // Throttle scope updates
        self.postMessage({ 
            type: 'SCOPE_DATA', 
            data: audioOut.slice(0, 256) // Send a chunk
        });
    }
}

function processFFT(iqData: Int8Array) {
    // Basic block-based FFT accumulation (Naive)
    // Just take the first chunk that fits
    for (let i = 0; i < iqData.length; i += 2) {
        if (fftIndex < fftSize) {
            // Complex to Magnitude
            const I = iqData[i];
            const Q = iqData[i+1];
            // Simple magnitude approximation or just I for now? 
            // Real FFT expects real input. We want complex FFT really.
            // For now, let's just feed Magnitude into the visualizer to keep it simple.
            // Or better: Feed Complex samples if we had a complex FFT lib.
            // Reverting to simple "Magnitude" array for the naive canvas
            
            fftWindow[fftIndex++] = Math.sqrt(I*I + Q*Q);
        } else {
            // Send buffer
            self.postMessage({ type: 'FFT_DATA', data: fftWindow });
            fftIndex = 0;
            // Clear or Overwrite?
            // window.fill(0); // Optional
        }
    }
}
