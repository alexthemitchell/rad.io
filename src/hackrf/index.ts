/**
 * HackRF SDR Driver Module
 * 
 * Provides TypeScript-first WebUSB drivers for HackRF One SDR hardware.
 * Includes device classes, utilities, hooks, and type definitions.
 */

// Core device classes
export { HackRFOne } from "./HackRFOne";
export { HackRFOneAdapter, createHackRFAdapter } from "./HackRFOneAdapter";

// Device utilities and types
export * from "./constants";
export * from "./DeviceInfo";
export * from "./StreamOptions";
export * from "./util";
export * from "./poll";

// React hooks
export { useHackRFDevice } from "./hooks/useHackRFDevice";

// Re-export SDRDevice types for convenience
export type {
  ISDRDevice,
  IQSample,
  IQSampleCallback,
  SDRDeviceInfo,
  SDRCapabilities,
  SDRStreamConfig,
  DeviceMemoryInfo,
} from "../models/SDRDevice";
export { SDRDeviceType, convertInt8ToIQ } from "../models/SDRDevice";
