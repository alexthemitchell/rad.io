# tRPC Layer

This directory contains the tRPC implementation for type-safe device operations in rad.io.

## Overview

tRPC provides end-to-end type safety from the UI to the device abstraction layer. Since rad.io is a browser-only application, we use a **direct-link pattern** where tRPC calls are routed directly to device operations without HTTP transport.

## Files

### Core Implementation

- **`router.ts`**: tRPC router with all device procedures
  - 20+ procedures covering the full ISDRDevice interface
  - Query procedures for read operations (getFrequency, getDeviceInfo, etc.)
  - Mutation procedures for write operations (setFrequency, open, close, etc.)
  - Error handling with proper tRPC error codes

- **`schemas.ts`**: Zod validation schemas
  - Runtime validation for all inputs and outputs
  - Type inference for TypeScript
  - Schemas for device info, capabilities, IQ samples, etc.

- **`context.ts`**: tRPC context creation
  - Provides device instance to all procedures
  - Simple context structure with optional device

- **`client.ts`**: Direct-link tRPC client
  - Custom link that calls router directly (no HTTP)
  - Observable-based for async operations
  - Zero network overhead

- **`react.tsx`**: React integration
  - TRPCProvider component wrapping React Query
  - Custom link for React Query integration
  - Query client configuration

- **`index.ts`**: Public exports
  - Re-exports all tRPC utilities
  - Single import point for consumers

### Testing

- **`__tests__/router.test.ts`**: Router procedure tests
  - 24 tests covering all device operations
  - Error handling tests
  - Mock device setup

## Usage

### 1. Setup Provider

```tsx
import { TRPCProvider } from './trpc';
import { QueryClient } from '@tanstack/react-query';

function App() {
  const [device, setDevice] = useState<ISDRDevice>();
  
  // Optional: Provide custom QueryClient
  const queryClient = new QueryClient();

  return (
    <TRPCProvider device={device} queryClient={queryClient}>
      <YourComponents />
    </TRPCProvider>
  );
}
```

**Note**: The `queryClient` prop is optional and will be created automatically if not provided.

### 2. Use in Components

```tsx
import { trpc } from './trpc';

function DeviceControl() {
  // Queries (read operations)
  const { data: frequency } = trpc.device.getFrequency.useQuery();
  const { data: deviceInfo } = trpc.device.getDeviceInfo.useQuery();

  // Mutations (write operations)
  const setFrequency = trpc.device.setFrequency.useMutation({
    onSuccess: () => console.log('Frequency set!'),
  });

  return (
    <button onClick={() => setFrequency.mutate({ frequencyHz: 100e6 })}>
      Set to 100 MHz
    </button>
  );
}
```

### 3. Pre-built Hooks

For convenience, use pre-built hooks from `src/hooks/useDeviceWithTRPC.ts`:

```tsx
import { useDeviceInfo, useSetFrequency } from '../hooks/useDeviceWithTRPC';

function DeviceControl() {
  const { data: deviceInfo } = useDeviceInfo();
  const setFrequency = useSetFrequency();

  return <button onClick={() => setFrequency.mutate({ frequencyHz: 100e6 })}>
    Set Frequency
  </button>;
}
```

## Architecture

### Direct-Link Pattern

```
┌─────────────┐
│  React UI   │
│ Components  │
└──────┬──────┘
       │ tRPC Query/Mutation
       ▼
┌─────────────┐
│    tRPC     │
│   Router    │ (no HTTP, direct calls)
└──────┬──────┘
       │ appRouter.createCaller(ctx)
       ▼
┌─────────────┐
│  ISDRDevice │
│  Interface  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   WebUSB    │
│     API     │
└─────────────┘
```

### Benefits

1. **Type Safety**: Full type inference from device to UI
2. **Runtime Validation**: Zod schemas catch invalid inputs
3. **Autocompletion**: IntelliSense for all operations
4. **React Query**: Automatic caching, refetching, loading states
5. **Zero Overhead**: Direct function calls, no HTTP serialization

## Adding New Procedures

To add a new device operation:

1. **Define Zod schema** in `schemas.ts`:
```typescript
export const myOperationInput = z.object({
  param: z.number(),
});
```

2. **Add procedure** in `router.ts`:
```typescript
myOperation: deviceProcedure
  .input(myOperationInput)
  .mutation(async ({ ctx, input }) => {
    return await ctx.device.myOperation(input.param);
  }),
```

3. **Add helper hook** in `src/hooks/useDeviceWithTRPC.ts`:
```typescript
export function useMyOperation() {
  return trpc.device.myOperation.useMutation();
}
```

4. **Add tests** in `__tests__/router.test.ts`:
```typescript
it('should perform my operation', async () => {
  const ctx = createTRPCContext(mockDevice);
  const caller = appRouter.createCaller(ctx);

  await caller.device.myOperation({ param: 42 });

  expect(mockDevice.myOperation).toHaveBeenCalledWith(42);
});
```

## Error Handling

tRPC provides typed errors:

```tsx
const setFrequency = trpc.device.setFrequency.useMutation({
  onError: (error) => {
    if (error.data?.code === 'PRECONDITION_FAILED') {
      // No device connected
    } else if (error.data?.code === 'BAD_REQUEST') {
      // Invalid input
    }
  },
});
```

## Testing

Test procedures directly:

```typescript
import { appRouter } from '../router';
import { createTRPCContext } from '../context';

const ctx = createTRPCContext(mockDevice);
const caller = appRouter.createCaller(ctx);

// Test query
const result = await caller.device.getFrequency();
expect(result).toBe(100e6);

// Test mutation
await caller.device.setFrequency({ frequencyHz: 88.5e6 });
expect(mockDevice.setFrequency).toHaveBeenCalledWith(88.5e6);
```

## Documentation

See [`docs/TRPC_INTEGRATION.md`](../../docs/TRPC_INTEGRATION.md) for complete guide including:
- Setup instructions
- Usage examples
- Error handling patterns
- Migration guide from direct device calls
- Best practices

## Related

- **ISDRDevice Interface**: `src/models/SDRDevice.ts`
- **Helper Hooks**: `src/hooks/useDeviceWithTRPC.ts`
- **Documentation**: `docs/TRPC_INTEGRATION.md`
- **ADR**: `docs/decisions/0004-trpc-type-safety.md`
