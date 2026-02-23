# Privacy Review Checklist

Source requirement:

- `docs/roadmap/00_PRODUCT_DEFINITION/00_09_BACKLOG_RELEASE_CHANGE_MANAGEMENT/P0-09-03_telemetry-privacy-review-gate.md`

Use this checklist whenever telemetry, diagnostics, logging, or recording metadata changes.

## Data Classification

- [ ] Data fields are classified (`non-PII`, `potentially sensitive`, `PII`).
- [ ] Default posture is `no PII by default`.
- [ ] If any sensitive field exists, rationale and handling are documented.

## Collection Boundaries

- [ ] Collection is limited to what is required for reliability/debuggability.
- [ ] Must-not-collect categories are enforced unless explicit opt-in exists:
  - Personal identifiers.
  - Raw payload content with potential user-identifying data.
  - Unredacted USB payload dumps.
- [ ] Raw USB payload logging is disabled by default and requires explicit debug opt-in.

## Consent UX

- [ ] Data that is not strictly required for core function is opt-in.
- [ ] Consent language is clear and reversible.
- [ ] User can disable optional diagnostics without breaking core app use.

## Redaction

- [ ] Logs redact identifiers and high-entropy blobs by default.
- [ ] Error traces avoid embedding raw device payloads.
- [ ] Redaction behavior is covered by tests or deterministic checks.

## Storage And Retention

- [ ] Local-only storage by default unless explicitly configured otherwise.
- [ ] Retention period is defined for each telemetry/diagnostic category.
- [ ] Deletion/clear path is documented for persisted diagnostics.

## Review Outputs

- [ ] PR links this checklist and states pass/fail per section.
- [ ] `docs/telemetry/telemetry-data-contract.md` updated for any field/category change.
- [ ] Follow-up issues are created for deferred privacy hardening items.
