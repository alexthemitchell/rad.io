Purpose: Ensure E2E accessibility tests that assert visualization canvas ARIA attributes reliably exercise canvases.

Key points

- Visualization canvases (Spectrogram, WaveformVisualizer, IQConstellation) render only when data is flowing; on the home/Monitor page without streaming, there is no <canvas> (EmptyState is shown).
- For Playwright E2E tests that need to validate canvas ARIA (role="img", aria-label), enable the mock SDR and start streaming before querying for canvases.

How to enable

- Navigate to /monitor?mockSdr=1 (or set localStorage radio:e2e:mockSdr = "1").
- Click the button with accessible name "Start reception".
- Wait for at least one <canvas> to appear, then assert ARIA attributes.

Code references

- Flag detection: src/utils/e2e.ts (shouldUseMockSDR)
- DeviceContext mock insertion: src/contexts/DeviceContext.tsx
- Visualizations (canvases use role+aria-label):
  - src/visualization/components/Spectrogram.tsx
  - src/visualization/components/WaveformVisualizer.tsx
  - src/visualization/components/IQConstellation.tsx
- E2E accessibility spec: e2e/accessibility.spec.ts (updated to use mockSdr and start streaming before checking canvases)

Notes

- Webpack dev overlay may intercept clicks in local dev; CI runs should not show overlay. If needed locally, close the overlay before clicking Start.
- Keep labels concise and descriptive; accessibleDescription is computed via useMemo in each component.
