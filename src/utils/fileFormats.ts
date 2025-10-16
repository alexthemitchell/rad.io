/**
 * File Format Utilities for IQ Data and Presets
 *
 * This module provides utilities for importing and exporting:
 * - IQ sample data with metadata
 * - Radio presets (frequencies and settings)
 * - Recordings with configuration
 */

import { IQSample } from "../models/SDRDevice";
import { SignalType } from "../components/SignalTypeSelector";

/**
 * IQ Recording Format
 * Stores IQ samples with associated metadata
 */
export type IQRecording = {
  version: string;
  timestamp: string;
  metadata: {
    centerFrequency: number; // Hz
    sampleRate: number; // Hz
    signalType?: SignalType;
    duration?: number; // seconds
    deviceInfo?: string;
    description?: string;
  };
  samples: IQSample[];
};

/**
 * Preset Station Format
 */
export type PresetStation = {
  name: string;
  frequency: number; // Hz
  type: SignalType;
  notes?: string;
};

/**
 * Preset Collection Format
 */
export type PresetCollection = {
  version: string;
  name: string;
  description?: string;
  stations: PresetStation[];
};

/**
 * Export IQ samples to JSON format
 */
export function exportIQRecording(recording: IQRecording): string {
  return JSON.stringify(recording, null, 2);
}

/**
 * Import IQ samples from JSON format
 */
export function importIQRecording(jsonString: string): IQRecording {
  const data = JSON.parse(jsonString);

  // Validate structure
  if (!data.version || !data.metadata || !Array.isArray(data.samples)) {
    throw new Error("Invalid IQ recording format");
  }

  // Validate timestamp
  if (typeof data.timestamp !== "string" || isNaN(Date.parse(data.timestamp))) {
    throw new Error(
      "Invalid or missing timestamp in IQ recording. Expected a valid ISO date string.",
    );
  }
  // Validate metadata
  if (
    typeof data.metadata.centerFrequency !== "number" ||
    typeof data.metadata.sampleRate !== "number"
  ) {
    throw new Error("Invalid metadata in IQ recording");
  }

  // Validate samples
  if (
    data.samples.some(
      (s: IQSample) => typeof s.I !== "number" || typeof s.Q !== "number",
    )
  ) {
    throw new Error("Invalid sample data in IQ recording");
  }

  return data as IQRecording;
}

/**
 * Export presets to JSON format
 */
export function exportPresets(presets: PresetCollection): string {
  return JSON.stringify(presets, null, 2);
}

/**
 * Import presets from JSON format
 */
export function importPresets(jsonString: string): PresetCollection {
  const data = JSON.parse(jsonString);

  // Validate structure
  if (!data.version || !data.name || !Array.isArray(data.stations)) {
    throw new Error("Invalid preset collection format");
  }

  // Validate stations
  if (
    data.stations.some(
      (s: PresetStation) =>
        !s.name || typeof s.frequency !== "number" || !s.type,
    )
  ) {
    throw new Error("Invalid station data in preset collection");
  }

  return data as PresetCollection;
}

/**
 * Download a file to the user's computer
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = "application/json",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read a file using the File API
 */
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e): void => {
      const result = e.target?.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = (): void => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Read a large file in chunks to avoid memory issues
 * Returns an async generator for streaming processing
 */
export async function* readFileChunked(
  file: File,
  chunkSize: number = 1024 * 1024, // 1MB chunks
): AsyncGenerator<string, void, unknown> {
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e): void => {
        const result = e.target?.result;
        if (typeof result === "string") {
          resolve(result);
        } else {
          reject(new Error("Failed to read chunk"));
        }
      };
      reader.onerror = (): void => reject(new Error("Failed to read chunk"));
      reader.readAsText(chunk);
    });

    yield text;
  }
}

/**
 * Validate file type and size
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number; // bytes
    allowedTypes?: string[]; // MIME types
  } = {},
): { valid: boolean; error?: string } {
  const { maxSize = 100 * 1024 * 1024, allowedTypes = ["application/json"] } =
    options;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum of ${(maxSize / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    // Also check file extension as fallback
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "json") {
      return {
        valid: false,
        error: `File type ${file.type || "unknown"} is not allowed. Expected JSON file.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Create a default IQ recording object
 */
export function createIQRecording(
  samples: IQSample[],
  metadata: IQRecording["metadata"],
): IQRecording {
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    metadata,
    samples,
  };
}

/**
 * Create a default preset collection object
 */
export function createPresetCollection(
  name: string,
  stations: PresetStation[],
  description?: string,
): PresetCollection {
  return {
    version: "1.0",
    name,
    description,
    stations,
  };
}
