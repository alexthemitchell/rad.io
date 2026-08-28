# Suggested Commands

Run from repository root in Windows PowerShell 5.1.

## Bootstrap

- `rustup target add wasm32-unknown-unknown`
- `cargo install wasm-pack --locked`
- `npm install`
- `npx playwright install chromium`

## Development And Focused Checks

- `npm run dev` - rebuild development WASM, then start Vite.
- `npm run wasm:dev` / `npm run wasm:release` - rebuild generated bindings.
- `npx vitest run <test-file>` - focused TS/React test; Vitest does not accept `--runInBand`.
- `cargo test -p dsp-core <test-filter>` - focused native DSP test.
- `npx playwright test <spec-or-grep>` - focused browser test.
- `npm run type-check`, `npm run lint`, `npm test`, `npm run rust:test`, `npm run build`, `npm run test:e2e` - project checks.
- `npm run validate` - complete repository validation.
- `cargo fmt --check`
- `cargo clippy --workspace --all-targets -- -D warnings`

## Serena

Serena is launched through uvx, not installed globally:

- `uvx --from git+https://github.com/oraios/serena serena project health-check .`
- `uvx --from git+https://github.com/oraios/serena serena project index .`
- `uvx --from git+https://github.com/oraios/serena serena memories check .`

PowerShell 5.1 has no `&&`; use `;` and inspect `$LASTEXITCODE` when command chaining is necessary.