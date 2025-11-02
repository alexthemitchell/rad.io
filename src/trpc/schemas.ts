/**
 * Zod schemas for tRPC procedures
 * Provides runtime validation and type inference for device operations
 */

import { z } from 'zod';
import type {
  SDRDeviceInfo,
  SDRCapabilities,
  IQSample,
  DeviceMemoryInfo,
  SDRStreamConfig,
} from '../models/SDRDevice';
import { SDRDeviceType } from '../models/SDRDevice';

/**
 * Device Info Schema
 */
export const deviceInfoSchema = z.object({
  type: z.nativeEnum(SDRDeviceType),
  vendorId: z.number(),
  productId: z.number(),
  serialNumber: z.string().optional(),
  firmwareVersion: z.string().optional(),
  hardwareRevision: z.string().optional(),
}) satisfies z.ZodType<SDRDeviceInfo>;

/**
 * Device Capabilities Schema
 */
export const capabilitiesSchema = z.object({
  minFrequency: z.number(),
  maxFrequency: z.number(),
  supportedSampleRates: z.array(z.number()),
  maxLNAGain: z.number().optional(),
  maxVGAGain: z.number().optional(),
  supportsAmpControl: z.boolean(),
  supportsAntennaControl: z.boolean(),
  supportedBandwidths: z.array(z.number()).optional(),
  maxBandwidth: z.number().optional(),
}) satisfies z.ZodType<SDRCapabilities>;

/**
 * IQ Sample Schema
 */
export const iqSampleSchema = z.object({
  I: z.number(),
  Q: z.number(),
}) satisfies z.ZodType<IQSample>;

/**
 * Device Memory Info Schema
 */
export const memoryInfoSchema = z.object({
  totalBufferSize: z.number(),
  usedBufferSize: z.number(),
  activeBuffers: z.number(),
  maxSamples: z.number(),
  currentSamples: z.number(),
}) satisfies z.ZodType<DeviceMemoryInfo>;

/**
 * Stream Config Schema
 */
export const streamConfigSchema = z
  .object({
    centerFrequency: z.number().optional(),
    sampleRate: z.number().optional(),
    bandwidth: z.number().optional(),
    lnaGain: z.number().optional(),
    vgaGain: z.number().optional(),
    ampEnabled: z.boolean().optional(),
    antennaEnabled: z.boolean().optional(),
  })
  .optional() satisfies z.ZodType<Partial<SDRStreamConfig> | undefined>;

/**
 * Input Schemas
 */
export const setFrequencyInput = z.object({
  frequencyHz: z.number().min(0),
});

export const setSampleRateInput = z.object({
  sampleRateHz: z.number().min(0),
});

export const setLNAGainInput = z.object({
  gainDb: z.number(),
});

export const setVGAGainInput = z.object({
  gainDb: z.number(),
});

export const setAmpEnableInput = z.object({
  enabled: z.boolean(),
});

export const setBandwidthInput = z.object({
  bandwidthHz: z.number().min(0),
});

export const receiveInput = z.object({
  config: streamConfigSchema,
});

export const parseSamplesInput = z.object({
  data: z.instanceof(DataView),
});
