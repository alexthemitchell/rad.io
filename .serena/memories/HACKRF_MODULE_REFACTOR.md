# HackRF Module Refactoring

## Overview
Successfully refactored all HackRF-specific code from `src/models/` and `src/hooks/` into a dedicated `src/hackrf/` module for improved maintainability and organization.

## Module Structure
```
src/hackrf/
├── index.ts                    # Barrel exports
├── HackRFOne.ts               # Core HackRF device class
├── HackRFOneAdapter.ts        # SDR interface adapter
├── constants.ts               # HackRF constants
├── DeviceInfo.ts              # Device information types
├── StreamOptions.ts           # Streaming configuration
├── util.ts                    # Utility functions
├── poll.ts                    # Polling utilities
├── hooks/
│   └── useHackRFDevice.ts     # React hook for device management
└── __tests__/
    └── HackRFOne.test.ts      # Unit tests
```

## Key Changes
1. **Moved files**: All HackRF-related classes, utilities, hooks, and tests
2. **Created barrel export**: `src/hackrf/index.ts` provides clean public API
3. **Updated imports**: All consuming code now imports from new locations
4. **Maintained compatibility**: Re-exports in `src/models/index.ts` and `src/hooks/index.ts`

## Import Pattern
- **Recommended**: Import from barrel export
  ```typescript
  import { HackRFOne, HackRFOneAdapter, useHackRFDevice } from '../hackrf';
  ```
- **Alternative**: Import from specific files for tree-shaking
  ```typescript
  import { HackRFOne } from '../hackrf/HackRFOne';
  ```

## Benefits
- **Isolation**: HackRF logic decoupled from generic SDR abstractions
- **Maintainability**: Easier to locate and modify HackRF-specific code
- **Clarity**: Clear module boundaries reduce cognitive load
- **Future-proof**: Easier to add new SDR drivers without polluting models directory

## Related Files
- **Core interface**: `src/models/SDRDevice.ts` (not moved - shared by all SDR types)
- **Other SDR implementations**: `src/models/RTLSDRDevice.ts`, `src/models/RTLSDRDeviceAdapter.ts`

## Testing
- All 1076 tests pass
- Type checking passes
- Linting passes
- Build succeeds

## Notes for Future Development
- When adding new HackRF features, place them in `src/hackrf/`
- When creating drivers for other SDR hardware, follow this pattern (e.g., `src/rtlsdr/`)
- Keep `src/models/SDRDevice.ts` as the shared interface for all SDR types
