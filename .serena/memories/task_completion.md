# Task Completion

- Start with the narrowest executable check that covers the changed behavior.
- TypeScript/React slice: focused Vitest file, then `npm run type-check` and `npm run lint`.
- Rust DSP slice: focused `cargo test -p <crate> <filter>`, then `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, and `npm run rust:test` when shared behavior changed.
- WASM exports, worker protocol, generated glue, or cross-language contracts: run `npm run build` plus affected Vitest/browser specs.
- Rendering, worker scheduling, RDS snapshots, or source lifecycle: run the focused Playwright spec; run `npm run test:e2e` for shared browser behavior.
- Live RF, HackRF, detection/tracking, demodulation, spectrum, or RDS claims require the `sdr-hardware-verification` skill and evidence appropriate to the claim; synthetic green tests alone are insufficient for hardware correctness.
- Before merge/release or broad cross-module changes, run `npm run validate`; it covers Rust tests, lint, unit tests, release WASM/frontend build, and Playwright.
- CLI checks are authoritative if VS Code/tsserver diagnostics appear stale.
- Do not commit generated `target/`, `dist/`, Playwright artifacts, or `crates/dsp-wasm/pkg/` output.