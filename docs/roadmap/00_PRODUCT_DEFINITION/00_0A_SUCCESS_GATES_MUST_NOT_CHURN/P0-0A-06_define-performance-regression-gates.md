# Performance Regression Gates

## Automated Checks (CI/CD)
These run on every PR via headless browser (Puppeteer/Playwright).

1.  **Bundle Size:**
    *   Main entry point < 500KB (gzipped).
    *   DSP Worker < 1MB (WASM + JS glue).
2.  **DSP Latency Benchmark:**
    *   Process 1s of IQ @ 2.4MSPS in < 500ms (2x realtime factor) on CI runner.
3.  **Memory Leak Check:**
    *   Load app -> Connect Mock -> Run 30s -> Disconnect.
    *   Heap growth < 5% vs baseline.

## Manual Release Gates
Run these before tagging a release (Phase 1).

1.  **The "Spin Test":**
    *   Tune rapidly (mouse drag) for 10 seconds.
    *   **Fail if:** Audio glitches occur or UI freezes > 200ms.
2.  **The "Background Test":**
    *   Tab in background playing audio for 5 minutes.
    *   **Fail if:** Audio stutters or stops (worker throttling).
3.  **The "Heat Test":**
    *   Run on laptop on battery for 10 mins.
    *   **Fail if:** "High Power Usage" warning from OS/Browser.
