/**
 * tRPC React Hooks
 * Provides React Query integration for type-safe device operations
 */

import { createTRPCReact } from '@trpc/react-query';
import { observable } from '@trpc/server/observable';
import type { AppRouter } from './router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { appRouter } from './router';
import { createTRPCContext } from './context';
import type { ISDRDevice } from '../models/SDRDevice';

/**
 * tRPC React instance
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Custom link for tRPC React that calls router directly
 */
function createDirectReactLink(device?: ISDRDevice) {
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

interface TRPCProviderProps {
  children: React.ReactNode;
  device?: ISDRDevice;
  queryClient?: QueryClient;
}

/**
 * tRPC Provider component
 * Wraps the application with tRPC and React Query context
 * 
 * @param queryClient - Optional QueryClient instance. If not provided, a new one will be created.
 *                      Provide your own QueryClient if you need to share it across multiple providers
 *                      or customize the default options.
 */
export function TRPCProvider({ children, device, queryClient: providedQueryClient }: TRPCProviderProps) {
  const queryClient = useMemo(
    () =>
      providedQueryClient ||
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
    [providedQueryClient]
  );

  const trpcClient = useMemo(
    () =>
      trpc.createClient({
        links: [createDirectReactLink(device)],
      }),
    [device]
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
