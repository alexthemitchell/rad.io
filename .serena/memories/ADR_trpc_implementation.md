# tRPC Implementation Architecture

## Overview
rad.io uses tRPC for end-to-end type safety between UI and device operations. Unlike typical tRPC setups, we use a **direct-link pattern** (no HTTP) since the "backend" is just the WebUSB device layer in the same browser context.

## Key Files
- `src/trpc/router.ts` - Device procedures (20+ operations)
- `src/trpc/schemas.ts` - Zod validation schemas
- `src/trpc/context.ts` - Context with device instance
- `src/trpc/client.ts` - Direct-link client (no HTTP)
- `src/trpc/react.tsx` - React Query integration
- `src/hooks/useDeviceWithTRPC.ts` - Pre-built hooks

## Usage Pattern
```tsx
// 1. Wrap app with TRPCProvider
<TRPCProvider device={device}>
  <App />
</TRPCProvider>

// 2. Use hooks in components
const { data } = trpc.device.getFrequency.useQuery();
const setFreq = trpc.device.setFrequency.useMutation();
```

## Architecture Decisions
- **Direct-link**: Calls router directly via `appRouter.createCaller()` (no HTTP)
- **Observable pattern**: Returns tRPC observables for async operations
- **React Query**: Automatic caching, refetching, loading states
- **Zod validation**: Runtime type checking of inputs/outputs
- **Additive**: Coexists with existing direct device calls

## Benefits
- Full type inference from device interface to UI
- Runtime validation catches invalid inputs
- Autocompletion and IntelliSense in IDE
- Standardized error handling
- Zero network overhead (direct function calls)

## Important Notes
- Pre-existing ESLint issue unrelated to tRPC (TypeScript plugin bug)
- All 2,040+ tests pass with tRPC additions
- Bundle size increase ~150KB (tRPC + React Query + Zod)
- Migration is gradual - both patterns coexist

## Testing
- Test router procedures via `appRouter.createCaller(ctx)`
- Mock device at tRPC layer instead of device layer
- Use `renderHook` with `TRPCProvider` wrapper for React hooks

## Adding Procedures
1. Add Zod schema in `schemas.ts`
2. Add procedure in `router.ts`
3. Add helper hook in `useDeviceWithTRPC.ts`
4. Add tests in `__tests__/`

See `docs/TRPC_INTEGRATION.md` for complete guide.
