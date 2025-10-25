Purpose: Anchor the world-class UI direction for WebSDR Pro and where to find the authoritative spec and tokens.

Summary

- Spec document: docs/UI-DESIGN-SPEC.md (personas, IA, panes, interactions, accessibility, performance, keyboard map, phased rollout). Aligns with PRD (precision/power/professional) and ADRs 0003/0015/0016/0017/0012.
- Design tokens: src/styles/tokens.css (OKLCH-based dark theme by default; light theme scaffold). Token groups: color, typography stacks, spacing, radius, elevation, z-index. Non-invasive: not imported by current CSS yet.

Key invariants

- Visualization rendering remains progressive: WebGPU → WebGL → OffscreenCanvas+Worker → 2D; surface active tier in a StatusBar and never block visuals.
- Accessibility is first-class (WCAG 2.1 AA): keyboard-first, canvas role=img with rich aria-labels, live regions for device/scan/measurement events, reduced motion support.
- Viridis is default waterfall colormap (ADR-0016). Provide Plasma/Inferno/Magma and grayscale options; do not rely on color alone to convey meaning.
- Numeric readouts use a monospace with tabular figures (JetBrains Mono) to prevent layout shift; Inter for UI labels.

Adoption plan (low-risk)

1. Phase A: Introduce StatusBar (GPU tier/FPS/buffer/storage). Map existing focus rings/borders to tokens (ring/border fg); don’t change existing main.css colors yet.
2. Phase B: Resizable panes for Spectrum/Waterfall with persisted layout; keep component names to preserve tests.
3. Phase C+: Measurement tools, Scanner UI, Calibration wizard per spec.

Notes

- Keep tests (jest-axe + visualization suite) green at all steps; do not regress ADR compliance.
- If switching to tokens, refactor CSS gradually: prefer variable usage over hard-coded colors; guard dark theme by adding .theme-dark class at root later.
