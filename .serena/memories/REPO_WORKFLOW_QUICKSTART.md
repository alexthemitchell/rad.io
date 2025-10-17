Purpose: A fast, low-noise daily loop for agents working in rad.io. Use this to get productive quickly and avoid common pitfalls.

Core daily loop (order matters)

1. Install deps (clean): `npm ci`
2. Format code: `npm run format` (or `format:check` in CI)
3. Lint + autofix: `npm run lint:fix` (then `npm run lint` if needed)
4. Type-check: `npm run type-check`
5. Run focused tests only (avoid full suite unless necessary):
   - Component/DSP unit tests: `npm test -- src/components/__tests__/ComponentName.test.tsx`
   - Use one worker for heavy data tests: `NODE_OPTIONS=--expose-gc npm test -- --maxWorkers=1 path`
6. Build app (verifies bundling): `npm run build`

High-signal references

- Commands & workflow: `.github/workflows/copilot-setup-steps.md`, `package.json`
- App entry: `src/index.tsx` → `src/App.tsx` → `src/pages/Visualizer.tsx`
- Device lifecycle hooks: `src/hooks/useUSBDevice.ts`, `src/hooks/useHackRFDevice.ts`
- DSP & WASM: `src/utils/dsp.ts`, `src/utils/dspWasm.ts`, `assembly/dsp.ts`

Pitfalls & tips

- Tests: Prefer targeted runs; large data sets can OOM. See `JEST_MEMORY_PLAYBOOK` memory.
- WebUSB requires HTTPS and user interaction. See `WEBUSB_SDR_INTEGRATION_PLAYBOOK`.
- Maintain strict TypeScript types (no any). Fix type errors before running full tests.
- Canvas-heavy components should be unmounted in tests to prevent leaks.

Success criteria

- All commands above PASS locally.
- No type errors, no lint errors, and targeted tests green.
- Build succeeds without warnings that indicate missing assets (e.g., WASM).
