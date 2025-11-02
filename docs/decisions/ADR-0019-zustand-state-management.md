# ADR-0019: Zustand for State Management

## Status

Accepted

## Context

The application originally used React's Context API for state management across multiple contexts (DeviceContext, SettingsContext, FrequencyContext, NotificationContext). While Context API is suitable for smaller applications, the rad.io application faces specific challenges:

1. **High-frequency updates from SDR devices**: The application receives continuous data streams from SDR hardware, causing frequent state updates
2. **Performance concerns**: Context API causes all consumers to re-render when any part of the context changes, even if they don't use the updated values
3. **Complex state logic**: As the application grows, managing state across multiple contexts becomes increasingly complex
4. **Developer experience**: Context requires provider wrappers and can be verbose, especially with multiple contexts

## Decision

We have adopted [Zustand](https://github.com/pmndrs/zustand) as our state management solution, replacing the React Context API while maintaining backward compatibility.

### Why Zustand?

1. **Lightweight**: Zustand is only 1.2KB minified + gzipped (compared to Redux Toolkit's ~10KB)
2. **Simpler API**: No providers, no boilerplate - just create a store and use hooks
3. **Better performance**: Components only re-render when their specific slice changes
4. **TypeScript-first**: Excellent TypeScript support with full type inference
5. **DevTools support**: Works with Redux DevTools for debugging
6. **React-agnostic**: The store can be used outside React components if needed

### Why not Redux Toolkit?

While Redux Toolkit was considered (as mentioned in the original feature request), we chose Zustand because:

- Redux Toolkit has significantly more boilerplate
- Zustand provides similar benefits with a simpler API
- For this application's size, Zustand offers the right balance of power and simplicity
- Zustand is easier to learn and maintain for future contributors

## Implementation

### Store Structure

The store is organized into slices, each managing a specific domain:

```
src/store/
├── index.ts                          # Root store with combined slices
├── slices/
│   ├── settingsSlice.ts             # Visualization settings
│   ├── frequencySlice.ts            # VFO frequency
│   ├── notificationSlice.ts         # Toast notifications
│   └── deviceSlice.ts               # SDR device connections
└── __tests__/
    └── store.test.ts                # Store tests
```

### Migration Strategy

1. **Backward compatibility**: The old Context hooks (`useSettings`, `useFrequency`, etc.) are re-exported from `src/contexts/index.ts`, so existing components work without changes
2. **Gradual adoption**: New code can import directly from `src/store` while old code continues using `src/contexts`
3. **No breaking changes**: The migration is transparent to consumers - the hook interfaces remain identical

### Special Handling: Device Slice

The device slice required special attention because it depends on React hooks (`useUSBDevice`). We created a `useDeviceIntegration` hook that bridges React hooks with the Zustand store. This hook is called once in `App.tsx` to set up device management.

### Selector Memoization

To prevent infinite re-renders, selector functions are properly memoized:

```typescript
// ❌ Wrong - creates new object on every call
export const useSettings = () => 
  useStore((state) => ({
    settings: state.settings,
    setSettings: state.setSettings,
  }));

// ✅ Correct - individual selectors are stable
export const useSettings = () => {
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  return { settings, setSettings };
};
```

## Consequences

### Positive

1. **Better performance**: Components re-render only when their specific state changes
2. **Simpler code**: No need for provider wrappers or context consumers
3. **Better DX**: Excellent TypeScript support and DevTools integration
4. **Easier testing**: Stores can be easily reset and manipulated in tests
5. **More scalable**: Better handles complex state logic as the app grows

### Negative

1. **Learning curve**: Team members need to learn Zustand API
2. **Migration effort**: Existing Context code needs to be migrated over time
3. **Additional dependency**: Adds Zustand to the dependency list (though it's very small)

### Neutral

1. **Compatibility layer**: The `src/contexts/index.ts` re-export layer will remain until all code is migrated
2. **Testing adjustments**: Tests no longer need Context providers, but need proper store reset between tests

## Future Considerations

1. **Complete migration**: Over time, migrate all Context imports to use the store directly
2. **Persist middleware**: Consider adding `persist` middleware for more state (currently only settings use localStorage)
3. **Immer middleware**: For complex state updates, consider adding Immer middleware
4. **Remove compatibility layer**: Once all code is migrated, remove `src/contexts/index.ts` re-exports

## References

- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Original Issue](https://github.com/alexthemitchell/rad.io/issues/XX) - Feature request for state management
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/) - Alternative considered
