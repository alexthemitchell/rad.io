This memory summarizes best practices for minimizing context noise and optimizing agent execution with Serena memories in the rad.io project.

Goals

- Keep agent context concise and relevant to the current task
- Reduce redundant reads and tool calls
- Make high-signal knowledge persistent and discoverable for future agents

Core Principles

1. Write only durable, reusable knowledge:
   - Architectural overviews, system invariants, naming conventions, and decisions that are unlikely to change.
   - Debugging playbooks and verified fixes (root cause + minimal reproducible signal + final fix summary).
   - Workflow integrations (how to run tests efficiently, memory-conscious strategies, CI gate expectations).
   - Avoid feature-specific, transient details or large dumps of logs.
   - **Do NOT create memories about updates you've made - that's what commit messages are for.**
   - **Do NOT rewrite existing bug fix memories into general documentation - they document specific issues.**
   - **Do NOT include derived runtime data in documentation** - test counts, execution times, or other metrics that change with every run. Instead, provide instructions on how to measure them (e.g., "Use `npm run test:perf` to measure current performance").

Hard rules (non‑negotiable)

- Never create memories that summarize a single run, task, PR, or manual test session. These belong in PR descriptions, Issues, or ephemeral chat — not long‑term memory.
- Never store transient or time‑bound data: logs, screenshots, per‑run outcomes, build/test counts, or “what I did today.” Link to artifacts instead (PR, CI, or test reports).
- Never include dates in memory titles unless documenting an ADR or a specific bug fix tied to an Issue/PR ID. Date‑stamped “summary” memories are prohibited.
- Prefer patterns over play‑by‑play: capture the reusable debugging approach, invariant, or architectural rule — not the timeline.

Allowed memory title prefixes (enforced)

- ADR\_… for architectural decisions (also add details under `docs/decisions/`).
- GUIDE*… or PLAYBOOK*… for durable debugging workflows and repeated procedures.
- POLICY\_… for repo‑wide rules (testing, linting, memory usage).
- REFERENCE\_… for domain concepts with links to code paths.

Disallowed memory patterns (delete on sight)

- RUN*\*, TEST*\_, SUMMARY\_\_, DAILY*\*, “REAL_HARDWARE_E2E*\*”, or anything primarily describing a specific execution/session.
- Memories that primarily contain dates, screenshots, or logs.

Pre‑commit memory gate (Yes/No)

Answer ALL with “Yes” before writing a memory:

- Will this still be useful 60–90 days from now without edits?
- Is the content a reusable pattern, invariant, or decision (not a task log)?
- Does it link to code/tests/PRs instead of copying volatile details?
- Is there no existing memory covering ≥70% of this? If there is, update it instead.

If any answer is “No”, don’t write a memory. Use one of:

- PR description (task summary, run results), Issue comment (work-in-progress notes), or `docs/` (tutorial/how‑to/reference via Diátaxis).

2. Prefer short, scannable memories:
   - Target 150–400 words; use headings and bullets.
   - Start with a one-line purpose. Clearly scoped titles like "WASM_DSP" or "WEBUSB_STREAMING_DEBUG_GUIDE".
   - Link to source files by path (e.g., `src/utils/dsp.ts`) rather than inlining code.

3. Retrieve before you read:
   - list_memories -> scan titles; read_memory only when relevant.
   - If a memory exists that answers your question, don't re-scan the codebase.
   - If no memory exists, do a targeted symbol search before full-file reads.

4. Summarize once, reuse often:
   - After resolving a non-trivial issue, write a short memory capturing the essence and where details live in code/tests/PRs.
   - Update existing memory instead of creating near-duplicates. Prefer additive edits and deprecate outdated tips explicitly.
   - **Exception**: Do NOT update bug fix memories that document specific issues into general guides.

5. Scope-aware reading strategy (noise control):
   - Use symbol tools first: get_symbols_overview -> find_symbol (include_body only when necessary) -> find_referencing_symbols.
   - Use search_for_pattern for ambiguous discovery with tight globs and context lines.
   - Avoid reading entire files unless strictly needed; never re-read the same content with symbolic tools.

6. Operational hygiene:
   - Before edits: think_about_task_adherence to confirm scope; after multi-step searches: think_about_collected_information.
   - Post-change: run minimal relevant tests, then lint/typecheck. Document any deferred issues.
   - For multi-step work: manage_todo_list with one in-progress item at a time.

7. Security and privacy:
   - Don't store secrets or large logs in memories. No external URLs that might drift; prefer internal paths and commit SHAs.

8. Deletion and freshness:
   - If a memory becomes misleading, use delete_memory and note the replacement. Prefer updating over deleting when possible.

What NOT to Create as Memories or Documentation

- **Update summaries**: "Documentation Update 2025" - use commit messages instead
- **General documentation**: Comprehensive setup guides belong in `docs/`, not memories
- **Change logs**: What files you modified and why - use PR descriptions
- **Duplicate content**: Rewriting existing memories without deleting the old one
- **Transient state**: Current task progress or temporary findings
- **Derived runtime data**: Test counts, execution times, suite counts, pass rates - these change with every run and should not be hard-coded in documentation

Examples

- Good: “PLAYBOOK_WEBUSB_STREAM_RECOVERY” — minimal steps to recover from device disconnect; links to `src/hackrf/*` and `e2e/monitor-real.spec.ts`.
- Good: “ADR_WEBGL_CLEANUP_ORDERING” — states cleanup invariants and rationale; links to `src/visualization/renderers/*` and tests.
- Bad: “REAL_HARDWARE_E2E_2025-10-27” — session summary with screenshots and per‑run outcomes; should be a PR note or chat message.

Enforcement

- If a memory violates the rules (e.g., task summaries), delete it and move details to the appropriate place (PR, Issue, docs). Do not “generalize” a transient memory after the fact; write a new, scoped PLAYBOOK*/ADR* entry if a reusable pattern exists.
- Periodically sweep `.serena/memories/` for disallowed prefixes and date‑stamped entries; remove or refactor accordingly.

References

- Microsoft Bot Framework state guidance (user vs conversation state; persist preferences, not transient turns): https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-concept-state
- LangChain chatbot memory patterns (trim/summarize instead of storing full logs): https://python.langchain.com/docs/how_to/chatbots_memory/
- Diátaxis documentation framework (separate tutorials/how‑to/reference/explanation; use docs/ instead of memory for general content): https://diataxis.fr/

When to Write a New Memory

- New architectural decision or interface contract.
- Debugging workflow that saved >30 minutes.
- Repeated Q&A topic observed >2 times.
- Any repo-wide policy impacting agents (e.g., testing constraints, CI gates).

Checklist Before Writing

- Is this durable? Will it help another agent in 1–3 months?
- Is it concise and linked to code/tests?
- Does an existing memory cover 70% of this already? If yes, update that instead.
- **Is this about a specific bug fix or issue resolution? Keep it focused on that issue, not general documentation.**
- **Am I just documenting changes I made? If yes, use commit messages instead.**
- **Does this contain runtime metrics or derived data? If yes, replace with instructions on how to measure them.**

Quick Workflow

1. list_memories -> skim
2. read_memory (only relevant)
3. Perform focused code exploration (symbols > search > full-file)
4. Solve & validate (tests/lint/types)
5. Write/update memory (150–400 words, scannable, link paths)
6. Optionally add next-step hints or known pitfalls

**Do not write new memories explaining a fix; only write memories that include generic debugging patterns that were successful**
