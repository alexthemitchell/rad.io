- Use [`package.json`](../package.json) scripts to run, build, and test the project.
- Use [`docs/decisions/`](../docs/decisions/) for architectural decision records that may inform your work.
- Use [`docs/reference/`](../docs/reference/) for specialized domain knowledge about SDR and related technologies.
- When adding stateful features, follow the patterns in [ARCHITECTURE.md - State & Persistence](../ARCHITECTURE.md#state--persistence) to choose the appropriate storage mechanism (IndexedDB, localStorage, Zustand, or React hooks).

- Look for existing implementations before writing new ones; there may be similar code used elsewhere and we want to minimize duplication.
- Streamline duplicate implementations into a single, reusable implementation when possible.

Check output of `npm start` to get deployed server URL (usually https://localhost:8080)

- Always think step-by-step, be methodical and deliberate in your approach. Eliminate guesswork, assumptions, and shortcuts.

**Take as long as you need to do research using all of the tools available to you. Prioritize correctness and quality over speed.**

**Always use #problems as a first line of quality check. Fix all problems before submitting changes.**

**When considering PR comments, always address each comment individually. If you disagree with a comment, explain your reasoning clearly and respectfully. In some cases, you will be responding to yourself; this is expected, and it is fair to disagree with yourself.**

**Fix issues you find, even if they seem unrelated to your current task.**

## Tools

- **It is incredibly important to use the tools available to you when implementing your solutions.**
- Start every turn by using #oraios/serena/activate_project
- Always check for #problems after making changes to the codebase.
- Look for tools like #problems #runTests #testFailure #usages and #runSubagent to help you interact with the development environment
- **Critical**: Prefer to use #runTests and #testFailure to run tests (and see detailed failure output respectively)
- Avoid using #runCommands/runInTerminal unless no other tool can provide the answer and the output is absolutely necessary
- Use Playwright MCP browser tools to test your code in a browser environment. Take screenshots and analyze them to verify your work.
- **Prefer to read symbol data with serena tools over reading entirety of files**: use #oraios/serena/find_referencing_symbols #oraios/serena/get_symbols_overview #oraios/serena/search_for_pattern
- The goal of this project includes the creation of TypeScript-first WebUSB drivers for SDR hardware. This is a complex task that requires careful planning and execution. Use the tools available to you to research and implement these drivers, and always keep the user in mind as a resource to help you solve problems.
- If you can check the PR quality yourself before submitting, do so. Use #problems to identify any issues and fix them before creating a PR.
- Always finish your turn by checking for #problems and fixing them before returning to the user
- Keep track of best practices for interacting with the User in the USER_INTERACTION_GUIDE memory. The goal is to minimize the number of turns needed to complete tasks by learning the User's preferences and expectations.
