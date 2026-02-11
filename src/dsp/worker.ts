import { WfmDemodulator } from './WfmDemodulator';
import { AmDemodulator } from './AmDemodulator';
import { Downsampler } from './Downsampler';
import { ComplexOscillator } from './ComplexOscillator';

let fftSize = 2048;
let fftWindow = new Float32Array(fftSize);
let fftIndex = 0;

// DSP Components
const wfm = new WfmDemodulator();
const am = new AmDemodulator();
const downsampler = new Downsampler();
const nco = new ComplexOscillator(2_000_000); // 2MSPS

let mode: 'WFM' | 'AM' = 'WFM';

self.onmessage = (e: MessageEvent) => {
    if (e.data.command === 'START_USB_MODE') {
        fftIndex = 0;
        console.log("Worker: Started USB Mode");
    } else if (e.data.command === 'SET_MODE') {
        mode = e.data.value;
        console.log(`Worker: Mode set to ${mode}`);
    } else if (e.data.command === 'SET_FINE_FREQ') {
        // Frequency shift in Hz (e.g. +50000 Hz)
        nco.setFrequency(e.data.value, 2_000_000);
    } else if (e.data.type === 'USB_DATA') {
        processUSBData(e.data.data);
    }
};

function processUSBData(buffer: ArrayBuffer) {
    const iqData = new Int8Array(buffer);
    
    // 1. DDC / NCO (Frequency Shift)
    // We need float buffers for NCO output? 
    // Or we can modify NCO to take Int8 and output Float32? 
    // Current NCO takes Int8 and outputs Float32.
    const shiftedIQ = new Float32Array(iqData.length);
    nco.mix(iqData, shiftedIQ);

    // 2. FFT Processing (Visualize Input)
    // We visualize the shifted signal so the user sees what they are tuned to centered?
    // Or do we visualize the raw wideband? 
    // Usually Waterfall = Wideband (Raw).
    // Scope/Demod = Narrowband (Shifted).
    processFFT(iqData); // Visualize Raw Wideband

    // 3. Demodulate
    // Demodulators currently expect Int8. We need to update them to accept Float32 
    // or convert Float32 back to Int8 (bad).
    // Let's update Demodulators to take Float32.
    // Wait, Demodulators take Int8 currently.
    // I need to update WfmDemodulator and AmDemodulator to accept Float32 input.
    
    // TEMPORARY HACK: Cast back to Int8 for now to avoid refactoring everything in one step.
    // Actually, NCO output is Float32 (-128 to 127 scale).
    // WFM/AM expect Int8 and divide by 128.
    // So if we pass Float32 and divide by 128, it works.
    // But Typescript will complain.
    
    // Let's refactor Demodulators to be generic or take Float32.
    // This is safer.
    
    const rawAudio = new Float32Array(iqData.length / 2);
    
    if (mode === 'WFM') {
        // WfmDemodulator needs update
        // Passing shiftedIQ (Float32) instead of Int8
        // We'll need to cast or update the signature.
        wfm.process(shiftedIQ, rawAudio);
    } else {
        am.process(shiftedIQ, rawAudio);
    }

    // Downsample
    const audioOut = downsampler.process(rawAudio);

    // Audio Output
    if (audioOut.length > 0) {
        self.postMessage({ 
            type: 'AUDIO_DATA', 
            data: audioOut 
        }, [audioOut.buffer]);
    }

    // Scope
    if (Math.random() < 0.1) {
        self.postMessage({ 
            type: 'SCOPE_DATA', 
            data: audioOut.slice(0, 256) 
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
