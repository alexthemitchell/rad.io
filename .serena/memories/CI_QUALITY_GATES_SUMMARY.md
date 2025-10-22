Purpose: Concise map of CI expectations and local reproduction for rad.io, plus hard‑won tips from recent fixes.

CI checks (GitHub Actions)

1) Lint (ESLint) → no errors
2) Format (Prettier) → clean
3) TypeScript type-check → no errors
4) Unit tests (Jest) → all pass deterministically
5) Build (webpack) → bundles + WASM copied to dist

Local reproduction order (fast loop)

- npm run test -- <path> (targeted) → npm test (full)
- npm run type-check (VS Code task available)
- npm run lint (or npm run lint:fix)
- npm run format:check → if needed npm run format
- npm run build

Recent lessons (keep in mind)

- Missing deps can masquerade as test failures: Navigation tests failed due to missing `react-router-dom`. Fix: `npm i react-router-dom@^7`. File refs: `src/components/Navigation.tsx`, `src/App.tsx`.
- Strict typing with React Router v7: annotate `NavLink` className cb param `{ isActive: boolean }` to satisfy noImplicitAny.
- Visibility gating in tests: if visualizers don’t render in JSDOM, check hooks. We patched `src/hooks/useIntersectionObserver.ts` to default visible when `IntersectionObserver` is unavailable (SSR/tests). See memory: VISIBILITY_HOOKS_TEST_ENV_FIX.
- Formatting gate blocks merges frequently; run `npm run format` to fix markdown/yaml drift before PR.
- Prefer VS Code tasks for Type check/Build to match CI.

Acceptance criteria

- All 5 gates PASS locally before PR.
- No new `any` types; explicit exports maintained.
- Tests leave no lingering resources (web workers/GL cleaned up).