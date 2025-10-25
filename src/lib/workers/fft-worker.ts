/**
 * FFT Worker Implementation
 * Implements ADR-0012: Parallel FFT Worker Pool
 * 
 * Specialized worker for FFT computations
 */

interface FFTMessage {
  id: string;
  samples: Float32Array;
  sampleRate: number;
  fftSize?: number;
}

interface FFTResponse {
  id: string;
  magnitude: Float32Array;
  phase?: Float32Array;
  processingTime: number;
  error?: string;
}

interface IQSample {
  I: number;
  Q: number;
}

// FFT context cache
const fftContexts = new Map<number, { cosTable: Float32Array; sinTable: Float32Array }>();

function getTrigTables(size: number): { cosTable: Float32Array; sinTable: Float32Array } {
  const cached = fftContexts.get(size);
  if (cached) {
    return cached;
  }
  
  const cosTable = new Float32Array(size);
  const sinTable = new Float32Array(size);
  
  for (let i = 0; i < size; i++) {
    const angle = (-2 * Math.PI * i) / size;
    cosTable[i] = Math.cos(angle);
    sinTable[i] = Math.sin(angle);
  }
  
  const tables = { cosTable, sinTable };
  fftContexts.set(size, tables);
  return tables;
}

function computeFFT(samples: Float32Array, fftSize: number): { magnitude: Float32Array; phase: Float32Array } {
  const MIN_MAGNITUDE = 1e-10;
  const magnitude = new Float32Array(fftSize);
  const phase = new Float32Array(fftSize);
  
  // Convert Float32Array to IQ samples (assume interleaved I,Q format)
  const iqSamples: IQSample[] = [];
  for (let i = 0; i < samples.length; i += 2) {
    iqSamples.push({
      I: samples[i] ?? 0,
      Q: samples[i + 1] ?? 0,
    });
  }
  
  const { cosTable, sinTable } = getTrigTables(fftSize);
  
  // Perform DFT
  const realPart = new Float32Array(fftSize);
  const imagPart = new Float32Array(fftSize);
  
  for (let k = 0; k < fftSize; k++) {
    let realSum = 0;
    let imagSum = 0;
    
    for (let n = 0; n < Math.min(iqSamples.length, fftSize); n++) {
      const sample = iqSamples[n];
      if (!sample) {
        continue;
      }
      
      const baseAngle = (k * n) % fftSize;
      const cos = cosTable[baseAngle] ?? 0;
      const sin = sinTable[baseAngle] ?? 0;
      
      realSum += sample.I * cos - sample.Q * sin;
      imagSum += sample.I * sin + sample.Q * cos;
    }
    
    realPart[k] = realSum;
    imagPart[k] = imagSum;
    
    const mag = Math.sqrt(realSum * realSum + imagSum * imagSum);
    magnitude[k] = 20 * Math.log10(Math.max(mag, MIN_MAGNITUDE));
    phase[k] = Math.atan2(imagSum, realSum);
  }
  
  // Shift FFT to center zero frequency
  const shiftedMag = new Float32Array(fftSize);
  const shiftedPhase = new Float32Array(fftSize);
  const half = Math.floor(fftSize / 2);
  
  shiftedMag.set(magnitude.slice(half), 0);
  shiftedMag.set(magnitude.slice(0, half), half);
  shiftedPhase.set(phase.slice(half), 0);
  shiftedPhase.set(phase.slice(0, half), half);
  
  return { magnitude: shiftedMag, phase: shiftedPhase };
}

// Worker message handler
self.onmessage = (event: MessageEvent<FFTMessage>): void => {
  const startTime = performance.now();
  const { id, samples, fftSize = 2048 } = event.data;
  
  try {
    const result = computeFFT(samples, fftSize);
    const processingTime = performance.now() - startTime;
    
    const response: FFTResponse = {
      id,
      magnitude: result.magnitude,
      phase: result.phase,
      processingTime,
    };
    
    // Transfer magnitude and phase buffers back
    self.postMessage(response, { transfer: [result.magnitude.buffer, result.phase.buffer] });
  } catch (error) {
    const response: FFTResponse = {
      id,
      magnitude: new Float32Array(0),
      processingTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    
    self.postMessage(response);
  }
};
