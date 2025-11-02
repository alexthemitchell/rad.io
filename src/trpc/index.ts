/**
 * tRPC Module
 * End-to-end type-safe API layer for SDR device operations
 */

export { appRouter, deviceRouter } from './router';
export type { AppRouter } from './router';
export { createTRPCContext } from './context';
export type { TRPCContext } from './context';
export { createTRPCClient } from './client';
export { trpc, TRPCProvider } from './react';
export * from './schemas';
