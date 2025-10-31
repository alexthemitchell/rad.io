# ADR-0009: State Management Pattern

## Status

Accepted

## Context

SDR application state is complex and distributed:

**State Categories**:

1. **Device State**: Connected devices, configurations, streaming status
2. **Radio State**: Frequency, mode, bandwidth, gain, filters
3. **UI State**: Panel visibility, zoom levels, color schemes
4. **Recording State**: Active recordings, playback position
5. **Analysis State**: Detected signals, bookmarks, scan results
6. **Worker State**: Processing status, performance metrics

**Requirements**:

- Multiple components need access to shared state
- State changes trigger re-renders efficiently
- State persists across sessions (some parts)
- Undo/redo for certain operations
- Time-travel debugging during development
- Type-safe state access and updates

**State Management Options**:

| Approach      | Pros               | Cons                                     |
| ------------- | ------------------ | ---------------------------------------- |
| React Context | Native, simple     | Performance issues with frequent updates |
| Redux         | Mature, DevTools   | Boilerplate, learning curve              |
| Zustand       | Simple, performant | Less ecosystem                           |
| Jotai         | Atomic, flexible   | Newer, less mature                       |
| Recoil        | Atomic, powerful   | Meta-specific, heavy                     |
| MobX          | OOP, reactive      | Magic, harder to debug                   |

## Decision

We will use **Zustand** for global state management with **Zustand persist (localStorage) for persistence**.

### Why Zustand?

- **Minimal Boilerplate**: No actions, reducers, or providers
- **Performance**: Selector-based subscriptions prevent unnecessary re-renders
- **TypeScript**: Excellent type inference
- **Small**: ~1KB gzipped
- **DevTools**: Redux DevTools integration
- **Middleware**: Built-in persist, immer, devtools middleware
- **No Context**: Doesn't suffer from context performance issues

### Architecture

```typescript
// src/store/index.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface DeviceState {
  devices: Map<string, SDRDevice>;
  activeDeviceId: string | null;

  addDevice: (device: SDRDevice) => void;
  removeDevice: (id: string) => void;
  setActiveDevice: (id: string) => void;
  updateDevice: (id: string, config: Partial<DeviceConfig>) => void;
}

interface RadioState {
  frequency: FrequencyHz;
  mode: ModulationType;
  bandwidth: number;
  gain: GainDB;
  fftSize: number;

  setFrequency: (freq: FrequencyHz) => void;
  setMode: (mode: ModulationType) => void;
  setBandwidth: (bw: number) => void;
  setGain: (gain: GainDB) => void;
}

interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  colorScheme: "viridis" | "plasma" | "inferno";
  waterfallSpeed: number;

  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark") => void;
  setColorScheme: (scheme: string) => void;
}

interface AppStore extends DeviceState, RadioState, UIState {
  // Computed values
  activeDevice: SDRDevice | null;
}

export const useStore = create<AppStore>()(
  devtools(
    immer((set, get) => ({
      // Device State
      devices: new Map(),
      activeDeviceId: null,

      addDevice: (device) =>
        set((state) => {
          state.devices.set(device.id, device);
        }),

      removeDevice: (id) =>
        set((state) => {
          state.devices.delete(id);
          if (state.activeDeviceId === id) {
            state.activeDeviceId = null;
          }
        }),

      setActiveDevice: (id) =>
        set((state) => {
          state.activeDeviceId = id;
        }),

      updateDevice: (id, config) =>
        set((state) => {
          const device = state.devices.get(id);
          if (device) {
            Object.assign(device.config, config);
          }
        }),

      // Radio State
      frequency: 100_000_000 as FrequencyHz,
      mode: "fm",
      bandwidth: 200_000,
      gain: 20 as GainDB,
      fftSize: 2048,

      setFrequency: (freq) => set({ frequency: freq }),

      setMode: (mode) => set({ mode }),

      setBandwidth: (bw) => set({ bandwidth: bw }),

      setGain: (gain) => set({ gain }),

      // UI State
      sidebarOpen: true,
      theme: "dark",
      colorScheme: "viridis",
      waterfallSpeed: 10,

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setTheme: (theme) => set({ theme }),

      setColorScheme: (scheme) => set({ colorScheme: scheme as any }),

      // Computed
      get activeDevice() {
        const state = get();
        return state.activeDeviceId
          ? (state.devices.get(state.activeDeviceId) ?? null)
          : null;
      },
    })),
  ),
);
```

### Selective Subscriptions

Components subscribe only to state they need:

```typescript
// Subscribe to frequency only
function FrequencyDisplay() {
  const frequency = useStore((state) => state.frequency)
  return <div>{frequency} Hz</div>
}

// Subscribe to multiple values
function RadioControls() {
  const { frequency, mode, setFrequency, setMode } = useStore(
    (state) => ({
      frequency: state.frequency,
      mode: state.mode,
      setFrequency: state.setFrequency,
      setMode: state.setMode
    })
  )

  return (
    <div>
      <FrequencyInput value={frequency} onChange={setFrequency} />
      <ModeSelector value={mode} onChange={setMode} />
    </div>
  )
}

// Shallow equality for objects
function DeviceList() {
  const devices = useStore(
    (state) => Array.from(state.devices.values()),
    shallow  // Compare array contents, not reference
  )

  return <>{devices.map(device => <DeviceCard key={device.id} device={device} />)}</>
}
```

### Persistence Integration

Persist selected state using Zustand's persist middleware (backed by localStorage by default):

```typescript
// src/store/index.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export const useStore = create<AppStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ... same state and actions as above ...
      })),
      {
        name: "sdr-app-store", // storage key in localStorage
        partialize: (state) => ({
          // Persist only small, user-facing preferences
          frequency: state.frequency,
          mode: state.mode,
          bandwidth: state.bandwidth,
          gain: state.gain,
          theme: state.theme,
          colorScheme: state.colorScheme,
          waterfallSpeed: state.waterfallSpeed,
        }),
        version: 1,
      },
    ),
  ),
);

// Optional: custom storage (e.g., IndexedDB) can be wired later if needed
```

### Async Actions

Handle async operations with actions:

```typescript
// src/store/slices/device-slice.ts

export const deviceActions = {
  connectDevice: async (deviceId: string) => {
    const { devices, setActiveDevice } = useStore.getState();
    const device = devices.get(deviceId);

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      await device.open();
      setActiveDevice(deviceId);

      // Start streaming
      for await (const samples of device.getSamples()) {
        // Process samples
        processSamples(samples);
      }
    } catch (error) {
      console.error("Failed to connect device:", error);
      throw error;
    }
  },

  tuneFrequency: async (frequency: FrequencyHz) => {
    const { activeDevice, setFrequency } = useStore.getState();

    if (!activeDevice) {
      throw new Error("No active device");
    }

    // Optimistic update
    setFrequency(frequency);

    try {
      await activeDevice.setFrequency(frequency);
    } catch (error) {
      // Revert on error
      console.error("Failed to tune:", error);
      throw error;
    }
  },
};
```

### Store Slices for Organization

Split large stores into slices:

```typescript
// src/store/slices/device-slice.ts
export const createDeviceSlice = (set, get) => ({
  devices: new Map(),
  activeDeviceId: null,
  addDevice: (device) =>
    set((state) => {
      /* ... */
    }),
  // ...
});

// src/store/slices/radio-slice.ts
export const createRadioSlice = (set, get) => ({
  frequency: 100_000_000,
  mode: "fm",
  setFrequency: (freq) => set({ frequency: freq }),
  // ...
});

// src/store/index.ts
import { createDeviceSlice } from "./slices/device-slice";
import { createRadioSlice } from "./slices/radio-slice";

export const useStore = create()(
  devtools(
    immer((set, get) => ({
      ...createDeviceSlice(set, get),
      ...createRadioSlice(set, get),
    })),
  ),
);
```

### DevTools Integration

Enable Redux DevTools for debugging:

```typescript
export const useStore = create<AppStore>()(
  devtools(immer(/* ... */), {
    name: "SDR-Store",
    enabled: import.meta.env.DEV,
    trace: true,
    traceLimit: 25,
  }),
);
```

## Consequences

### Positive

- **Performance**: Selector-based subscriptions prevent wasted renders
- **Simplicity**: Minimal boilerplate, easy to understand
- **Type Safety**: Full TypeScript support with inference
- **DevTools**: Time-travel debugging during development
- **Flexibility**: Can use outside React (workers, utilities)
- **Size**: Minimal bundle impact (~1KB)
- **Testing**: Easy to test with direct store access

### Negative

- **Less Structure**: No enforced patterns like Redux
- **Learning**: Team must learn Zustand patterns
- **Middleware**: Limited compared to Redux ecosystem
- **Migration**: Moving from Zustand later requires refactor

### Neutral

- Can use Zustand with Redux DevTools
- Store can be accessed outside components
- No provider needed (but can use for testing)

## Testing Strategy

```typescript
// Reset store between tests
beforeEach(() => {
  useStore.setState({
    devices: new Map(),
    activeDeviceId: null,
    frequency: 100_000_000 as FrequencyHz,
    // ...reset all state
  })
})

// Test store directly
test('addDevice adds device to store', () => {
  const device = createMockDevice('1')

  useStore.getState().addDevice(device)

  expect(useStore.getState().devices.has('1')).toBe(true)
})

// Test with React components
test('FrequencyDisplay shows current frequency', () => {
  useStore.setState({ frequency: 100_500_000 as FrequencyHz })

  render(<FrequencyDisplay />)

  expect(screen.getByText(/100.5 MHz/i)).toBeInTheDocument()
})

// Test with custom provider for isolation
test('component with isolated store', () => {
  const store = createStore()

  render(
    <StoreProvider value={store}>
      <RadioControls />
    </StoreProvider>
  )

  // Test in isolation
})
```

## Performance Considerations

- Use shallow equality for array/object selectors
- Memoize complex selectors with `useMemo`
- Split state to minimize subscription surface area
- Use transient updates for high-frequency changes (e.g., waterfall scroll)

```typescript
// Transient updates don't trigger subscribers
useStore.setState({ waterfallOffset: offset }, true); // true = transient
```

## Alternatives Considered

### Alternative 1: React Context

**Rejected**: Performance issues with frequent updates, context propagation overhead

### Alternative 2: Redux Toolkit

**Rejected**: More boilerplate, heavier bundle, overkill for our needs

### Alternative 3: Jotai

**Rejected**: Atomic approach less intuitive for our state shape

### Alternative 4: Recoil

**Rejected**: Heavier bundle, Meta-specific, uncertain future

### Alternative 5: Component State Only

**Rejected**: Prop drilling nightmare, shared state difficult

## References

#### Official Documentation and Libraries

- [Zustand Documentation](https://github.com/pmndrs/zustand) - Official Zustand library and documentation
- [Zustand vs Redux](https://github.com/pmndrs/zustand#why-zustand-over-redux) - Official comparison from Zustand maintainers

#### Academic Research and Comparative Studies

- "Performance and Developer Experience Comparison of Redux, Zustand, and Context API." International Journal of Science and Advanced Technology (2025). [Research Paper](https://www.ijsat.org/papers/2025/2/5026.pdf) - Quantitative study showing Zustand's minimal re-render advantage
- "State Management in React: Comparing Redux Toolkit vs. Zustand." DEV Community (2024). [Technical Article](https://dev.to/hamzakhan/state-management-in-react-comparing-redux-toolkit-vs-zustand-3no) - Developer productivity and performance comparison
- "React State Management Showdown: Redux vs Context API vs Zustand." Java Code Geeks (2025). [Comparative Analysis](https://www.javacodegeeks.com/2025/09/react-state-management-showdown-redux-vs-context-api-vs-zustand.html) - Architecture and scalability trade-offs

#### Technical Articles and Best Practices

- "Zustand vs Redux: A Comprehensive Comparison." Better Stack Community (2024). [Developer Guide](https://betterstack.com/community/guides/scaling-nodejs/zustand-vs-redux/) - Detailed feature comparison and use case guidance
- "State management in React and Next.js: Redux vs Recoil vs Zustand." Perficient (2025). [Technical Blog](https://blogs.perficient.com/2025/07/28/state-management-in-react-and-next-js-redux-vs-recoil-vs-zustand/) - Enterprise perspective on state management choices
- Tkdodo. "Performance Optimization with Zustand." [Technical Article](https://tkdodo.eu/blog/working-with-zustand) - Advanced patterns and optimization techniques
- Kent C. Dodds. "React State Management in 2024" - Industry best practices

#### Related ADRs

- ADR-0005: Storage Strategy for Recordings and State (persistence via Zustand persist)
- ADR-0007: Type Safety and Validation Approach (type-safe state definitions)
