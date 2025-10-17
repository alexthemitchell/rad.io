/**
 * P25 Phase 2 Decoder Demo
 *
 * This example demonstrates how to use the P25 Phase 2 decoder
 * with simulated IQ samples representing a P25 Phase 2 signal.
 */

/* eslint-disable no-console */

import {
  decodeP25Phase2,
  DEFAULT_P25_CONFIG,
  P25Symbol,
  getFrameDescription,
  P25DecoderConfig,
} from "../utils/p25decoder";
import { Sample } from "../utils/dsp";

/**
 * Generate simulated P25 Phase 2 IQ samples
 *
 * Creates a clean H-DQPSK signal with known symbol sequence
 * for demonstration purposes.
 */
function generateP25Samples(
  symbolCount: number,
  config: P25DecoderConfig = DEFAULT_P25_CONFIG,
): Sample[] {
  const samples: Sample[] = [];
  const samplesPerSymbol = Math.floor(config.sampleRate / config.symbolRate);

  // Phase shifts for each symbol (in radians)
  const symbolPhases: Record<P25Symbol, number> = {
    [P25Symbol.SYMBOL_00]: (-135 * Math.PI) / 180,
    [P25Symbol.SYMBOL_01]: (-45 * Math.PI) / 180,
    [P25Symbol.SYMBOL_10]: (45 * Math.PI) / 180,
    [P25Symbol.SYMBOL_11]: (135 * Math.PI) / 180,
  };

  // Start with a known phase
  let currentPhase = 0;

  // Generate symbols: alternating pattern for demonstration
  const symbolSequence = [
    P25Symbol.SYMBOL_00,
    P25Symbol.SYMBOL_01,
    P25Symbol.SYMBOL_10,
    P25Symbol.SYMBOL_11,
  ];

  for (let i = 0; i < symbolCount; i++) {
    const symbol = symbolSequence[i % symbolSequence.length] as P25Symbol;
    const phaseShift = symbolPhases[symbol];

    // Generate samples for this symbol
    for (let j = 0; j < samplesPerSymbol; j++) {
      // Add the phase shift at the symbol boundary
      const phase = currentPhase + phaseShift;

      samples.push({
        I: Math.cos(phase),
        Q: Math.sin(phase),
      });
    }

    // Update current phase for next symbol (differential encoding)
    currentPhase += phaseShift;

    // Keep phase within [-π, π]
    while (currentPhase > Math.PI) {
      currentPhase -= 2 * Math.PI;
    }
    while (currentPhase < -Math.PI) {
      currentPhase += 2 * Math.PI;
    }
  }

  return samples;
}

/**
 * Generate noisy P25 samples with SNR
 */
function generateNoisyP25Samples(
  symbolCount: number,
  snrDb: number,
  config: P25DecoderConfig = DEFAULT_P25_CONFIG,
): Sample[] {
  const cleanSamples = generateP25Samples(symbolCount, config);

  // Calculate noise power based on desired SNR
  const signalPower =
    cleanSamples.reduce((sum, s) => sum + s.I * s.I + s.Q * s.Q, 0) /
    cleanSamples.length;
  const snrLinear = Math.pow(10, snrDb / 10);
  const noisePower = signalPower / snrLinear;
  const noiseStdDev = Math.sqrt(noisePower / 2); // Divide by 2 for I and Q

  // Add Gaussian noise
  return cleanSamples.map((sample) => ({
    I: sample.I + randomGaussian() * noiseStdDev,
    Q: sample.Q + randomGaussian() * noiseStdDev,
  }));
}

/**
 * Generate random Gaussian noise using Box-Muller transform
 */
function randomGaussian(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Demo 1: Clean P25 Signal Decoding
 */
export function demo1CleanSignal(): void {
  console.log("=== P25 Decoder Demo 1: Clean Signal ===\n");

  // Generate 50 symbols (enough for multiple frames)
  const samples = generateP25Samples(50);

  console.log(`Generated ${samples.length} IQ samples`);
  console.log(`Sample rate: ${DEFAULT_P25_CONFIG.sampleRate} Hz`);
  console.log(`Symbol rate: ${DEFAULT_P25_CONFIG.symbolRate} symbols/sec`);
  console.log();

  // Decode P25 data
  const decoded = decodeP25Phase2(samples);

  console.log(`Decoded ${decoded.frames.length} frames`);
  console.log(`Error rate: ${(decoded.errorRate * 100).toFixed(1)}%`);
  console.log(`Encrypted: ${decoded.isEncrypted}`);
  console.log();

  // Display frame details
  decoded.frames.forEach((frame, idx) => {
    console.log(`Frame ${idx + 1}: ${getFrameDescription(frame)}`);
    console.log(`  Symbols: ${frame.symbols.slice(0, 10).join(", ")}...`);
    console.log(`  Bits: ${frame.bits.slice(0, 20).join("")}...`);
    console.log();
  });
}

/**
 * Demo 2: Noisy P25 Signal Decoding
 */
export function demo2NoisySignal(): void {
  console.log("=== P25 Decoder Demo 2: Noisy Signal ===\n");

  const snrLevels = [20, 15, 10, 5]; // dB

  snrLevels.forEach((snr) => {
    const samples = generateNoisyP25Samples(50, snr);
    const decoded = decodeP25Phase2(samples);

    console.log(`SNR: ${snr} dB`);
    console.log(`  Frames decoded: ${decoded.frames.length}`);
    console.log(`  Error rate: ${(decoded.errorRate * 100).toFixed(1)}%`);

    if (decoded.frames.length > 0) {
      const avgQuality =
        decoded.frames.reduce((sum, f) => sum + f.signalQuality, 0) /
        decoded.frames.length;
      console.log(`  Average quality: ${avgQuality.toFixed(1)}%`);
    }

    console.log();
  });
}

/**
 * Demo 3: TDMA Slot Separation
 */
export function demo3TDMASlots(): void {
  console.log("=== P25 Decoder Demo 3: TDMA Slot Separation ===\n");

  // Generate samples with distinct patterns for each slot
  const samples = generateP25Samples(100);
  const decoded = decodeP25Phase2(samples);

  // Count frames per slot
  const slot1Frames = decoded.frames.filter((f) => f.slot === 1);
  const slot2Frames = decoded.frames.filter((f) => f.slot === 2);

  console.log(`Total frames: ${decoded.frames.length}`);
  console.log(`Slot 1 frames: ${slot1Frames.length}`);
  console.log(`Slot 2 frames: ${slot2Frames.length}`);
  console.log();

  console.log("Slot 1 frame details:");
  slot1Frames.slice(0, 2).forEach((frame) => {
    console.log(`  ${getFrameDescription(frame)}`);
  });
  console.log();

  console.log("Slot 2 frame details:");
  slot2Frames.slice(0, 2).forEach((frame) => {
    console.log(`  ${getFrameDescription(frame)}`);
  });
  console.log();
}

/**
 * Demo 4: Custom Configuration
 */
export function demo4CustomConfig(): void {
  console.log("=== P25 Decoder Demo 4: Custom Configuration ===\n");

  const customConfig: P25DecoderConfig = {
    sampleRate: 96000, // Higher sample rate
    symbolRate: 6000, // Standard P25 Phase 2
    carrierFrequency: 0,
    syncThreshold: 0.7, // More lenient sync detection
  };

  const samples = generateP25Samples(50, customConfig);
  const decoded = decodeP25Phase2(samples, customConfig);

  console.log("Custom configuration:");
  console.log(`  Sample rate: ${customConfig.sampleRate} Hz`);
  console.log(`  Symbol rate: ${customConfig.symbolRate} symbols/sec`);
  console.log(`  Sync threshold: ${customConfig.syncThreshold}`);
  console.log();

  console.log(`Decoded ${decoded.frames.length} frames`);
  console.log(`Error rate: ${(decoded.errorRate * 100).toFixed(1)}%`);
  console.log();
}

/**
 * Run all demos
 */
export function runAllDemos(): void {
  demo1CleanSignal();
  console.log("\n" + "=".repeat(60) + "\n");

  demo2NoisySignal();
  console.log("\n" + "=".repeat(60) + "\n");

  demo3TDMASlots();
  console.log("\n" + "=".repeat(60) + "\n");

  demo4CustomConfig();
}

// For Node.js execution
if (typeof require !== "undefined" && require.main === module) {
  runAllDemos();
}
