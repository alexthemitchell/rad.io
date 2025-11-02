/**
 * tRPC Router
 * Provides type-safe procedures for SDR device operations
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPCContext } from './context';
import {
  setFrequencyInput,
  setSampleRateInput,
  setLNAGainInput,
  setVGAGainInput,
  setAmpEnableInput,
  setBandwidthInput,
  deviceInfoSchema,
  capabilitiesSchema,
  memoryInfoSchema,
} from './schemas';

/**
 * Initialize tRPC
 */
const t = initTRPC.context<TRPCContext>().create();

/**
 * Middleware to ensure device is available
 */
const requireDevice = t.middleware(({ ctx, next }) => {
  if (!ctx.device) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'No device connected',
    });
  }
  return next({
    ctx: {
      ...ctx,
      device: ctx.device,
    },
  });
});

/**
 * Base procedure
 */
export const publicProcedure = t.procedure;

/**
 * Device procedure (requires device to be connected)
 */
export const deviceProcedure = publicProcedure.use(requireDevice);

/**
 * Device Router
 */
export const deviceRouter = t.router({
  /**
   * Get device information
   */
  getDeviceInfo: deviceProcedure
    .output(deviceInfoSchema)
    .query(async ({ ctx }) => {
      return await ctx.device.getDeviceInfo();
    }),

  /**
   * Get device capabilities
   */
  getCapabilities: deviceProcedure
    .output(capabilitiesSchema)
    .query(({ ctx }) => {
      return ctx.device.getCapabilities();
    }),

  /**
   * Open device
   */
  open: deviceProcedure.mutation(async ({ ctx }) => {
    await ctx.device.open();
  }),

  /**
   * Close device
   */
  close: deviceProcedure.mutation(async ({ ctx }) => {
    await ctx.device.close();
  }),

  /**
   * Check if device is open
   */
  isOpen: deviceProcedure.query(({ ctx }) => {
    return ctx.device.isOpen();
  }),

  /**
   * Set center frequency
   */
  setFrequency: deviceProcedure
    .input(setFrequencyInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.device.setFrequency(input.frequencyHz);
    }),

  /**
   * Get current frequency
   */
  getFrequency: deviceProcedure.query(async ({ ctx }) => {
    return await ctx.device.getFrequency();
  }),

  /**
   * Set sample rate
   */
  setSampleRate: deviceProcedure
    .input(setSampleRateInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.device.setSampleRate(input.sampleRateHz);
    }),

  /**
   * Get current sample rate
   */
  getSampleRate: deviceProcedure.query(async ({ ctx }) => {
    return await ctx.device.getSampleRate();
  }),

  /**
   * Get usable bandwidth
   */
  getUsableBandwidth: deviceProcedure.query(async ({ ctx }) => {
    return await ctx.device.getUsableBandwidth();
  }),

  /**
   * Set LNA gain
   */
  setLNAGain: deviceProcedure
    .input(setLNAGainInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.device.setLNAGain(input.gainDb);
    }),

  /**
   * Set VGA gain (if supported)
   */
  setVGAGain: deviceProcedure
    .input(setVGAGainInput)
    .mutation(async ({ ctx, input }) => {
      if (ctx.device.setVGAGain) {
        await ctx.device.setVGAGain(input.gainDb);
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Device does not support VGA gain control',
        });
      }
    }),

  /**
   * Set amplifier enable
   */
  setAmpEnable: deviceProcedure
    .input(setAmpEnableInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.device.setAmpEnable(input.enabled);
    }),

  /**
   * Set bandwidth (if supported)
   */
  setBandwidth: deviceProcedure
    .input(setBandwidthInput)
    .mutation(async ({ ctx, input }) => {
      if (ctx.device.setBandwidth) {
        await ctx.device.setBandwidth(input.bandwidthHz);
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Device does not support bandwidth control',
        });
      }
    }),

  /**
   * Stop receiving
   */
  stopRx: deviceProcedure.mutation(async ({ ctx }) => {
    await ctx.device.stopRx();
  }),

  /**
   * Check if receiving
   */
  isReceiving: deviceProcedure.query(({ ctx }) => {
    return ctx.device.isReceiving();
  }),

  /**
   * Get memory info
   */
  getMemoryInfo: deviceProcedure
    .output(memoryInfoSchema)
    .query(({ ctx }) => {
      return ctx.device.getMemoryInfo();
    }),

  /**
   * Clear buffers
   */
  clearBuffers: deviceProcedure.mutation(({ ctx }) => {
    ctx.device.clearBuffers();
  }),

  /**
   * Reset device
   */
  reset: deviceProcedure.mutation(async ({ ctx }) => {
    await ctx.device.reset();
  }),

  /**
   * Fast recovery (if supported)
   */
  fastRecovery: deviceProcedure.mutation(async ({ ctx }) => {
    if (ctx.device.fastRecovery) {
      await ctx.device.fastRecovery();
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Device does not support fast recovery',
      });
    }
  }),
});

/**
 * Root router
 */
export const appRouter = t.router({
  device: deviceRouter,
});

export type AppRouter = typeof appRouter;
