# WASM Output Array Bug & Fix

## Issue
AssemblyScript WASM functions with output parameters (Float32Array) were returning all zeros when called from JavaScript, despite receiving valid input data.

## Root Cause
The AssemblyScript glue code (release.js) uses `__lowerTypedArray` to copy JavaScript TypedArrays INTO WASM memory before function execution. However, it does NOT copy the modified arrays BACK to JavaScript after execution. The WASM function writes results to its own memory space, but those changes never reach the JavaScript arrays.

### Example Problem Code
```typescript
// JavaScript
const amplitude = new Float32Array(count);  // JS memory
const phase = new Float32Array(count);      // JS memory
wasmModule.calculateWaveform(iSamples, qSamples, amplitude, phase, count);
// amplitude and phase remain zeros - WASM wrote to different memory!
```

## Attempted Fixes (didn't work)
1. Using `allocateFloat32Array` to allocate arrays in WASM memory - still got copied/lowered when passed back to WASM functions
2. Modifying dspWasm.ts wrapper functions - the issue is in AssemblyScript's generated glue code

## Current Solution
Temporarily disabled WASM for waveform calculation (and likely need to do same for FFT/spectrogram if they have similar issues). Using JavaScript implementation instead, which is still performant enough for real-time visualization.

### Files Modified
- `src/utils/dsp.ts`: Commented out WASM path in `calculateWaveform`, added explanation comment
- `src/utils/dspWasm.ts`: Updated to use `allocateFloat32Array` (preparation for proper fix)

## Proper Fix (future work)
Need to modify AssemblyScript WASM functions to RETURN arrays instead of taking them as output parameters:
```typescript
// assembly/dsp.ts - RETURN arrays instead
export function calculateWaveform(iSamples: Float32Array, qSamples: Float32Array, count: i32): WaveformResult {
  const amplitude = new Float32Array(count);
  const phase = new Float32Array(count);
  // ... calculations ...
  return { amplitude, phase };  // AssemblyScript can lift these automatically
}
```

Or use AssemblyScript's `@external` decorator and manual memory management.

## Verification
- Waveform now shows valid amplitude ranges (0.016 to 1.414) instead of all zeros
- IQ Constellation was unaffected (doesn't use WASM)
- Console logs confirmed JavaScript fallback produces correct results
- Visual rendering confirmed with Playwright browser screenshots

## Related Files
- `src/utils/dsp.ts` - DSP functions with WASM fallback
- `src/utils/dspWasm.ts` - WASM loader and wrappers  
- `build/release.js` - Generated AssemblyScript glue code
- `assembly/dsp.ts` - WASM source code (AssemblyScript)