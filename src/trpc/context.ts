/**
 * tRPC Context
 * Provides the context for all tRPC procedures
 */

import type { ISDRDevice } from '../models/SDRDevice';

export interface TRPCContext {
  /**
   * The SDR device instance for this context
   * This is set when the device is selected/connected
   */
  device?: ISDRDevice;
}

/**
 * Create tRPC context
 * @param device - Optional SDR device instance
 */
export function createTRPCContext(device?: ISDRDevice): TRPCContext {
  return {
    device,
  };
}
