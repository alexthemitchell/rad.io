import { WfmDemodulator } from './WfmDemodulator';
import { AmDemodulator } from './AmDemodulator';
import { Downsampler } from './Downsampler';
import { ComplexOscillator } from './ComplexOscillator';
import { SimpleFFT } from './fft';

const fftSize = 2048;
const fft = new SimpleFFT(fftSize);

// Buffers for FFT
const fftInput = new Float32Array(fftSize * 2); // Interleaved IQ
const fftOutput = new Float32Array(fftSize * 2); // Interleaved Complex
const fftMagnitude = new Float32Array(fftSize);  // dB Magnitude
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
    const shiftedIQ = new Float32Array(iqData.length);
    nco.mix(iqData, shiftedIQ);

    // 2. FFT Processing
    // We want to visualize the WIDEBAND signal (Unshifted) usually to see what's around.
    // But if we want to zoom into the DDC'd signal, we'd visualize shiftedIQ.
    // Standard SDR UX:
    // - Wideband Spectrum (Overview) -> Uses Raw Input
    // - Narrowband Scope (Demod) -> Uses Shifted/Decimated Input
    //
    // For now, let's visualize the RAW input (iqData) so "Fine Tune" moves the "Filter" logic, not the whole world.
    // The "Fine Tune" slider in UI implies moving the reception window.
    processFFT(iqData); 

    // 3. Demodulate (Shifted Signal)
    const rawAudio = new Float32Array(iqData.length / 2);
    
    if (mode === 'WFM') {
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

    // Scope (Audio Time Domain)
    if (Math.random() < 0.1) {
        self.postMessage({ 
            type: 'SCOPE_DATA', 
            data: audioOut.slice(0, 256) 
        });
    }
}

function processFFT(iqData: Int8Array) {
    // Fill FFT Buffer
    // IQ Data is Int8 Interleaved
    for (let i = 0; i < iqData.length; i += 2) {
        if (fftIndex < fftSize) {
            // Normalize Int8 to Float (-1..1)
            // Window function (Blackman-Harris or Hamming) would be good here, 
            // but Rectangular is fine for MVP.
            fftInput[fftIndex * 2] = iqData[i] / 128.0;     // I
            fftInput[fftIndex * 2 + 1] = iqData[i+1] / 128.0; // Q
            fftIndex++;
        } else {
            // Buffer Full -> Compute FFT
            fft.transform(fftOutput, fftInput);
            
            // Compute Magnitude (dB) and FFT Shift
            // Standard FFT output is 0..Fs (or 0..Fs/2, -Fs/2..0)
            // We want DC in the middle.
            // fftOutput is [Re0, Im0, Re1, Im1 ...]
            
            // FFT Shift: Swap halves
            // 0..N/2 -> N/2..N
            // N/2..N -> 0..N/2
            
            for (let k = 0; k < fftSize; k++) {
                // Logical Index after shift
                // k=0 (DC) -> Center (N/2)
                // k=N/2 (Nyquist) -> Left (0)?? 
                // Wait.
                // Standard FFT: 0 (DC), 1, ..., N/2-1, N/2 (Nyquist), ..., N-1 (-1)
                // Shifted: N/2 (-Nyquist), ..., N-1 (-1), 0 (DC), 1, ..., N/2-1
                
                // Source Index
                // If we want Dest[0] to be -Fs/2
                // Dest[0] comes from Source[N/2]
                
                const srcIdx = (k + fftSize / 2) % fftSize;
                
                const re = fftOutput[srcIdx * 2];
                const im = fftOutput[srcIdx * 2 + 1];
                
                // Mag = sqrt(re^2 + im^2)
                // dB = 10 * log10(re^2 + im^2)
                // 20 * log10(sqrt(...))
                
                const magSq = re*re + im*im;
                let db = 10 * Math.log10(magSq + 1e-20); // Clamp -200dB
                
                fftMagnitude[k] = db;
            }

            self.postMessage({ type: 'FFT_DATA', data: fftMagnitude });
            fftIndex = 0;
        }
    }
}
