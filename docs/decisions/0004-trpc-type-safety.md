# ADR 0004: tRPC for End-to-End Type Safety

## Status

Accepted

## Context

The rad.io project uses TypeScript on the frontend for type safety, but there was no type-safe contract between the UI components and the device communication layer (WebUSB API and device-specific logic). This created several challenges:

1. **Runtime Errors**: Type mismatches between UI and device operations only discovered at runtime
2. **No Autocompletion**: Developers lacked IntelliSense when calling device methods
3. **Validation Gaps**: Input validation was manual and error-prone
4. **Inconsistent Error Handling**: No standardized error types across the application
5. **Developer Experience**: Difficult to discover available device operations and their signatures

Traditional solutions like REST APIs or GraphQL are designed for client-server architectures with network communication. However, rad.io is a browser-only application where the "backend" is just the WebUSB device abstraction layer running in the same JavaScript context.

## Decision

We will use **tRPC** (TypeScript Remote Procedure Call) to create a type-safe API layer between the UI and device operations. Key aspects of this decision:

### 1. Direct-Link Pattern (No HTTP)

Instead of using HTTP or WebSockets, we implement a **direct-link** where tRPC calls are routed directly to the device abstraction layer within the same JavaScript context. This eliminates network overhead while maintaining all tRPC benefits.

```typescript
UI Component → tRPC Router → ISDRDevice → WebUSB API
```

### 2. Observable-Based Communication

We use tRPC's observable pattern with a custom link implementation that:
- Calls the router directly via `appRouter.createCaller()`
- Returns observables that resolve to device operation results
- Maintains full type inference end-to-end

### 3. React Query Integration

We integrate tRPC with React Query to provide:
- Automatic caching of device state
- Optimistic updates for better UX
- Request deduplication
- Background refetching
- Loading and error states

### 4. Zod Schema Validation

We use Zod schemas for runtime validation of:
- Input parameters (e.g., frequency must be positive number)
- Output types (device info, capabilities, etc.)
- Type inference for TypeScript

### 5. Additive Architecture

The tRPC layer is **additive** rather than replacing existing patterns:
- Existing code continues to work
- Components can gradually migrate to tRPC
- Both patterns can coexist during transition

## Implementation Details

### Core Files

- `src/trpc/router.ts`: Device procedures (20+ operations)
- `src/trpc/schemas.ts`: Zod schemas for validation
- `src/trpc/context.ts`: tRPC context with device instance
- `src/trpc/client.ts`: Direct-link client
- `src/trpc/react.tsx`: React Query integration

### Usage Pattern

```tsx
// Wrap app with provider
<TRPCProvider device={device}>
  <App />
</TRPCProvider>

// Use in components
function DeviceControl() {
  const { data: deviceInfo } = trpc.device.getDeviceInfo.useQuery();
  const setFrequency = trpc.device.setFrequency.useMutation();
  
  return (
    <button onClick={() => setFrequency.mutate({ frequencyHz: 100e6 })}>
      Set Frequency
    </button>
  );
}
```

## Consequences

### Positive

1. **Full Type Safety**: Types flow from device interface through tRPC to UI components
2. **Runtime Validation**: Zod schemas catch invalid inputs before device operations
3. **Better DX**: Autocompletion, type checking, and inline documentation in IDE
4. **Consistent Error Handling**: Standardized tRPC errors with proper error codes
5. **React Query Benefits**: Automatic caching, refetching, and state management
6. **Zero Network Overhead**: Direct function calls, no HTTP serialization
7. **Easier Testing**: Mock device operations at tRPC layer instead of device layer
8. **Future-Proof**: Can add HTTP transport later if architecture changes

### Negative

1. **Additional Dependencies**: Adds tRPC, React Query, and Zod (~150KB)
2. **Learning Curve**: Developers need to learn tRPC and React Query patterns
3. **Abstraction Layer**: Adds indirection between UI and device operations
4. **Migration Effort**: Existing code needs gradual migration to tRPC
5. **Query Invalidation**: Need to manage React Query cache invalidation properly

### Neutral

1. **Coexistence Period**: Both direct device calls and tRPC will exist during migration
2. **Testing Complexity**: Need tests at both device and tRPC layers
3. **Documentation Burden**: Need to maintain both device interface and tRPC docs

## Alternatives Considered

### 1. GraphQL

**Pros**: 
- Strong typing
- Query flexibility
- Large ecosystem

**Cons**:
- Heavy for browser-only app
- Requires schema definition language
- Network-oriented design
- Larger bundle size

**Verdict**: Overkill for in-memory function calls

### 2. Zod + Direct Validation

**Pros**:
- Simpler architecture
- Fewer dependencies
- Direct control

**Cons**:
- No automatic type inference
- Manual cache management
- No standardized error handling
- More boilerplate

**Verdict**: Loses many TypeScript benefits

### 3. TypeScript Strict Mode Only

**Pros**:
- No additional dependencies
- Simplest approach
- Minimal bundle size

**Cons**:
- No runtime validation
- No cache management
- No standardized errors
- Manual loading states

**Verdict**: Insufficient for production quality

### 4. MobX State Tree (MST)

**Pros**:
- Runtime types and validation
- State management included
- Type inference

**Cons**:
- Different paradigm (observables vs queries)
- Larger learning curve
- Less community momentum
- Not designed for RPC pattern

**Verdict**: Wrong tool for the job

## Success Metrics

We will measure success by:

1. **Type Safety**: Zero runtime type errors from device operations
2. **Developer Velocity**: Reduced time to implement device features
3. **Code Quality**: Fewer bugs related to device communication
4. **Test Coverage**: Maintained or improved test coverage
5. **Bundle Size**: Keep increase under 200KB gzipped
6. **Migration Rate**: Gradual migration of components to tRPC

## References

- [tRPC Documentation](https://trpc.io/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Zod Documentation](https://zod.dev/)
- [Project Documentation](../TRPC_INTEGRATION.md)

## Notes

- This is the first major architectural addition since project inception
- Consider extracting tRPC pattern into reusable template for other WebUSB projects
- Future work: Add streaming support for IQ sample callbacks via tRPC subscriptions
