/**
 * ATSC 8-VSB Demodulator Usage Examples
 *
 * Demonstrates various usage patterns for the ATSC 8-VSB demodulator plugin.
 */

/* eslint-disable no-console, @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/prefer-for-of */

import { ATSC8VSBDemodulator } from "./ATSC8VSBDemodulator";
import type { IQSample } from "../../models/SDRDevice";

/**
 * Example 1: Basic Demodulation
 *
 * Simple example showing basic setup and demodulation.
 */
export async function basicDemodulation() {
  // Create and initialize demodulator
  const demodulator = new ATSC8VSBDemodulator();
  await demodulator.initialize();
  await demodulator.activate();

  // Simulate receiving IQ samples from SDR device
  const iqSamples: IQSample[] = [
    /* ... samples from SDR ... */
  ];

  // Demodulate to symbols
  const symbols = demodulator.demodulate(iqSamples);

  console.log(`Demodulated ${symbols.length} symbols`);

  // Clean up
  await demodulator.deactivate();
}

/**
 * Example 2: Monitoring Sync Status
 *
 * Shows how to monitor sync lock and track segment/field boundaries.
 */
export async function monitorSyncStatus() {
  const demodulator = new ATSC8VSBDemodulator();
  await demodulator.initialize();
  await demodulator.activate();

  // Process samples in a loop
  let processedSegments = 0;
  const targetSegments = 313; // One field

  while (processedSegments < targetSegments) {
    // Get samples from SDR
    const iqSamples: IQSample[] = [
      /* ... samples ... */
    ];

    // Demodulate
    demodulator.demodulate(iqSamples);

    // Check sync status
    if (demodulator.isSyncLocked()) {
      const segmentCount = demodulator.getSegmentSyncCount();
      const fieldCount = demodulator.getFieldSyncCount();

      console.log(`Sync locked!`);
      console.log(`Segments: ${segmentCount}, Fields: ${fieldCount}`);

      processedSegments = segmentCount;

      // Check if we've completed a field
      if (fieldCount > 0) {
        console.log(`Completed field ${fieldCount}`);
      }
    } else {
      console.log("Searching for sync...");
    }
  }

  await demodulator.deactivate();
}

/**
 * Example 3: Custom Configuration
 *
 * Demonstrates configuring demodulator parameters.
 */
export async function customConfiguration() {
  const demodulator = new ATSC8VSBDemodulator();

  // Configure before initialization
  demodulator.setParameters({
    audioSampleRate: 10.76e6, // 10.76 Msymbols/sec
    bandwidth: 6e6, // 6 MHz channel
    squelch: 10, // 10% squelch threshold
    afcEnabled: true, // Enable AFC
  });

  await demodulator.initialize();
  await demodulator.activate();

  // Verify configuration
  const config = demodulator.getParameters();
  console.log("Demodulator configuration:", config);

  // Process samples...
  await demodulator.deactivate();
}

/**
 * Example 4: Real-time Processing with SDR
 *
 * Shows integration with SDR device for real-time ATSC reception.
 */
export async function realtimeProcessing() {
  const demodulator = new ATSC8VSBDemodulator();

  // Configure for real-time operation
  demodulator.setParameters({
    audioSampleRate: 10.76e6,
    bandwidth: 6e6,
    afcEnabled: true,
  });

  await demodulator.initialize();
  await demodulator.activate();

  // Simulate SDR streaming
  const processChunk = (iqSamples: IQSample[]) => {
    // Demodulate chunk
    const symbols = demodulator.demodulate(iqSamples);

    // Process symbols (e.g., send to decoder)
    if (symbols.length > 0) {
      // Forward to Reed-Solomon decoder, etc.
      console.log(`Processed ${symbols.length} symbols`);
    }

    return symbols;
  };

  // Process multiple chunks
  for (let i = 0; i < 10; i++) {
    const chunk: IQSample[] = [
      /* ... get from SDR ... */
    ];
    processChunk(chunk);
  }

  await demodulator.deactivate();
}

/**
 * Example 5: Performance Monitoring
 *
 * Demonstrates measuring demodulator performance.
 */
export async function performanceMonitoring() {
  const demodulator = new ATSC8VSBDemodulator();
  await demodulator.initialize();
  await demodulator.activate();

  // Generate test samples
  const numSamples = 10000;
  const testSamples: IQSample[] = new Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const level = (i % 8) - 3.5;
    testSamples[i] = { I: level, Q: 0 };
  }

  // Measure processing time
  const startTime = performance.now();
  const symbols = demodulator.demodulate(testSamples);
  const endTime = performance.now();

  const processingTime = endTime - startTime;
  const samplesPerSecond = (numSamples / processingTime) * 1000;

  console.log(`Processing time: ${processingTime.toFixed(2)} ms`);
  console.log(`Throughput: ${(samplesPerSecond / 1e6).toFixed(2)} Msamples/s`);
  console.log(`Output symbols: ${symbols.length}`);

  await demodulator.deactivate();
}

/**
 * Example 6: Error Handling
 *
 * Shows proper error handling and recovery.
 */
export async function errorHandling() {
  const demodulator = new ATSC8VSBDemodulator();

  try {
    await demodulator.initialize();
    await demodulator.activate();

    // Try to set invalid mode
    try {
      demodulator.setMode("invalid");
    } catch (error) {
      console.error("Invalid mode error:", error);
      // Continue with default mode
    }

    // Process samples
    const samples: IQSample[] = [
      /* ... */
    ];
    const symbols = demodulator.demodulate(samples);

    console.log(`Successfully demodulated ${symbols.length} symbols`);
  } catch (error) {
    console.error("Demodulation error:", error);
  } finally {
    // Always clean up
    await demodulator.deactivate();
  }
}

/**
 * Example 7: Batch Processing
 *
 * Efficient batch processing of recorded samples.
 */
export async function batchProcessing() {
  const demodulator = new ATSC8VSBDemodulator();
  await demodulator.initialize();
  await demodulator.activate();

  // Simulate batches of recorded samples
  const batches: IQSample[][] = [
    /* ... array of sample batches ... */
  ];

  const allSymbols: number[] = [];

  for (const batch of batches) {
    const symbols = demodulator.demodulate(batch);

    // Collect all symbols
    for (let i = 0; i < symbols.length; i++) {
      allSymbols.push(symbols[i]);
    }

    // Check progress
    if (demodulator.isSyncLocked()) {
      console.log(
        `Batch processed. Total segments: ${demodulator.getSegmentSyncCount()}`,
      );
    }
  }

  console.log(`Total symbols demodulated: ${allSymbols.length}`);

  await demodulator.deactivate();
}

/**
 * Example 8: Plugin Registry Integration
 *
 * Shows how to use the demodulator with the plugin registry.
 */
export async function pluginRegistryIntegration() {
  // This would typically be in your main application code
  const { pluginRegistry } = await import("../../lib/PluginRegistry");

  // Create and register demodulator
  const demodulator = new ATSC8VSBDemodulator();
  await pluginRegistry.register(demodulator);

  // Initialize all plugins
  await pluginRegistry.initializeAll();

  // Get the registered demodulator
  const registered = pluginRegistry.getPlugin("atsc-8vsb-demodulator");

  if (registered) {
    console.log("Demodulator registered:", registered.metadata);

    // Activate
    await registered.activate();

    // Use it...
    // const symbols = (registered as ATSC8VSBDemodulator).demodulate(samples);

    // Deactivate
    await registered.deactivate();
  }

  // Cleanup
  await pluginRegistry.disposeAll();
}

// Export all examples
export const examples = {
  basicDemodulation,
  monitorSyncStatus,
  customConfiguration,
  realtimeProcessing,
  performanceMonitoring,
  errorHandling,
  batchProcessing,
  pluginRegistryIntegration,
};
