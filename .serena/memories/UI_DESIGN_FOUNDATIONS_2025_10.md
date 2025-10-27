Purpose: Anchor the world‑class UI direction and where to find the spec/tokens.

Summary

- Spec: docs/UI-DESIGN-SPEC.md (personas, IA, panes, a11y, perf, keyboard, phased rollout). Aligned with PRD + ADRs 0003/0015/0016/0017/0012.
- Tokens: src/styles/tokens.css (OKLCH dark by default; light scaffold). Groups: color, typography, spacing, radius, elevation, z-index, motion, focus. Imported via src/styles/main.css so variables are app‑wide.

Invariants

- Progressive rendering: WebGPU → WebGL → OffscreenCanvas+Worker → 2D; surface active tier in StatusBar; visuals never block.
- WCAG 2.1 AA: keyboard-first, canvas role=img with rich aria-labels, live regions, reduced motion.
- Viridis default colormap; offer Plasma/Inferno/Magma + grayscale; avoid color‑only meaning.
- Numeric readouts use JetBrains Mono tabular figures; Inter for UI labels.

Adoption (low risk)

1. Phase A: StatusBar (GPU tier/FPS/buffer/storage) + token plumbing. Map focus ring/borders to tokens gradually.
2. Phase B: Resizable Spectrum/Waterfall panes with persisted layout; keep names to preserve tests.
3. Phase C+: Measurements, Scanner UI, Calibration wizard.

Notes

- Keep jest‑axe + visualization tests green; preserve ADR compliance.
- As of 2025‑10‑27: :root sets color-scheme: dark light; global accent-color uses --rad-accent. Prefer tokens over hard‑coded colors for new UI.
