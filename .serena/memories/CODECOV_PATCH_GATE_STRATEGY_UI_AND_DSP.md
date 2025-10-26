Purpose: Practical playbook for meeting Codecov patch gates with minimal edits, focusing on UI pages and DSP utilities.

Codecov policy (see `codecov.yml`)

- Global patch target: 80% (threshold 5%).
- Component patch targets:
  - ui_pages: 70% patch.
  - dsp_utils: 80% patch.

Strategy

- Prefer targeted tests that exercise exactly the lines changed:
  - UI Pages: add deterministic tests for stateful UI (timers, feature flags, validation branches). Use fake timers + waitFor; stub randomness.
  - DSP Utilities: test validation toggles, fallback branches (e.g., WASM degenerate detection), and one-time warning resets.
- Avoid production changes for coverage; emulate environment in tests (e.g., OfflineAudioContext stubs for FFT). Link tests next to code.
- Keep tests fast and isolated; limit integration scope unless necessary.

Examples

- UI page timer update: `src/pages/__tests__/Decode.test.tsx` covers interval-driven status changes.
- DSP: `src/utils/__tests__/dsp.calculateFFTSync.fallback.test.ts`, `dsp.calculateSpectrogram.*.test.ts`, and `dsp.resetWarningFlag.test.ts` cover fallback and warning pathways.

Operational tips

- After edits: run unit tests + coverage for changed files; verify component thresholds in Codecov PR UI.
- If a component is borderline, add a focused test to the exact untested branches; prefer exercising behavior, not implementation details.
