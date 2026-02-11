# Secure Context + HTTPS Dev Plan (Windows)

**ID:** P0-06-04  
**Roadmap:** Phase 0 / 0.6 Risk Register + Validation Spikes (Timeboxed)  
**Roadmap Description:** local cert strategy, localhost exceptions, and “how to run” guidance.

## Summary

Create a Windows-focused development guide for running rad.io in a secure context, including HTTPS options, certificate trust steps, and notes about WebUSB and cross-origin isolation prerequisites.

This should remove “it works on my machine” friction for contributors.

## Deliverables

- Dev guide: `docs/reference/dev/https-dev-windows.md`.
- Include two paths:
  - Minimal path (localhost secure context) for WebUSB development.
  - Production-like HTTPS path (trusted local cert) for testing COOP/COEP and related features.

## Acceptance Criteria

- [ ] Guide exists at `docs/reference/dev/https-dev-windows.md`.
- [ ] Guide includes:
  - [ ] Prereqs (Node version, browser, admin rights)
  - [ ] How to start the dev server and find the URL
  - [ ] Local certificate generation options (e.g., `mkcert` or equivalent)
  - [ ] Windows trust-store steps
  - [ ] Browser-specific notes (Chrome/Edge)
  - [ ] WebUSB secure-context notes
  - [ ] Cross-origin isolation notes (COOP/COEP) and how to verify `crossOriginIsolated`
- [ ] Includes troubleshooting section (common cert errors, mixed content, headers missing).

## Agent Prompt

Draft the Windows HTTPS dev plan.

Output file:

- `docs/reference/dev/https-dev-windows.md`

Steps:

1. Identify the dev server URL pattern (the repo notes `https://localhost:8080`).
1. Document the minimal local path and the HTTPS-with-trusted-local-cert path.
1. Include how to verify secure context, WebUSB availability, and `crossOriginIsolated` when COOP/COEP is configured.

Validation checklist:

- [ ] Steps are copy/paste-friendly for Windows.
- [ ] Includes verification and troubleshooting.
- [ ] Markdownlint-friendly formatting.
