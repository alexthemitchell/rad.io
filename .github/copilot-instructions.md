# rad.io - SDR Visualizer Project Guide

**Take as long as you need to do research using all of the tools available to you. Prioritize correctness and quality over speed.**

**Always use #problems as a first line of quality check. Fix all problems before submitting changes.**

**When considering PR comments, always address each comment individually. If you disagree with a comment, explain your reasoning clearly and respectfully. In some cases, you will be responding to yourself; this is expected, and it is fair to disagree with yourself.**

**Fix issues you find, even if they seem unrelated to your current task.**

**Consider `docs/decisions/` for architectural decision records that may inform your work.**
**Refer to `docs/reference/` for specialized domain knowledge about SDR and related technologies.**

**When reviewing memories, consider whether it is valuable information for future agents. If not, do not allow it to be committed**

## Tools

- **It is incredibly important to use the tools available to you when implementing your solutions.**
- Start every turn by using #oraios/serena/activate_project
- When using #microsoftdocs/mcp/microsoft_docs_fetch to fetch documentation, you can specify a URL or a search query. If you provide a search query, the tool will return the most relevant documentation it can find.
- Always check for #problems after making changes to the codebase.
- Look for tools like #problems #runTasks #runTests #usages and #executePrompt to help you interact with the development environment
- **Critical**: Prefer to use #runTests and #runTasks over #runCommands/runInTerminal Feel free to #runTasks/createAndRunTask
- Avoid using #runCommands/runInTerminal unless no other tool can provide the answer and the output is absolutely necessary
- Use Playwright MCP browser tools to test your code in a browser environment. Take screenshots and analyze them to verify your work.
- **Prefer to read symbol data with serena tools over reading entirety of files**: use #oraios/serena/find_referencing_symbols #oraios/serena/get_symbols_overview #oraios/serena/search_for_pattern
  **Maintain Long Term Memory**: use #oraios/serena/read_memory when thinking about how to solve problems and #oraios/serena/write_memory when you have learned something new that will be valuable for a future Agent.
- Before writing a memory, use #oraios/serena/read_memory to find "SERENA_MEMORY_BEST_PRACTICES". Follow those best practices to add helpful long-term memories before you end your turn. You may decide to update existing memories rather than creating new ones, remove outdated memories, or choose not to write any memories at all.
  - Hard memory rules:
  - Do not create memories that summarize a run, task, PR, or manual test session (e.g., “REAL_HARDWARE_E2E_2025-10-27”). These belong in PR descriptions, Issues, or chat.
  - Do not store transient artifacts or metrics (logs, screenshots, per-run results, test counts, timings). Link to CI/test reports instead.
  - Use only these prefixes for memory titles: ADR*, GUIDE*/PLAYBOOK*, POLICY*, REFERENCE\_. Date‑stamped or “SUMMARY/DAILY/TEST/RUN” prefixes are prohibited.
  - If it won’t be useful 60–90 days from now, don’t write it.
- The goal of this project includes the creation of TypeScript-first WebUSB drivers for SDR hardware. This is a complex task that requires careful planning and execution. Use the tools available to you to research and implement these drivers, and always keep the user in mind as a resource to help you solve problems.
- If you can check the PR quality yourself before submitting, do so. Use #problems to identify any issues and fix them before creating a PR.

## Agent performance & context hygiene

Follow these practices to keep your context lean and optimize execution:

### Memory workflow (enforcement)

- Pre-commit gate: answer “Yes” to all — durable for 60–90 days, reusable pattern/invariant/decision, links to code/tests/PRs, no near-duplicate exists. Otherwise, do not write memory.
- Prefer docs/ for general guides (apply Diátaxis: tutorials/how‑to/reference/explanation); use ADR for decisions, PLAYBOOK for repeatable debugging; PR/Issue comments for run summaries.
- If you accidentally create a transient memory, delete it and move content to PR/Issue. Don’t retroactively “generalize” it.

References: Microsoft Bot Framework state (persist preferences, not turns): https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-concept-state • LangChain memory patterns (trim/summarize): https://python.langchain.com/docs/how_to/chatbots_memory/ • Diátaxis for docs organization: https://diataxis.fr/

1. Retrieval before reading

- Use #oraios/serena/list_memories → scan for relevant items (start with "SERENA_MEMORY_BEST_PRACTICES").
- Use #oraios/serena/read_memory only for relevant memories; if a memory answers your question, avoid scanning the codebase.

2. Symbol-first code exploration

- Prefer these tools in order:
  - #oraios/serena/get_symbols_overview
  - #oraios/serena/find_symbol (include_body=true only when necessary)
  - #oraios/serena/find_referencing_symbols
- For discovery, use #oraios/serena/search_for_pattern with tight include globs and minimal context lines.
- Avoid reading entire files unless strictly necessary. Never re-read the same content with multiple tools.

3. Memory writing policy (what to store)

- Capture durable, reusable knowledge: architecture decisions, invariants, concise debugging playbooks (root cause → minimal signal → fix), and repo-wide workflows.
- Keep memories short (≈150–400 words), scannable, and link to code paths instead of inlining code.
- Update existing memories rather than creating near-duplicates; explicitly deprecate outdated tips. Do not store secrets or large logs.
- Before writing a memory, first use #oraios/serena/read_memory to find best practices on long term memory management.
- You do not need to write any notes summarizing changes to memory, nor to files which are committed to the respository. Save these for comments and chat messages only.

4. Operational hygiene

- Use a structured todo list to plan work; keep one item in progress.
- Before edits, sanity-check your scope and assumptions; after multi-step searches, review whether collected information is sufficient.
- After edits to runnable code: use #runTests for targeted tests. Then run lint, type-check, and build using project scripts.
- Do not add eslint-ignore or disable type checks unless absolutely necessary. Instead, fix the underlying issues.
- Fix all problems surfaced by lint/type-check/build before proceeding, even if they are outside your immediate scope.

5. Quick workflow

- list_memories → read_memory (relevant only)
- explore via symbols (overview → symbol → references)
- search_for_pattern if needed; avoid full-file reads
- implement → run relevant tests → lint/type-check
- write/update memory (concise, durable, linked to code)

Security & privacy: Never store secrets in memories; prefer repo paths and commit SHAs over external links that can drift.

**Quality Standards:**

- All code must pass lint, format, type-check, and tests
- Add tests for new features
- Follow existing code patterns
- Update documentation for API changes
- Include JSDoc comments for public APIs

**Submitting Changes:**

1. Create feature branch from `main`
2. Make minimal, focused changes
3. Add/update tests
4. Run quality checks locally
5. Create PR - automated checks will run
6. All quality gates must pass before merge
