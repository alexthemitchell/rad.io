# Artifact Awareness Contract

## Artifact Classes

| Artifact | Symptoms | Warn When | What Not To Claim |
| --- | --- | --- | --- |
| DC spur | Persistent peak at visual center regardless of retune | Center-bin energy remains dominant across tune changes | Do not claim external transmitter certainty |
| Images | Mirror-like peaks around strong signal references | Symmetric peaks move in opposite direction relative to tune changes | Do not claim exact front-end cause without deeper diagnostics |
| Aliasing risk | Unexpected spectral content near span edges, unstable with rate/span changes | Edge density spikes or clipping-like behavior after aggressive settings | Do not claim true RF occupancy without confirming constraints |

## Warning Display Rules

- Debounce warning display for at least 300 ms.
- Suppress duplicate warnings while same condition persists.
- Always include one immediate action and one learn-more action.

## Permitted Mitigations And UX Constraints

| Mitigation | UX Constraint | Reversibility |
| --- | --- | --- |
| Small center-frequency shift | Show expected impact before apply | One-click undo |
| Bandwidth clamp suggestion | Explain narrower passband tradeoff | User can restore prior bandwidth |
| Sample-rate/load suggestion | Explain performance versus visibility tradeoff | User can return to previous rate |

## Safety Rules

- Disruptive changes (rate resets) require explicit user action.
- Mitigations must not silently alter source type or mode.
- Undo path must be visible in same interaction context.

## Telemetry Hooks

- `artifact_warning_shown`
- `artifact_warning_dismissed`
- `artifact_mitigation_selected`
- `artifact_mitigation_undone`

## Accessibility Requirements

- Warnings announced via live region.
- Dismiss, apply, and learn-more actions keyboard reachable.
- Warning text includes plain-language action guidance.
