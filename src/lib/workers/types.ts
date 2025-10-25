/**
 * Message types for DSP Worker communication
 * Implements ADR-0002: Web Worker DSP Architecture
 */

export interface DSPMessage {
  id: string;
  type: "fft" | "demod" | "filter" | "detect";
  samples: Float32Array;
  sampleRate: number;
  params: Record<string, any>;
}

export interface DSPResponse {
  id: string;
  type: string;
  result: ArrayBuffer | Float32Array | object;
  processingTime: number;
  error?: string;
}

export interface FFTTask {
  id: string;
  priority: number;
  samples: Float32Array;
  sampleRate: number;
  resolve: (result: FFTResult) => void;
  reject: (error: Error) => void;
}

export interface FFTResult {
  magnitude: Float32Array;
  phase?: Float32Array;
  processingTime: number;
}

export interface ScanResult {
  frequency: number;
  powerSpectrum: Float32Array;
  peakPower: number;
}
