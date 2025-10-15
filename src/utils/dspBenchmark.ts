/**
 * Performance benchmarking utilities for DSP functions
 * Compares WASM vs JavaScript implementations
 */

import {
  calculateFFTSync,
  calculateWaveform,
  calculateSpectrogram,
  Sample,
} from './dsp';
import {
  loadWasmModule,
  isWasmAvailable,
  calculateFFTWasm,
  calculateWaveformWasm,
  calculateSpectrogramWasm,
} from './dspWasm';

export interface BenchmarkResult {
  operation: string;
  jsDuration: number;
  wasmDuration: number | null;
  speedup: number | null;
  samples: number;
  fftSize?: number;
}

/**
 * Generate test samples for benchmarking
 */
function generateBenchmarkSamples(count: number, frequency = 5): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    samples.push({
      I: Math.cos(2 * Math.PI * frequency * t),
      Q: Math.sin(2 * Math.PI * frequency * t),
    });
  }
  return samples;
}

/**
 * Measure execution time of a function
 */
function measureTime(fn: () => void, iterations = 10): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  return (end - start) / iterations;
}

/**
 * Benchmark FFT calculation
 */
export async function benchmarkFFT(
  sampleCount: number,
  fftSize: number,
  iterations = 10,
): Promise<BenchmarkResult> {
  await loadWasmModule();
  const samples = generateBenchmarkSamples(sampleCount);

  // Benchmark JavaScript
  const jsDuration = measureTime(() => {
    calculateFFTSync(samples.slice(0, fftSize), fftSize);
  }, iterations);

  // Benchmark WASM
  let wasmDuration: number | null = null;
  if (isWasmAvailable()) {
    wasmDuration = measureTime(() => {
      calculateFFTWasm(samples.slice(0, fftSize), fftSize);
    }, iterations);
  }

  const speedup = wasmDuration !== null ? jsDuration / wasmDuration : null;

  return {
    operation: 'FFT',
    jsDuration,
    wasmDuration,
    speedup,
    samples: sampleCount,
    fftSize,
  };
}

/**
 * Benchmark waveform calculation
 */
export async function benchmarkWaveform(
  sampleCount: number,
  iterations = 10,
): Promise<BenchmarkResult> {
  await loadWasmModule();
  const samples = generateBenchmarkSamples(sampleCount);

  // Benchmark JavaScript
  const jsDuration = measureTime(() => {
    calculateWaveform(samples);
  }, iterations);

  // Benchmark WASM
  let wasmDuration: number | null = null;
  if (isWasmAvailable()) {
    wasmDuration = measureTime(() => {
      calculateWaveformWasm(samples);
    }, iterations);
  }

  const speedup = wasmDuration !== null ? jsDuration / wasmDuration : null;

  return {
    operation: 'Waveform',
    jsDuration,
    wasmDuration,
    speedup,
    samples: sampleCount,
  };
}

/**
 * Benchmark spectrogram calculation
 */
export async function benchmarkSpectrogram(
  sampleCount: number,
  fftSize: number,
  iterations = 10,
): Promise<BenchmarkResult> {
  await loadWasmModule();
  const samples = generateBenchmarkSamples(sampleCount);

  // Benchmark JavaScript
  const jsDuration = measureTime(() => {
    calculateSpectrogram(samples, fftSize);
  }, iterations);

  // Benchmark WASM
  let wasmDuration: number | null = null;
  if (isWasmAvailable()) {
    wasmDuration = measureTime(() => {
      calculateSpectrogramWasm(samples, fftSize);
    }, iterations);
  }

  const speedup = wasmDuration !== null ? jsDuration / wasmDuration : null;

  return {
    operation: 'Spectrogram',
    jsDuration,
    wasmDuration,
    speedup,
    samples: sampleCount,
    fftSize,
  };
}

/**
 * Run comprehensive benchmark suite
 */
export async function runBenchmarkSuite(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  console.log('Running DSP Performance Benchmarks...\n');

  // FFT benchmarks with various sizes
  const fftSizes = [64, 128, 256, 512, 1024, 2048];
  for (const size of fftSizes) {
    console.log(`Benchmarking FFT (size: ${size})...`);
    const result = await benchmarkFFT(size, size, 5);
    results.push(result);
    console.log(
      `  JS: ${result.jsDuration.toFixed(2)}ms, WASM: ${result.wasmDuration?.toFixed(2) || 'N/A'}ms, Speedup: ${result.speedup?.toFixed(2) || 'N/A'}x\n`,
    );
  }

  // Waveform benchmarks with various sample counts
  const waveformSizes = [1000, 5000, 10000, 50000];
  for (const size of waveformSizes) {
    console.log(`Benchmarking Waveform (samples: ${size})...`);
    const result = await benchmarkWaveform(size, 5);
    results.push(result);
    console.log(
      `  JS: ${result.jsDuration.toFixed(2)}ms, WASM: ${result.wasmDuration?.toFixed(2) || 'N/A'}ms, Speedup: ${result.speedup?.toFixed(2) || 'N/A'}x\n`,
    );
  }

  // Spectrogram benchmarks
  const spectrogramConfigs = [
    { samples: 2048, fftSize: 256 },
    { samples: 4096, fftSize: 512 },
    { samples: 8192, fftSize: 1024 },
  ];
  for (const config of spectrogramConfigs) {
    console.log(
      `Benchmarking Spectrogram (samples: ${config.samples}, FFT size: ${config.fftSize})...`,
    );
    const result = await benchmarkSpectrogram(
      config.samples,
      config.fftSize,
      5,
    );
    results.push(result);
    console.log(
      `  JS: ${result.jsDuration.toFixed(2)}ms, WASM: ${result.wasmDuration?.toFixed(2) || 'N/A'}ms, Speedup: ${result.speedup?.toFixed(2) || 'N/A'}x\n`,
    );
  }

  return results;
}

/**
 * Format benchmark results as a markdown table
 */
export function formatBenchmarkResults(results: BenchmarkResult[]): string {
  let output = '# DSP Performance Benchmark Results\n\n';
  output += '| Operation | Samples | FFT Size | JS (ms) | WASM (ms) | Speedup |\n';
  output += '|-----------|---------|----------|---------|-----------|----------|\n';

  for (const result of results) {
    const fftSizeStr = result.fftSize ? result.fftSize.toString() : '-';
    const wasmDurationStr = result.wasmDuration !== null
      ? result.wasmDuration.toFixed(2)
      : 'N/A';
    const speedupStr = result.speedup !== null
      ? `${result.speedup.toFixed(2)}x`
      : 'N/A';

    output += `| ${result.operation} | ${result.samples} | ${fftSizeStr} | ${result.jsDuration.toFixed(2)} | ${wasmDurationStr} | ${speedupStr} |\n`;
  }

  output += '\n## Summary\n\n';
  
  const wasmResults = results.filter(r => r.speedup !== null);
  if (wasmResults.length > 0) {
    const avgSpeedup = wasmResults.reduce((sum, r) => sum + (r.speedup ?? 0), 0) / wasmResults.length;
    output += `- **Average Speedup**: ${avgSpeedup.toFixed(2)}x\n`;
    output += `- **WASM Available**: Yes\n`;
  } else {
    output += '- **WASM Available**: No (running in fallback mode)\n';
  }

  return output;
}
