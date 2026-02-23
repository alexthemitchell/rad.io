# Cross-Origin Isolation Deployment Plan

This plan defines how to run rad.io with and without cross-origin isolation.

## Source Alignment

- `docs/roadmap/00_PRODUCT_DEFINITION/00_06_RISK_REGISTER_VALIDATION_SPIKES/P0-06-05_cross-origin-isolation-deployment-plan.md`
- `docs/decisions/0002-sharedarraybuffer-strategy.md`
- `docs/reference/contracts/degraded-mode-v1.md`

## Required Headers

Use these headers on HTML and script/module responses for isolated mode:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Development Setup

Add headers in Vite dev server configuration when validating isolated mode.

Example (`vite.config.ts`):

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

Verification in browser console:

```js
window.crossOriginIsolated
```

Expected: `true` when headers and subresource policy are correct.

## Production Setup (Reverse Proxy)

Apply headers at the edge/proxy layer.

### Nginx example

```nginx
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

### Apache example

```apache
Header always set Cross-Origin-Opener-Policy "same-origin"
Header always set Cross-Origin-Embedder-Policy "require-corp"
```

### CDN/Platform guidance

- Ensure headers are set on HTML and JS bundles.
- Audit third-party assets for COEP compatibility (`CORP` or CORS-enabled responses).
- Prefer first-party hosting for critical JS/WASM assets.

## Runtime Mode Contract

| Capability | Isolation Required | Isolated Mode Behavior | Non-Isolated Fallback | Validation Test |
| --- | --- | --- | --- | --- |
| SAB ring buffer transport | Yes | Use SAB-backed hot path | Use transferable `ArrayBuffer` path | Force no-SAB and compare metrics |
| High-cadence FFT updates | No (but improved by isolation) | Target 40-60 Hz when stable | Clamp to 20-30 Hz in degraded mode | Verify FPS and cadence counters |
| Audio stability under load | No (but improved by isolation) | Lower jitter budget | Increase queue-ahead to 80-140 ms | Induced underrun recovery test |
| Advanced perf headroom presets | Yes for full target | Enable high-rate presets | Hide/disable high-rate presets | UI preset availability in both modes |
| Diagnostics transport mode flag | No | Report `sab` | Report `transferable` | Export diagnostics and inspect mode |

## Fallback Mode Tests

Run both modes in CI/nightly and local validation.

### Test A: Isolated mode

- Enable COOP/COEP headers.
- Verify `window.crossOriginIsolated === true`.
- Run baseline performance scenario.

### Test B: Non-isolated mode

- Disable COOP/COEP headers or set override:
  - `window.__RADIO_FORCE_NO_SAB = true`
- Verify `window.crossOriginIsolated === false` or forced fallback active.
- Re-run scenario and ensure no hard failure.

### Required assertions

- App remains functional in both modes.
- Metrics are within documented budgets or explicitly marked `partial`/`unknown`.
- Degraded mode contract applies when thresholds are exceeded.

## Release Gate Recommendations

- Commit gate:
  - Unit/integration checks in default mode
- Nightly gate:
  - Isolated and non-isolated end-to-end scenarios with regression thresholds
- Pre-release gate:
  - Tier 1 hardware smoke with explicit transport mode evidence

## Common Failure Cases

- `crossOriginIsolated` remains false due to missing headers on HTML shell.
- Third-party script blocked by COEP constraints.
- Header present in dev but missing in production edge configuration.
