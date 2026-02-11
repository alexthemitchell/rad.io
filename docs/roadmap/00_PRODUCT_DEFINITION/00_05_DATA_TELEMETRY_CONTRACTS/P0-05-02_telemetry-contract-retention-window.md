# Telemetry Contract + Retention Window

**ID:** P0-05-02  
**Roadmap:** Phase 0 / 0.5 Data/Telemetry Contracts (Before Implementation)  
**Roadmap Description:** define counters/events required for budgets (drops, underruns, latency, USB stalls).

## Summary

Define the canonical telemetry contract (events, counters, histograms) required to enforce budgets and support diagnostics, plus a retention/storage policy that is privacy-aware and cheap enough to keep enabled.

This is not about building a telemetry backend; it’s about establishing local observability contracts so later implementation can be verified and supportable.

## Deliverables

- Telemetry contract spec: `docs/reference/contracts/telemetry-schema-v1.md`.
- Retention policy document: `docs/reference/contracts/telemetry-retention-v1.md`.
- A mapping table from “budget gates” to telemetry signals (what you measure to prove each budget is met).

## Acceptance Criteria

- [ ] Telemetry contract exists at `docs/reference/contracts/telemetry-schema-v1.md` with versioning (`schemaVersion`).
- [ ] Contract enumerates budget-related signals with definitions and units, including at least:
  - [ ] USB/WebUSB throughput (bytes/s) and stalls
  - [ ] Buffer underruns/overruns/drops (counts + rates)
  - [ ] Worker message latency (p50/p95/p99)
  - [ ] Audio pipeline underruns and mute ramps (counts)
  - [ ] Render loop budget (frame time, dropped frames)
  - [ ] DSP pipeline timing (per-stage timings if available)
- [ ] Retention doc exists at `docs/reference/contracts/telemetry-retention-v1.md` and specifies:
  - [ ] In-memory retention window per signal type
  - [ ] Whether anything persists to disk (and if so, where and how long)
  - [ ] Redaction/anonymization principles (no PII; stable device IDs treated carefully)
- [ ] Includes a “disabled/degraded telemetry” mode (what happens if telemetry is off or storage quota is hit).

## Agent Prompt

Draft the telemetry contract and retention policy.

Output files:

- `docs/reference/contracts/telemetry-schema-v1.md`
- `docs/reference/contracts/telemetry-retention-v1.md`

Steps:

1. Review roadmap “budgets” and diagnostics goals; identify the minimum telemetry needed to enforce them.
2. Define signal types:
   - Counters (monotonic), Gauges, Events, Histograms
3. For each signal, specify:
   - Name, type, units, sampling cadence, aggregation rules
4. Define retention:
   - Short window for high-rate signals (seconds/minutes)
   - Longer window for low-rate health counters (minutes/hours)
   - Persistence policy (default: none unless explicitly needed)

Validation checklist:

- [ ] Each budget has at least one measurable signal.
- [ ] Retention is explicit and realistic for browser storage.
- [ ] Privacy constraints are explicit.
- [ ] Markdownlint-friendly formatting.
