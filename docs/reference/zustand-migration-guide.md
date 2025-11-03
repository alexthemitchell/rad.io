# Zustand Migration Guide

This guide helps developers understand the state management migration from React Context to Zustand.

## Overview

The rad.io application has migrated from React Context API to [Zustand](https://github.com/pmndrs/zustand) for state management. This improves performance, especially with high-frequency updates from SDR devices.

## For Component Developers

### Using State in Components

The migration is mostly transparent - the same hooks work as before:

```typescript
// Before and After - Same API!
import {
  useSettings,
  useFrequency,
  useDevice,
  useNotifications,
} from "../contexts";

function MyComponent() {
  const { settings, setSettings } = useSettings();
  const { frequencyHz, setFrequencyHz } = useFrequency();
  const { devices, primaryDevice } = useDevice();
  const { notify } = useNotifications();

  // Use as before
}
```

### Recommended: Direct Store Import (New Code)

For new code, prefer importing directly from the store:

```typescript
import { useSettings, useFrequency } from "../store";

function MyComponent() {
  const { settings, setSettings } = useSettings();
  // ...
}
```

### No More Providers

You no longer need to wrap components in Context providers:

```typescript
// ❌ Before - needed providers
<SettingsProvider>
  <FrequencyProvider>
    <MyComponent />
  </FrequencyProvider>
</SettingsProvider>

// ✅ After - no providers needed
<MyComponent />
```

### Accessing Store Outside Components

Zustand allows accessing the store outside React components:

```typescript
import { useStore } from "../store";

// Get current state anywhere
const currentFrequency = useStore.getState().frequencyHz;

// Update state anywhere
useStore.getState().setFrequencyHz(100_000_000);

// Subscribe to changes
const unsubscribe = useStore.subscribe(
  (state) => state.frequencyHz,
  (frequencyHz) => {
    console.log("Frequency changed:", frequencyHz);
  },
);
```

## For Test Writers

### Before: Required Providers

```typescript
// Old way - needed providers in tests
render(
  <SettingsProvider>
    <FrequencyProvider>
      <MyComponent />
    </FrequencyProvider>
  </SettingsProvider>
);
```

### After: No Providers Needed

```typescript
// New way - no providers!
render(<MyComponent />);

// Reset store between tests
beforeEach(() => {
  const state = useStore.getState();
  state.resetSettings();
  state.setFrequencyHz(100_000_000);
});
```

### Manipulating State in Tests

```typescript
import { useStore } from '../store';

it('does something when frequency changes', () => {
  const { getByText } = render(<MyComponent />);

  // Directly manipulate store
  useStore.getState().setFrequencyHz(88_500_000);

  // Assert based on new state
  expect(getByText('88.5 MHz')).toBeInTheDocument();
});
```

### Mocking the Store

```typescript
import { useStore } from "../store";

beforeEach(() => {
  // Reset store to known state
  useStore.setState({
    frequencyHz: 100_000_000,
    settings: {
      highPerf: false,
      vizMode: "fft",
      // ... other defaults
    },
  });
});
```

## Store Architecture

### Slices

The store is organized into slices, each managing a specific domain:

1. **Settings Slice** (`settingsSlice.ts`)
   - Visualization settings (FFT size, color map, etc.)
   - Persisted to localStorage
   - Includes validation logic

2. **Frequency Slice** (`frequencySlice.ts`)
   - Current tuned frequency (VFO)
   - Simple number state

3. **Notification Slice** (`notificationSlice.ts`)
   - Toast notifications
   - Auto-cleanup with timeouts

4. **Device Slice** (`deviceSlice.ts`)
   - SDR device connections
   - Integrates with React hooks via `useDeviceIntegration`

### Adding New State

To add new state to an existing slice:

```typescript
// In settingsSlice.ts
export interface SettingsState {
  // ... existing fields
  myNewSetting: boolean;
}

const DEFAULTS: SettingsState = {
  // ... existing defaults
  myNewSetting: false,
};

export const settingsSlice: StateCreator<SettingsSlice> = (set) => ({
  // ... existing implementation works automatically
});
```

### Creating a New Slice

1. Create `src/store/slices/mySlice.ts`:

```typescript
import { StateCreator } from "zustand";

export interface MyState {
  value: string;
}

export interface MySlice extends MyState {
  setValue: (value: string) => void;
}

export const mySlice: StateCreator<MySlice> = (set) => ({
  value: "",
  setValue: (value: string) => {
    set({ value });
  },
});
```

1. Add to root store in `src/store/index.ts`:

```typescript
import { mySlice, type MySlice } from "./slices/mySlice";

export type RootState = SettingsSlice & FrequencySlice & MySlice;

export const useStore = create<RootState>()(
  devtools(
    (...args) => ({
      ...settingsSlice(...args),
      ...frequencySlice(...args),
      ...mySlice(...args),
    }),
    { name: "rad.io-store" },
  ),
);

// Add convenience hook
export const useMySlice = (): {
  value: string;
  setValue: (value: string) => void;
} => {
  const value = useStore((state) => state.value);
  const setValue = useStore((state) => state.setValue);
  return { value, setValue };
};
```

1. Export from `src/contexts/index.ts` for backward compatibility:

```typescript
export { useMySlice } from "../store";
```

## Performance Best Practices

### Selector Optimization

```typescript
// ✅ Good - subscribes only to frequencyHz
const frequencyHz = useStore((state) => state.frequencyHz);

// ❌ Bad - subscribes to all state changes
const state = useStore();
const frequencyHz = state.frequencyHz;
```

### Avoiding Unnecessary Re-renders

```typescript
// ✅ Good - stable selectors
export const useSettings = () => {
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  return { settings, setSettings };
};

// ❌ Bad - creates new object every time, causing infinite re-renders
export const useSettings = () =>
  useStore((state) => ({
    settings: state.settings,
    setSettings: state.setSettings,
  }));
```

### Selective Updates

```typescript
// ✅ Good - only updates what changed
setSettings({ highPerf: true });

// ❌ Bad - replaces entire object
setSettings({ ...settings, highPerf: true });
```

## Debugging with Redux DevTools

Zustand integrates with Redux DevTools:

1. Install Redux DevTools extension in your browser
2. Open DevTools and navigate to Redux tab
3. See all state changes, time-travel debug, etc.

The store is configured with the name `rad.io-store`.

## Common Patterns

### Derived State

```typescript
// Compute derived state in the selector
const isHighFrequency = useStore((state) => state.frequencyHz > 1_000_000_000);
```

### Async Actions

```typescript
// In deviceSlice.ts
closeDevice: async (deviceId: DeviceId): Promise<void> => {
  const state = get();
  const entry = state.devices.get(deviceId);

  if (!entry) return;

  try {
    await entry.device.close();
    state.removeDevice(deviceId);
  } catch (err) {
    // Handle error
  }
};
```

### Middleware

Zustand supports middleware for cross-cutting concerns:

```typescript
import { persist } from "zustand/middleware";

// Example: persist settings to localStorage
export const useStore = create<RootState>()(
  devtools(
    persist(
      (...args) => ({
        ...settingsSlice(...args),
        // ...
      }),
      { name: "rad.io-storage" },
    ),
  ),
);
```

## Troubleshooting

### Infinite Re-renders

**Problem**: Component re-renders infinitely.

**Solution**: Check selector stability. Make sure you're not creating new objects in selectors.

### State Not Updating

**Problem**: State changes but component doesn't re-render.

**Solution**: Ensure you're subscribing to the right part of state with `useStore((state) => state.field)`.

### Tests Failing with Stale State

**Problem**: Tests fail because state persists between tests.

**Solution**: Reset store in `beforeEach`:

```typescript
beforeEach(() => {
  useStore.getState().resetSettings();
  // Reset other slices as needed
});
```

## Migration Checklist

When migrating a component:

- [ ] Remove Context provider wrappers
- [ ] Update imports to use barrel export or direct store import
- [ ] Verify component still works
- [ ] Update tests to remove providers
- [ ] Verify tests pass
- [ ] Check for performance improvements

## Resources

- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [ADR-0019: Zustand State Management](../decisions/ADR-0019-zustand-state-management.md)
- [Store Tests](../../src/store/__tests__/store.test.ts) - Examples of testing the store
