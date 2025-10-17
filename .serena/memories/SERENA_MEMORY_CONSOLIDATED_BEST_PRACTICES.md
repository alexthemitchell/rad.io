# Serena Memory Consolidation & Optimization (October 2025)

## Purpose
This memory documents the consolidated, refactored, and optimized best practices for memory management in the rad.io project, ensuring future agents operate with minimal noise and maximal signal.

## Key Principles
- **Durable Knowledge Only**: Store architectural decisions, system invariants, debugging playbooks, and repo-wide workflows. Avoid feature-specific, transient, or log-heavy details.
- **Short, Scannable Memories**: Target 150–400 words, use headings/bullets, and link to code paths (not inline code).
- **Retrieve Before Read**: Always list and scan memories before reading code. If a memory answers the question, avoid codebase scans.
- **Symbol-First Exploration**: Use symbol tools (overview, find_symbol, find_referencing_symbols) before full-file reads. Prefer search_for_pattern for ambiguous discovery.
- **Summarize Once, Reuse Often**: After resolving issues, update existing memories rather than creating near-duplicates. Deprecate outdated tips explicitly.
- **Operational Hygiene**: Use manage_todo_list for multi-step work, run minimal relevant tests after edits, and document deferred issues.
- **Security & Privacy**: Never store secrets, large logs, or external URLs. Prefer internal paths and commit SHAs.
- **Deletion & Freshness**: Update memories for accuracy; delete only if misleading, noting replacements.

## Quick Workflow
1. list_memories → skim titles
2. read_memory (only relevant)
3. Symbol-first code exploration (overview → symbol → references)
4. Solve & validate (tests/lint/types)
5. Write/update memory (150–400 words, link paths)
6. Optionally add next-step hints or known pitfalls

## Checklist Before Writing
- Is this durable and reusable for future agents?
- Is it concise and linked to code/tests?
- Does an existing memory cover most of this? If yes, update instead.

## References
- See `SERENA_MEMORY_BEST_PRACTICES` for full details.
- Architecture, debugging, and style conventions: `ARCHITECTURE`, `DEBUGGING_METHODOLOGY`, `style_conventions`.
- Device, DSP, and accessibility: `WASM_DSP`, `WEBUSB_AUTO_CONNECT`, `WEBUSB_STREAMING_DEBUG_GUIDE`, `HACKRF_DEVICE_INITIALIZATION_BUG_FIX`, `HACKRF_PROTECTIVE_MEASURES_IMPLEMENTATION`, `ACCESSIBILITY_SUMMARY`.

## Maintenance
- Review and update this memory quarterly or after major architectural changes.
- Deprecate outdated tips and link to replacements.

---
This memory supersedes prior scattered best practices and should be referenced by all future agents for context hygiene and operational efficiency.