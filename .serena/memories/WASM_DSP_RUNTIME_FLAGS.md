# WASM DSP runtime flags (feature + validation)

Purpose: Document the runtime toggles controlling WASM enablement and FFT output validation to balance correctness and performance.

Key flags (localStorage):

- radio.wasm.enabled
  - Type: string
  - Effect: When set to 'false', forces JS fallback even if WASM is loaded
  - Default: Enabled (true) in all environments if unset
  - Implementation: src/utils/dspWasm.ts → isWasmAvailable()

- radio.wasm.validate
  - Type: string
  - Effect: Enables O(N) sanity checks on WASM FFT outputs (detects all-zeros/constant or non‑finite results); if invalid, logs a warning and uses JS fallback for that operation
  - Defaults: Dev/test → true, Prod → false (overridable)
  - Implementation: src/utils/dspWasm.ts → isWasmValidationEnabled(); used in src/utils/dsp.ts to gate validation and fallback

Operational notes:

- Logging: All messages route through dspLogger (src/utils/logger.ts). In production, DEBUG is suppressed.
- Loader hostname: WASM module URL logic uses window.location.hostname for localhost detection during development (see src/utils/dspWasm.ts load path).
- API preference: If available, use return-by-value calculateFFTOut to avoid the AssemblyScript output-parameter copy-back issue (see src/utils/dspWasm.ts and memory: WASM_OUTPUT_ARRAY_BUG).

Validation heuristics (high level):

- Checks for non-finite values, constant arrays, and near-zero spectra before trusting WASM output. This is intentionally simple and O(N) to keep overhead acceptable when enabled.

When to flip flags:

- Investigating degenerate spectra in development → set radio.wasm.validate='true'
- Performance-sensitive production scenarios unaffected by WASM regressions → rely on default (validation off) or explicitly set radio.wasm.validate='false'
- Temporarily disable WASM for a session → set radio.wasm.enabled='false'
