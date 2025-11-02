/**
 * tRPC Client
 * Provides type-safe client for device operations
 */

import { createTRPCProxyClient } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { AppRouter } from './router';
import { appRouter } from './router';
import { createTRPCContext } from './context';
import type { ISDRDevice } from '../models/SDRDevice';

/**
 * Custom link that calls the router directly without HTTP
 * This is suitable for a browser-only application where the "backend"
 * is just the device abstraction layer
 */
function createDirectLink(device?: ISDRDevice) {
  return () => {
    return ({ op }: { op: { type: string; path: string; input?: unknown } }) => {
      return observable((observer) => {
        (async () => {
          try {
            const ctx = createTRPCContext(device);
            const caller = appRouter.createCaller(ctx);

            const pathParts = op.path.split('.');
            let result: unknown = caller;

            for (const part of pathParts) {
              result = (result as Record<string, unknown>)[part];
            }

            if (typeof result !== 'function') {
              throw new Error(`Invalid procedure: ${op.path}`);
            }

            if (op.type === 'query' || op.type === 'mutation') {
              const data = await (result as (input?: unknown) => Promise<unknown>)(op.input);
              observer.next({ result: { data } });
              observer.complete();
            } else {
              throw new Error(`Unsupported operation type: ${op.type}`);
            }
          } catch (error) {
            observer.error(error as Error);
          }
        })();
      });
    };
  };
}

/**
 * Create tRPC client with the current device
 */
export function createTRPCClient(device?: ISDRDevice) {
  return createTRPCProxyClient<AppRouter>({
    links: [createDirectLink(device)],
  });
}
