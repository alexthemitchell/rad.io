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

What NOT to Create as Memories

- **Update summaries**: "Documentation Update 2025" - use commit messages instead
- **General documentation**: Comprehensive setup guides belong in `docs/`, not memories
- **Change logs**: What files you modified and why - use PR descriptions
- **Duplicate content**: Rewriting existing memories without deleting the old one
- **Transient state**: Current task progress or temporary findings

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

Quick Workflow

1. list_memories -> skim
2. read_memory (only relevant)
3. Perform focused code exploration (symbols > search > full-file)
4. Solve & validate (tests/lint/types)
5. Write/update memory (150–400 words, scannable, link paths)
6. Optionally add next-step hints or known pitfalls

**Do not write new memories explaining a fix; only write memories that include generic debugging patterns that were successful**
