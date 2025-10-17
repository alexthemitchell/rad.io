Purpose: Single-stop index to high-signal memories for rad.io. Read this first, then jump directly to what you need.

Core how-to (start here)
- REPO_WORKFLOW_QUICKSTART — Day-to-day commands, order of operations, pitfalls.
- CI_QUALITY_GATES_SUMMARY — What CI expects + local reproduction order.

Testing at scale
- JEST_MEMORY_PLAYBOOK — Memory-safe Jest patterns (chunking, GC, unmounting, canvas mocks).

Architecture & invariants
- KEY_PATHS_AND_INVARIANTS — Critical files/symbols, device/DSP/visualization invariants.
- ARCHITECTURE / ARCHITECTURE_DIAGRAM — Broader system view.

Devices & WebUSB
- WEBUSB_SDR_INTEGRATION_PLAYBOOK — Canonical device config/order, sample formats, robust streaming.
- HACKRF_DEVICE_INITIALIZATION_BUG_FIX — Root cause + fix for "Receiving but no data" (set sample rate first).
- WEBUSB_STREAMING_DEBUG_GUIDE — Deep-dive troubleshooting and streaming loop patterns.

DSP & performance
- WASM_DSP — WASM FFT integration, fallback strategy, benchmarks.

Accessibility & UI
- ACCESSIBILITY / ACCESSIBILITY_SUMMARY — Key accessibility considerations.

Meta best practices
- SERENA_MEMORY_BEST_PRACTICES — How to keep memories high-signal.
- SERENA_MEMORY_CONSOLIDATED_BEST_PRACTICES — Consolidated hygiene guidance.

Notes
- Prefer the items above over older, overlapping memories. See MEMORY_DEPRECATIONS for mappings.
- Keep additions short (150–400 words) and link to source paths instead of inlining code.
