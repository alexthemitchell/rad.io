# Diagnostics Bundle Format (Versioned)

**ID:** P0-05-03  
**Roadmap:** Phase 0 / 0.5 Data/Telemetry Contracts (Before Implementation)  
**Roadmap Description:** structure, redaction/anonymization rules, and replay/debug expectations.

## Summary

Define a versioned diagnostics bundle format that can be exported by users and attached to bug reports, with explicit redaction rules and a clear “replay vs inspect” promise.

This bundle should help answer: what device/source was used, what the session configuration was, what telemetry/errors occurred, and enough context to reproduce or at least triage.

## Deliverables

- Diagnostics bundle spec: `docs/reference/contracts/diagnostics-bundle-v1.md`.
- Redaction/anonymization rules included in the spec (what must never be included; what is optional).
- A sample bundle skeleton (directory layout + example JSON headers) embedded in the doc.

## Acceptance Criteria

- [ ] Spec exists at `docs/reference/contracts/diagnostics-bundle-v1.md` and includes a `bundleVersion`.
- [ ] Bundle structure is explicit and implementable, including:
  - [ ] Top-level manifest (bundle metadata, creation time, app version, browser version)
  - [ ] Session state snapshot (links to Session State contract)
  - [ ] Telemetry snapshot (links to Telemetry contract)
  - [ ] Error log (links to error taxonomy ADR)
  - [ ] Optional artifacts (screenshots, exported settings, small captured sample snippets if allowed)
- [ ] Redaction rules are explicit:
  - [ ] No PII
  - [ ] Device identifiers treated as sensitive (hashed or omitted by default)
  - [ ] User-provided labels/memos treated as sensitive
- [ ] “Replay expectations” section clearly states what is and isn’t guaranteed (e.g., deterministic replay requires fixtures; diagnostics is primarily for triage).

## Agent Prompt

Draft the diagnostics bundle specification.

Output file:

- `docs/reference/contracts/diagnostics-bundle-v1.md`

Steps:

1. Search for existing diagnostics/telemetry/error concepts in the repo.
2. Define the bundle goals:
   - Triage-first (default)
   - Optional replay (future)
3. Specify:
   - Packaging format (e.g., zip) and file naming conventions
   - Manifest fields and versioning
   - Required vs optional files
4. Write explicit redaction rules and defaults.

Validation checklist:

- [ ] Bundle is implementable with browser APIs.
- [ ] Has clear privacy posture.
- [ ] Links to Session State and Telemetry contracts.
- [ ] Markdownlint-friendly formatting.
