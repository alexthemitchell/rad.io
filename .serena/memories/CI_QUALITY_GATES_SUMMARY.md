Purpose: Concise map of CI expectations and local reproduction steps for rad.io.

CI checks (GitHub Actions)

1. Lint Code → ESLint must pass.
2. Run Tests → Jest suites must pass (avoid memory bloat).
3. Check Formatting → Prettier formatting must be correct.
4. Build Application → Webpack build must succeed.
5. TypeScript Type Check → No TS errors.

Local reproduction order

1. `npm run format:check` (or `npm run format` to fix)
2. `npm run lint` (or `npm run lint:fix`)
3. `npm run type-check`
4. `npm test -- path/to/test` (target only what changed)
5. `npm run build`

Triage tips

- Type errors first (unblock everything else).
- Lint errors next (quick fixes).
- Run only impacted tests to iterate faster; use memory playbook for heavy tests.
- If build fails, inspect webpack asset paths (e.g., WASM files present in dist).

Acceptance

- All five gates PASS locally before PR.
- No “any” types introduced; explicit exports.
- Tests are deterministic and clean up after themselves (unmount, clear pools).
