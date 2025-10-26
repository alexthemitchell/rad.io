Purpose: Prevent common TS + React test pitfalls under strict settings and make timer-driven UI tests deterministic.

Key patterns

- Safe tuple/array indexing (noUncheckedIndexedAccess):
  - Prefer const tuples and nullish fallback instead of non-null assertions.
  - Example path: `src/pages/Decode.tsx`
    - `const statuses = ["searching", "locked", "lost"] as const;`
    - `const idx = Math.floor(Math.random() * statuses.length);`
    - `const randomStatus = statuses[idx] ?? "searching";`
  - Why: Avoids `Forbidden non-null assertion` while keeping types narrow and code safe.

- Deterministic interval tests in React:
  - Use `jest.useFakeTimers()` + `jest.advanceTimersByTime(ms)` to trigger effects.
  - After advancing, wait for state to commit to the DOM with `await waitFor(...)`.
  - If randomness influences output, stub it with `jest.spyOn(Math, 'random').mockReturnValue(x)`.
  - Example path: `src/pages/__tests__/Decode.test.tsx`
    - Advance 2000ms; assert Sync Status text updates; mock `Math.random` to select a specific status.

- Why this matters:
  - Prevents flaky tests and type errors in strict TS projects.
  - Improves Codecov patch coverage by targeting changed lines driven by timers/randomness.

Related

- Testing infra: `jest.setup.ts` (canvas/webgpu mocks, jest-axe integration)
- Coverage policy: `codecov.yml` (component-level patch thresholds for `ui_pages`)
