# Conventions (Current + Intended)

## Language
- TypeScript is the primary language target (roadmap calls for strict TS, avoid any).

## Architecture Conventions (from roadmap)
- Prefer explicit, versioned contracts at boundaries:
  - Worker message schemas
  - Device/source interfaces (Mock/File/WebUSB)
  - Error taxonomy and retryability
- Use deterministic sources + fixtures to validate DSP correctness.
- Treat audio safety and “degraded mode” behavior as first-class requirements.

## Documentation
- Roadmap lives at docs/ROADMAP.md.
- ADRs are expected under docs/decisions/ (roadmap item added to create template/numbering).

## Testing Philosophy (from roadmap)
- Unit tests for DSP and critical state.
- Simulated e2e and real-device e2e split.
- Regression fixtures and scenario-based tests for discontinuities/backpressure.
