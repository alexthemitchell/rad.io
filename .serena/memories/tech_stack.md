# Tech Stack

- Node.js 22+, npm with committed `package-lock.json`, ESM package.
- React 19.2, TypeScript ~6.0 in strict no-emit project references, Vite 8, ESLint 10 flat config, Vitest 4 with jsdom, Testing Library, Playwright 1.62.
- Browser APIs: dedicated Web Workers, transferable `ArrayBuffer`, Canvas2D, WebUSB. Live hardware requires desktop Chromium/Edge and a secure context; production requires HTTPS.
- Rust stable, edition 2024 workspace with `dsp-core` and `dsp-wasm`; toolchain includes rustfmt, clippy, and `wasm32-unknown-unknown`.
- DSP dependencies center on `rustfft`, complex-number/rand crates, serde, and `thiserror`; WASM boundary uses `wasm-bindgen` and `serde-wasm-bindgen`.
- `wasm-pack` emits browser bindings into ignored `crates/dsp-wasm/pkg/`. Release uses Cargo LTO/size optimization; wasm-pack's redundant `wasm-opt` pass is disabled in `crates/dsp-wasm/Cargo.toml`.
- Generated/ignored paths include `node_modules/`, `dist/`, `target/`, `crates/dsp-wasm/pkg/`, coverage, Playwright reports, and test results.