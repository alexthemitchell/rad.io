Purpose: Ensure UI components render in unit tests without requiring global providers by gracefully handling missing context.

Policy

- Components consuming React context (e.g., DeviceContext) should render in a degraded, read‑only state when the provider is absent, rather than throwing.
- This improves testability and decouples unit tests from app‑level providers while preserving normal runtime behavior under providers.

Implementation pattern

- Wrap context access in a small try/catch to tolerate missing providers:

  - Example: `src/components/StatusBar.tsx`
    - Try to read with `const ctx = useDeviceContext()` inside a try/catch.
    - If it throws (no provider), fall back to safe defaults:
      - `primaryDevice = undefined`
      - `isCheckingPaired = false`
      - `connectPairedUSBDevice = async () => { await Promise.resolve(); }`
    - Render remains functional for displayed metrics; device selection UI gracefully degrades to a static label.

- Keep the hook call count stable (always call once) to satisfy React Rules of Hooks. The try/catch handles the provider absence.
- Avoid side effects when provider is missing; no WebUSB enumeration is attempted.

When to use

- UI components that are imported directly in tests without app shells, e.g., `StatusBar` in `src/components/__tests__/StatusBar.test.tsx`.
- Non‑leaf components can use the same pattern when the cost of creating a test‑only provider would be high.

Examples

- StatusBar: `src/components/StatusBar.tsx` – safely renders without `DeviceProvider` present.

Notes

- Prefer provider mocks for integration tests. This policy targets unit tests that validate rendering and deterministic formatting.
- Do not use this pattern to mask real runtime errors. In app screens, providers are required and should be present.
