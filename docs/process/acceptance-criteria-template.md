# Acceptance Criteria Template

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-01_issue-templates-acceptance-criteria-template.md`

Use this template for all implementation issues.

## Required Format

Each criterion must include:

- Scenario.
- Observable result.
- Verification method (`unit`, `e2e`, or `manual`).
- Evidence artifact (test name, command output, screenshot, log, or doc link).

## Template

```markdown
### Acceptance Criteria

- [ ] Scenario: <starting condition or action>
  Result: <measurable outcome>
  Verify: <unit|e2e|manual>
  Evidence: <what reviewer will see>

- [ ] Scenario: <starting condition or action>
  Result: <measurable outcome>
  Verify: <unit|e2e|manual>
  Evidence: <what reviewer will see>

- [ ] Scenario: <starting condition or action>
  Result: <measurable outcome>
  Verify: <unit|e2e|manual>
  Evidence: <what reviewer will see>
```

## Threshold Guidance

When applicable, include explicit thresholds for:

- Frame/update rate.
- Latency.
- Drop or error rate.
- Resource budget (CPU/memory).

Example threshold wording:

- `Result: Waterfall updates at >= 20 FPS on deterministic source in Chromium.`
- `Result: No uncaught errors during 5-minute deterministic playback run.`

## Verification Guidance

Reference repository scripts where possible:

- `npm run validate`
- `npm test`
- `npm run test:e2e`
- `npm run build:prod`

For manual verification, include:

- Browser and OS.
- Fixture/source used.
- Expected visual/audio behavior.

## Contract And Privacy Hooks

Add extra criteria when needed:

- Contract/schema changes: migration or compatibility statement required.
- Telemetry/diagnostics changes: privacy review checklist completion required.

## Definition Of Done Link

See `docs/process/definition-of-done.md` for close-out requirements.
