# RF Artifacts And Mitigations

## Quick Explanations

- DC spur: a center spike usually caused by receiver chain characteristics.
- Image: a mirrored-looking signal that may not represent a real emitter.
- Aliasing: false-looking spectral content when settings exceed safe constraints.

## What To Try Next: Sequence 1 (Center Spike)

1. Shift center frequency slightly.
2. Keep tuned frequency on your target signal.
3. If signal readability improves, keep shifted center as temporary mitigation.

## What To Try Next: Sequence 2 (Noisy Edge Signals)

1. Reduce span or increase zoom to inspect target region.
2. Lower sample-rate/load pressure if rendering is unstable.
3. Narrow bandwidth around the target.

## Disclaimer

Artifact hints are heuristic. They guide safe next steps but are not definitive RF source classification.
