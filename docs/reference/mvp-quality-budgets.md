# MVP Quality Budgets

This document defines measurable MVP quality budgets and how to evaluate them.

## Budgets

| Budget | Threshold | Measure Method | Priority |
| --- | ---: | --- | --- |
| Time to first spectrum | <= 2.0s | App start to first non-empty spectrum frame | Must |
| Time to first waterfall | <= 2.5s | App start to first waterfall row render | Must |
| Time to audio | <= 3.0s after audio enable action | User audio-enable action to first audible output | Must |
| Tune apply latency (p95) | <= 120ms | Tune request timestamp to applied pipeline state timestamp | Must |
| Reconnect time | <= 5.0s | Disconnect detected to stream restored | Must |
| Audio underrun rate | <= 0.1 events/sec over 5 min | Underrun counter delta divided by run duration | Must |
| Visual cadence | >= 50 FPS median | Render frame interval samples over 60s | Should |
| Crash-free session rate | >= 95% for 10 min sessions | Session runs without uncaught exception | Must |

## Measurement Notes

- Tier 1 baseline: Windows 11 + Chrome stable on mid-range laptop profile.
- Use Mock source for deterministic baseline.
- Repeat tests 3 times; use median for pass/fail decisions.
- If hardware is unavailable, mark hardware-dependent metrics as unknown and file follow-up work.

## Budget Interpretation

- Pass: threshold met in baseline conditions.
- Partial: near threshold but unstable across runs.
- Fail: threshold missed consistently.
- Unknown: not measurable in current environment; requires follow-up issue.
