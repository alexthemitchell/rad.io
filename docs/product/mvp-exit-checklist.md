# rad.io MVP Exit Checklist

## How To Use This Checklist

This checklist is a ship gate for MVP preview readiness.

- Mark an item complete only when the listed evidence is attached.
- Evidence must be one of: automated test output, manual test record, telemetry snapshot, or build/log artifact.
- A failed critical item blocks release.

## Journeys

- [ ] J1 First signal in <= 60s from app load using Mock source (evidence: manual test run record).
- [ ] J1 Spectrum and waterfall both render after source start (evidence: screenshot + manual run record).
- [ ] J1 Tune action changes center frequency and visual peak position (evidence: manual run record).
- [ ] J2 WFM audio is audible and stable for >= 2 minutes (evidence: manual run record + underrun counter).
- [ ] J3 AM mode demodulates an AM-like fixture without runtime errors (evidence: unit test and manual run record).

## Reliability

- [ ] Worker recovers from an injected processing error without page reload (evidence: manual run record).
- [ ] Device disconnect is surfaced in UI with actionable recovery state (evidence: manual run record).
- [ ] Reconnect path restores prior tune/mode settings (evidence: manual run record).
- [ ] Session runs 10 minutes with no uncaught exception in console (evidence: browser console export).
- [ ] `npm run validate` passes on release candidate commit (evidence: command output or CI link).

## Accessibility

- [ ] Core controls are keyboard reachable in tab order (Connect, start/stop, mode, mute) (evidence: manual accessibility run record).
- [ ] Visible focus indicator is present on all interactive controls (evidence: screenshot set).
- [ ] Status changes are exposed in text and not color-only (evidence: UI review record).
- [ ] Contrast for primary controls and text meets WCAG AA (evidence: contrast report).

## Performance

- [ ] Time-to-first-spectrum <= 2.0s on Tier 1 desktop profile (evidence: timed run log).
- [ ] Time-to-first-waterfall <= 2.5s on Tier 1 desktop profile (evidence: timed run log).
- [ ] Tune apply latency p95 <= 120ms in Mock source scenario (evidence: telemetry snapshot).
- [ ] Waterfall/spectrum update cadence is >= 50 FPS median in Mock source scenario (evidence: telemetry snapshot).
- [ ] Audio underrun rate <= 0.1 events/sec during 5 minute run (evidence: telemetry snapshot).

## Recovery

- [ ] Audio context blocked state shows explicit user action to enable audio (evidence: manual run record).
- [ ] Recovery from suspended audio context succeeds without page reload (evidence: manual run record).
- [ ] Degraded behavior is observable when load is high (clear user signal + reduced visual load) (evidence: manual run record).
- [ ] App remains operable after one forced worker restart (evidence: manual run record).

## Known Limitations

Known limitations are acceptable only if all conditions are true:

- Limitation is documented with user impact and workaround.
- Limitation does not violate safety, privacy, or data integrity expectations.
- Limitation does not break any must-pass journey outcome.
- Limitation has a linked follow-up issue with measurable acceptance criteria.
