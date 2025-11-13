/**
 * Bulk RDS Processor for Scanner
 *
 * Processes RDS data from multiple FM stations detected within a wideband capture.
 * This module provides a simplified interface for the scanner to extract RDS from
 * all detected FM stations efficiently.
 */

import {
  MultiStationFMProcessor,
  type MultiStationFMConfig,
} from "./multiStationFM";
import type { RDSStationData, RDSDecoderStats } from "../models/RDSData";
import type { IQSample } from "../models/SDRDevice";

/**
 * FM station signal information
 */
export interface FMStationSignal {
  /** Frequency in Hz */
  frequency: number;
  /** Signal strength (0-1 scale) */
  strength: number;
}

/**
 * RDS extraction result for a station
 */
export interface RDSExtractionResult {
  /** Frequency in Hz */
  frequency: number;
  /** RDS station data (if available) */
  rdsData?: RDSStationData;
  /** RDS decoder statistics */
  rdsStats?: RDSDecoderStats;
}

/**
 * Bulk RDS processor for scanner
 * Maintains state across scan chunks for efficient processing
 */
export class BulkRDSProcessor {
  private processor: MultiStationFMProcessor | null = null;
  private lastSampleRate = 0;
  private lastCenterFreq = 0;

  /**
   * Process RDS from multiple FM stations
   *
   * @param stations - Array of detected FM stations
   * @param iqSamples - Wideband IQ samples
   * @param sampleRate - Sample rate in Hz
   * @param centerFrequency - Center frequency of wideband capture in Hz
   * @returns Array of RDS extraction results
   */
  async processStations(
    stations: FMStationSignal[] = [],
    iqSamples: IQSample[],
    sampleRate: number,
    centerFrequency: number,
    processorOptions?: Partial<MultiStationFMConfig>,
  ): Promise<RDSExtractionResult[]> {
    if (iqSamples.length === 0) {
      return [];
    }

    // Initialize or update processor
    if (
      !this.processor ||
      this.lastSampleRate !== sampleRate ||
      Math.abs(this.lastCenterFreq - centerFrequency) > 1e6
    ) {
      this.processor = new MultiStationFMProcessor({
        sampleRate,
        centerFrequency,
        bandwidth: sampleRate * 0.9,
        enableRDS: true,
        ...(processorOptions ?? {}),
      });
      this.lastSampleRate = sampleRate;
      this.lastCenterFreq = centerFrequency;
    } else {
      // Update config for current chunk
      this.processor.updateConfig({
        centerFrequency,
        ...(processorOptions ?? {}),
      });
    }

    // If stations passed in, add them explicitly (legacy path). Otherwise
    // allow the processor to auto-detect stations across the entire bandwidth.
    if (stations.length > 0) {
      this.processor.clearChannels();
      for (const station of stations) {
        this.processor.addChannel(station.frequency, station.strength);
      }
    }

    // Process wideband samples
    const rdsResults = await this.processor.processWidebandSamples(iqSamples);

    // Convert to results array. If no explicit stations were provided, return
    // the full list of detected channels with available RDS data.
    const results: RDSExtractionResult[] = [];
    if (stations.length > 0) {
      for (const station of stations) {
        const rdsResult = rdsResults.get(station.frequency);
        results.push({
          frequency: station.frequency,
          rdsData: rdsResult?.rdsData,
          rdsStats: rdsResult?.rdsStats,
        });
      }
    } else {
      // Return all channels discovered by the processor
      for (const channel of this.processor.getChannels()) {
        results.push({
          frequency: channel.frequency,
          rdsData: channel.rdsData,
          rdsStats: channel.rdsStats,
        });
      }
    }

    return results;
  }

  /**
   * Reset all decoder state
   */
  reset(): void {
    this.processor?.resetAllDecoders();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.processor = null;
  }
}

/**
 * Create a bulk RDS processor
 */
export function createBulkRDSProcessor(): BulkRDSProcessor {
  return new BulkRDSProcessor();
}
