# tRPC Integration Guide

## Overview

rad.io uses [tRPC](https://trpc.io/) to provide end-to-end type safety between the UI and device operations. This eliminates runtime errors and provides excellent developer experience with autocompletion and type checking.

## Architecture

Since rad.io is a browser-only application without a traditional backend, we use a **direct-link pattern** where tRPC calls are routed directly to the device abstraction layer without HTTP transport.

```
┌─────────────┐      ┌──────────┐      ┌─────────────┐
│  React UI   │─────▶│   tRPC   │─────▶│  ISDRDevice │
│ Components  │◀─────│  Router  │◀─────│  Interface  │
└─────────────┘      └──────────┘      └─────────────┘
      ▲                    │                    │
      │              Type Safety          Device Logic
      │                    │                    │
      └────────────────────┴────────────────────┘
           Full Type Inference & Validation
```

## Key Features

1. **End-to-End Type Safety**: Types are shared between client and server
2. **Runtime Validation**: Zod schemas validate all inputs and outputs
3. **Autocompletion**: Full IntelliSense support in IDE
4. **Error Handling**: Typed errors with proper error codes
5. **React Query Integration**: Automatic caching, refetching, and state management

## Setup

### 1. Wrap Your App with TRPCProvider

```tsx
import { TRPCProvider } from './trpc';
import { QueryClient } from '@tanstack/react-query';
import { ISDRDevice } from './models/SDRDevice';

function App() {
  const [device, setDevice] = useState<ISDRDevice | undefined>();
  
  // Optional: Create your own QueryClient if you need custom configuration
  // If not provided, TRPCProvider will create one with sensible defaults
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5000,
        // ... your custom options
      },
    },
  });

  return (
    <TRPCProvider device={device} queryClient={queryClient}>
      <YourAppComponents />
    </TRPCProvider>
  );
}
```

**Note**: The `queryClient` prop is optional. If you need to share a QueryClient across multiple providers or customize the default options, pass your own instance. Otherwise, TRPCProvider will create one automatically.

### 2. Use tRPC Hooks in Components

```tsx
import { trpc } from '../trpc';

function DeviceControl() {
  // Queries
  const { data: deviceInfo, isLoading, error } = trpc.device.getDeviceInfo.useQuery();
  const { data: frequency } = trpc.device.getFrequency.useQuery();

  // Mutations
  const setFrequency = trpc.device.setFrequency.useMutation({
    onSuccess: () => {
      console.log('Frequency set successfully');
    },
    onError: (error) => {
      console.error('Failed to set frequency:', error);
    },
  });

  return (
    <div>
      <h2>{deviceInfo?.type}</h2>
      <p>Current Frequency: {frequency ? `${frequency / 1e6} MHz` : 'Unknown'}</p>
      <button
        onClick={() => setFrequency.mutate({ frequencyHz: 100e6 })}
        disabled={setFrequency.isLoading}
      >
        Set to 100 MHz
      </button>
    </div>
  );
}
```

## Available Procedures

### Queries (Read Operations)

- `device.getDeviceInfo()` - Get device information
- `device.getCapabilities()` - Get device capabilities
- `device.isOpen()` - Check if device is open
- `device.getFrequency()` - Get current frequency
- `device.getSampleRate()` - Get current sample rate
- `device.getUsableBandwidth()` - Get usable bandwidth
- `device.isReceiving()` - Check if receiving
- `device.getMemoryInfo()` - Get memory information

### Mutations (Write Operations)

- `device.open()` - Open device
- `device.close()` - Close device
- `device.setFrequency({ frequencyHz })` - Set frequency
- `device.setSampleRate({ sampleRateHz })` - Set sample rate
- `device.setLNAGain({ gainDb })` - Set LNA gain
- `device.setVGAGain({ gainDb })` - Set VGA gain (if supported)
- `device.setAmpEnable({ enabled })` - Enable/disable amplifier
- `device.setBandwidth({ bandwidthHz })` - Set bandwidth (if supported)
- `device.stopRx()` - Stop receiving
- `device.clearBuffers()` - Clear device buffers
- `device.reset()` - Reset device
- `device.fastRecovery()` - Perform fast recovery (if supported)

## Helper Hooks

Pre-built hooks are available in `src/hooks/useDeviceWithTRPC.ts`:

```tsx
import {
  useDeviceInfo,
  useCurrentFrequency,
  useSetFrequency,
} from './hooks/useDeviceWithTRPC';

function MyComponent() {
  const { data: deviceInfo } = useDeviceInfo();
  const { data: frequency } = useCurrentFrequency();
  const setFrequency = useSetFrequency();

  return (
    <div>
      <h2>{deviceInfo?.type}</h2>
      <button onClick={() => setFrequency.mutate({ frequencyHz: 88.5e6 })}>
        Tune to 88.5 FM
      </button>
    </div>
  );
}
```

## Error Handling

tRPC provides typed errors:

```tsx
const setFrequency = trpc.device.setFrequency.useMutation({
  onError: (error) => {
    if (error.data?.code === 'PRECONDITION_FAILED') {
      console.error('No device connected');
    } else if (error.data?.code === 'BAD_REQUEST') {
      console.error('Invalid frequency:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
  },
});
```

## React Query Options

All tRPC hooks accept standard React Query options:

```tsx
// Disable automatic refetching
const { data } = trpc.device.getFrequency.useQuery(undefined, {
  refetchOnWindowFocus: false,
  refetchInterval: false,
});

// Enable polling
const { data } = trpc.device.getMemoryInfo.useQuery(undefined, {
  refetchInterval: 1000, // Poll every second
});

// Mutation with callbacks
const setFrequency = trpc.device.setFrequency.useMutation({
  onSuccess: (data) => {
    // Invalidate queries to refetch
    queryClient.invalidateQueries(['device', 'getFrequency']);
  },
  onError: (error) => {
    // Handle error
  },
  onSettled: () => {
    // Always runs
  },
});
```

## Direct Client Usage

For non-React contexts, use the direct client:

```tsx
import { createTRPCClient } from './trpc';

const device = myDeviceInstance;
const client = createTRPCClient(device);

// Call procedures directly
const info = await client.device.getDeviceInfo.query();
await client.device.setFrequency.mutate({ frequencyHz: 100e6 });
```

## Type Safety Examples

### Input Validation

```tsx
// TypeScript will error if you pass wrong types
setFrequency.mutate({ frequencyHz: '100MHz' }); // ❌ Error: string not assignable to number
setFrequency.mutate({ frequencyHz: -1 }); // ❌ Runtime error: must be >= 0
```

### Output Types

```tsx
const { data: deviceInfo } = trpc.device.getDeviceInfo.useQuery();

// TypeScript knows the exact type of deviceInfo
if (deviceInfo) {
  console.log(deviceInfo.type); // ✓ SDRDeviceType
  console.log(deviceInfo.vendorId); // ✓ number
  console.log(deviceInfo.unknownField); // ❌ Error: property doesn't exist
}
```

## Adding New Procedures

To add a new device operation:

1. **Add to ISDRDevice interface** (if not already present)
2. **Add Zod schema** in `src/trpc/schemas.ts`
3. **Add procedure** to `src/trpc/router.ts`
4. **Add helper hook** in `src/hooks/useDeviceWithTRPC.ts`
5. **Add tests** in `src/trpc/__tests__/router.test.ts`

Example:

```typescript
// 1. schemas.ts
export const getSignalStrengthInput = z.object({
  frequencyHz: z.number().min(0),
});

// 2. router.ts
getSignalStrength: deviceProcedure
  .input(getSignalStrengthInput)
  .query(async ({ ctx, input }) => {
    return await ctx.device.getSignalStrength(input.frequencyHz);
  }),

// 3. useDeviceWithTRPC.ts
export function useGetSignalStrength() {
  return trpc.device.getSignalStrength.useQuery();
}
```

## Best Practices

1. **Always use TRPCProvider**: Wrap your app at the appropriate level
2. **Handle loading states**: Use `isLoading` and `isFetching` from queries
3. **Handle errors gracefully**: Provide user feedback on failures
4. **Invalidate queries**: After mutations, invalidate related queries
5. **Use optimistic updates**: For better UX on mutations
6. **Batch operations**: Group related operations when possible

## Migration Guide

To migrate existing device operations to tRPC:

### Before (Direct Device Calls)

```tsx
function MyComponent({ device }: { device: ISDRDevice }) {
  const [frequency, setFrequency] = useState<number>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    device.getFrequency()
      .then(setFrequency)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [device]);

  const handleSetFrequency = async (newFreq: number) => {
    try {
      await device.setFrequency(newFreq);
      const updated = await device.getFrequency();
      setFrequency(updated);
    } catch (error) {
      console.error(error);
    }
  };

  return <div>{frequency}</div>;
}
```

### After (tRPC)

```tsx
function MyComponent() {
  const { data: frequency, isLoading } = trpc.device.getFrequency.useQuery();
  const setFrequency = trpc.device.setFrequency.useMutation();

  const handleSetFrequency = (newFreq: number) => {
    setFrequency.mutate({ frequencyHz: newFreq });
  };

  return <div>{frequency}</div>;
}
```

## Resources

- [tRPC Documentation](https://trpc.io/docs)
- [React Query Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [Zod Documentation](https://zod.dev/)
