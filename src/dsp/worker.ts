import { WfmDemodulator } from './WfmDemodulator';
import { AmDemodulator } from './AmDemodulator';
import { NfmDemodulator, type NfmAudioPreset, type NfmOutputPath } from './NfmDemodulator';
import { Downsampler } from './Downsampler';
import { ComplexOscillator } from './ComplexOscillator';
import { SimpleFFT } from './fft';
import { magnitudeSquaredToDbfs } from './fftScaling';
import { RdsDecoder, RdsSnapshot } from './RdsDecoder';
import { AudioPostProcessor, applyInterferencePreset, type FilterConfig, type FilterProfile, type InterferencePreset } from './AudioPostProcessor';
import { evaluateDemodQuality, type DemodQualityMetrics } from './DemodMetrics';
import { NoiseSquelch, type NoiseSquelchState } from './NoiseSquelch';
import { ToneDecoder, type ToneDecodeState } from './ToneDecoder';
import { computePpmCorrectionHz } from './ppmCorrection';
import { AudioLeveler, type AudioLevelerState } from './AudioLeveler';
import type { SDRStreamFrame } from '../devices/streamFrame';
import {
    computeDemodQualityTelemetry,
    computeDspAmplitudeTelemetry,
    PIPELINE_TIMING_CONTRACT_VERSION,
    type RuntimeDspTelemetryV1
} from '../telemetry/runtimeTelemetryContract';

type WorkerScope = {
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;
const DEFAULT_INPUT_SAMPLE_RATE_HZ = 2_000_000;

const fftSize = 2048;
const fft = new SimpleFFT(fftSize);

// Buffers for FFT
const fftInput = new Float32Array(fftSize * 2); // Interleaved IQ
const fftOutput = new Float32Array(fftSize * 2); // Interleaved Complex
const fftMagnitude = new Float32Array(fftSize);  // dB Magnitude
let fftIndex = 0;

// DSP Components
let inputSampleRateHz = DEFAULT_INPUT_SAMPLE_RATE_HZ;
let fineFrequencyHz = 0;
let wfm = new WfmDemodulator();
let am = new AmDemodulator();
let nfm = new NfmDemodulator();
let downsampler = new Downsampler();
let nco = new ComplexOscillator(DEFAULT_INPUT_SAMPLE_RATE_HZ);
const baseFilterConfig: FilterConfig = {
    profile: 'sharp',
    lowCutHz: 80,
    highCutHz: 14_000,
    sampleRateHz: 50_000,
    notchHz: null,
    notchQ: 10
};
let filterProfile: FilterProfile = baseFilterConfig.profile;
let interferencePreset: InterferencePreset = 'off';
const audioPostProcessor = new AudioPostProcessor(baseFilterConfig);
const toneDecoder = new ToneDecoder();
const audioLeveler = new AudioLeveler();
const noiseSquelch = new NoiseSquelch({
    enabled: false,
    thresholdDb: 10,
    hysteresisDb: 1.5,
    hangMs: 120,
    tailMs: 140
});
let rdsDecoder = new RdsDecoder();
let latestRdsSnapshot: RdsSnapshot = rdsDecoder.getSnapshot();
let latestDemodMetrics: DemodQualityMetrics = evaluateDemodQuality('WFM', new Float32Array(0));
let outboundPort: WorkerScope | MessagePort = workerScope;
let metricsEmitCounter = 0;
let latestSquelchState: NoiseSquelchState = noiseSquelch.getState(-120);
let latestToneDecodeState: ToneDecodeState = {
    ctcssHz: null,
    confidence: 0,
    active: false
};
let latestAudioLevelerState: AudioLevelerState = audioLeveler.getState();

let mode: 'WFM' | 'AM' | 'NFM' = 'WFM';
let nfmAudioPreset: NfmAudioPreset = 'voice-na-75us';
let nfmOutputPath: NfmOutputPath = 'voice';
let tunedFrequencyHz = 90_000_000;
let ppmCorrection = 0;

const applyMixerFrequency = () => {
    const ppmCompensationHz = computePpmCorrectionHz(tunedFrequencyHz, ppmCorrection);
    nco.setFrequency(fineFrequencyHz + ppmCompensationHz, inputSampleRateHz);
};

const postToMain = (message: unknown, transfer: Transferable[] = []) => {
    outboundPort.postMessage(message, transfer);
};

const resetPipelineState = () => {
    fftIndex = 0;
    wfm = new WfmDemodulator();
    am = new AmDemodulator();
    nfm = new NfmDemodulator();
    nfm.setConfig({
        preset: nfmAudioPreset,
        outputPath: nfmOutputPath
    });
    downsampler = new Downsampler();
    nco = new ComplexOscillator(inputSampleRateHz);
    applyMixerFrequency();
    rdsDecoder = new RdsDecoder();
    latestRdsSnapshot = rdsDecoder.getSnapshot();
    latestDemodMetrics = evaluateDemodQuality(mode, new Float32Array(0));
    metricsEmitCounter = 0;
    updateFilterConfig();
};

const updateFilterConfig = (overrides: Partial<FilterConfig> = {}) => {
    const merged = applyInterferencePreset(
        {
            ...baseFilterConfig,
            profile: filterProfile,
            ...overrides
        },
        interferencePreset
    );

    audioPostProcessor.setConfig(merged);
    postToMain({
        type: 'FILTER_STATE',
        data: {
            profile: filterProfile,
            preset: interferencePreset,
            lowCutHz: merged.lowCutHz,
            highCutHz: merged.highCutHz,
            notchHz: merged.notchHz,
            notchQ: merged.notchQ
        }
    }, []);
};

const handleMessage = (e: MessageEvent) => {
    if (e.data.command === 'START_USB_MODE') {
        resetPipelineState();
        console.log("Worker: Started USB Mode");
    } else if (e.data.command === 'STOP') {
        resetPipelineState();
        console.log('Worker: Stopped and reset state');
    } else if (e.data.command === 'INIT_MESSAGE_PORT') {
        const port = e.data.port as MessagePort | undefined;
        if (port) {
            outboundPort = port;
            port.onmessage = handleMessage;
            port.start();
        }
    } else if (e.data.command === 'SET_MODE') {
        mode = e.data.value;
        console.log(`Worker: Mode set to ${mode}`);
    } else if (e.data.command === 'SET_NFM_AUDIO_PRESET') {
        nfmAudioPreset = e.data.value as NfmAudioPreset;
        nfm.setConfig({ preset: nfmAudioPreset });
    } else if (e.data.command === 'SET_NFM_OUTPUT_PATH') {
        nfmOutputPath = e.data.value as NfmOutputPath;
        nfm.setConfig({ outputPath: nfmOutputPath });
    } else if (e.data.command === 'SET_TUNED_FREQUENCY') {
        tunedFrequencyHz = Number(e.data.value);
        applyMixerFrequency();
    } else if (e.data.command === 'SET_PPM_CORRECTION') {
        ppmCorrection = Number(e.data.value);
        applyMixerFrequency();
    } else if (e.data.command === 'SET_AUDIO_LEVELER_ENABLED') {
        audioLeveler.setEnabled(Boolean(e.data.value));
        postToMain({
            type: 'AUDIO_LEVELER_STATE',
            data: audioLeveler.getState()
        }, []);
    } else if (e.data.command === 'SET_FINE_FREQ') {
        // Frequency shift in Hz (e.g. +50000 Hz)
        fineFrequencyHz = Number(e.data.value);
        applyMixerFrequency();
    } else if (e.data.command === 'SET_SAMPLE_RATE') {
        const requestedSampleRateHz = Number(e.data.value);
        if (Number.isFinite(requestedSampleRateHz) && requestedSampleRateHz > 0) {
            inputSampleRateHz = requestedSampleRateHz;
            nco = new ComplexOscillator(inputSampleRateHz);
            applyMixerFrequency();
        }
    } else if (e.data.command === 'SET_FILTER_CONFIG') {
        updateFilterConfig({
            lowCutHz: Number(e.data.lowCutHz),
            highCutHz: Number(e.data.highCutHz)
        });
    } else if (e.data.command === 'SET_FILTER_PROFILE') {
        filterProfile = e.data.value as FilterProfile;
        updateFilterConfig();
    } else if (e.data.command === 'SET_INTERFERENCE_PRESET') {
        interferencePreset = e.data.value as InterferencePreset;
        updateFilterConfig();
    } else if (e.data.command === 'SET_NOISE_SQUELCH') {
        noiseSquelch.setConfig({
            enabled: Boolean(e.data.enabled),
            thresholdDb: Number(e.data.thresholdDb),
            hysteresisDb: Number(e.data.hysteresisDb),
            hangMs: Number(e.data.hangMs),
            tailMs: Number(e.data.tailMs)
        });
        postToMain({
            type: 'SQUELCH_STATE',
            data: noiseSquelch.getState(latestDemodMetrics.snrEstimateDb)
        }, []);
    } else if (e.data.command === 'RESET_RDS') {
        rdsDecoder = new RdsDecoder();
        latestRdsSnapshot = rdsDecoder.getSnapshot();
        postToMain({ type: 'RDS_DATA', data: latestRdsSnapshot }, []);
    } else if (e.data.type === 'STREAM_FRAME') {
        const frame = e.data.frame as SDRStreamFrame;
        postToMain({
            type: 'STREAM_FRAME_META',
            data: frame
        }, []);
    } else if (e.data.type === 'USB_DATA') {
        processUSBData(e.data.data);
    }
};

workerScope.onmessage = handleMessage;

function processUSBData(buffer: ArrayBuffer) {
    const startMs = performance.now();
    const iqData = new Int8Array(buffer);
    
    // 1. DDC / NCO (Frequency Shift)
    const shiftedIQ = new Float32Array(iqData.length);
    nco.mix(iqData, shiftedIQ);
    const afterDdcMs = performance.now();

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
    const afterFftMs = performance.now();

    // 3. Demodulate (Shifted Signal)
    const rawAudio = new Float32Array(iqData.length / 2);
    
    if (mode === 'WFM') {
        wfm.process(shiftedIQ, rawAudio);

        const rdsUpdate = rdsDecoder.process(rawAudio);
        if (rdsUpdate) {
            latestRdsSnapshot = rdsUpdate;
            postToMain({
                type: 'RDS_DATA',
                data: rdsUpdate
            }, []);
        }
    } else if (mode === 'NFM') {
        nfm.process(shiftedIQ, rawAudio);
    } else {
        am.process(shiftedIQ, rawAudio);
    }
    const afterDemodMs = performance.now();

    // Downsample
    const audioOut = downsampler.process(rawAudio);
    audioPostProcessor.processInPlace(audioOut);
    const afterDownsampleMs = performance.now();

    latestDemodMetrics = evaluateDemodQuality(mode, audioOut);
    const frameDurationMs = (audioOut.length / 50_000) * 1000;
    latestAudioLevelerState = audioLeveler.applyInPlace(audioOut, frameDurationMs);
    latestSquelchState = noiseSquelch.applyInPlace(audioOut, latestDemodMetrics.snrEstimateDb, frameDurationMs);
    if (mode === 'NFM') {
        latestToneDecodeState = toneDecoder.decodeCtcss(audioOut, 50_000);
    }
    metricsEmitCounter += 1;
    if (metricsEmitCounter % 5 === 0) {
        const amplitude = computeDspAmplitudeTelemetry(shiftedIQ, audioOut);
        const demodQuality = computeDemodQualityTelemetry(
            latestDemodMetrics,
            amplitude,
            mode === 'WFM' ? latestRdsSnapshot : null
        );
        const dspTelemetry: RuntimeDspTelemetryV1 = {
            pipelineTiming: {
                contractVersion: PIPELINE_TIMING_CONTRACT_VERSION,
                ddcMs: afterDdcMs - startMs,
                fftMs: afterFftMs - afterDdcMs,
                demodMs: afterDemodMs - afterFftMs,
                downsampleMs: afterDownsampleMs - afterDemodMs,
                totalMs: afterDownsampleMs - startMs
            },
            amplitude,
            demodQuality
        };

        postToMain({
            type: 'DEMOD_METRICS',
            data: latestDemodMetrics
        }, []);
        postToMain({
            type: 'DSP_TELEMETRY',
            data: dspTelemetry
        }, []);
        postToMain({
            type: 'SQUELCH_STATE',
            data: latestSquelchState
        }, []);
        if (mode === 'NFM') {
            postToMain({
                type: 'TONE_DECODE_STATE',
                data: latestToneDecodeState
            }, []);
        }
        postToMain({
            type: 'AUDIO_LEVELER_STATE',
            data: latestAudioLevelerState
        }, []);
    }

    // Audio Output
    if (audioOut.length > 0) {
        const audioBuffer = audioOut.buffer.slice(0);
        postToMain({ 
            type: 'AUDIO_DATA', 
            data: audioBuffer
        }, []);
    }

    // Scope (Audio Time Domain)
    if (Math.random() < 0.1) {
        postToMain({ 
            type: 'SCOPE_DATA', 
            data: audioOut.slice(0, 256) 
        }, []);
    }

    if (mode === 'WFM' && Math.random() < 0.01) {
        postToMain({
            type: 'RDS_DATA',
            data: latestRdsSnapshot
        }, []);
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
                
                // Convert to dBFS by normalizing against FFT size.
                // Without this normalization, bins can sit above 0 dBFS and the
                // UI trace clips at the top, appearing static/non-responsive.
                
                const magSq = re*re + im*im;
                const db = magnitudeSquaredToDbfs(magSq, fftSize);
                
                fftMagnitude[k] = db;
            }

            postToMain({ type: 'FFT_DATA', data: fftMagnitude });
            fftIndex = 0;
        }
    }
}
