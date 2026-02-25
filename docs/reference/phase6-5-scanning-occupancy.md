# Phase 6.5 Scanning And Occupancy Evidence

Implementation anchor:

- `src/measurements/phase65ScanningOccupancy.ts`
- `src/measurements/phase65ScanningOccupancy.test.ts`
- `src/App.tsx`

## Scope Summary

This implementation delivers a workflow-oriented wideband scan mode with occupancy logging:

- Configurable wideband tune/settle/measure sweep (`start/stop/step`, `settle`, `dwell`, `hold`, threshold)
- Persistence/hold behavior for recently detected channels
- Occupancy statistics per scanned bin (`hits`, `sweeps`, occupancy ratio, last detection)
- Deterministic occupancy export in both JSON and CSV
- UI flow to run/cancel scans, inspect active bins, tune directly from results, and clear/export logs

## Data Contract

`WidebandOccupancyLog` (schema v1) stores durable occupancy evidence:

- `sweeps`: total completed sweep passes
- `bins[]`: per-frequency counters and hold state
- `updatedAtIso`: last log update timestamp

Persistence is stored in localStorage under `rad.io.phase65.widebandOccupancy.v1`, following lightweight workflow-state patterns already used by the app.

## Test Coverage

`src/measurements/phase65ScanningOccupancy.test.ts` covers:

- scan config normalization and frequency plan generation
- occupancy updates with hold/persistence behavior
- detection summarization for nearby bins
- CSV export formatting
- storage save/load round-trip behavior
