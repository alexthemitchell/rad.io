## Tasks

1. Explore the existing application as it runs in a browser, identifying any bugs, issues, confusion points, or areas for improvement.
2. Review the relevant code files to understand the implementation details related to the identified issues.
3. For each identified issue, create a detailed task description that includes:
   - A clear explanation of the problem.
   - The goals for fixing the issue.
   - References to the relevant code files.
   - Success criteria to determine when the issue is resolved.
4. Create a new prompt file in the `.github/prompts/` directory for each task, following the structure outlined above.
5. Perform a self-review of the created prompt files to ensure clarity and completeness. Make improvements to the prompt as necessary.
6. For each prompt, assign a sub-agent to complete the work described in the prompt.
7. When a sub-agent completes a task, review the changes made to ensure they meet the success criteria outlined in the prompt. Prove or disprove that the issue has been resolved based on the defined criteria. If the issue is not resolved, provide re-assign the task to a sub-agent with the necessary adjustments to the prompt.
8. Document the entire process, including the initial exploration, task creation, sub-agent assignments, and reviews, to provide a clear record of the work done.

## Notes

- Use the Playwright MCP server/tools to explore the application in a browser. Remember that the Playwright MCP environment has a real browser context, so you can interact with the application as a user would (with attached HackRF device and fully-featured Chrome browser).
- Ensure that each prompt file is well-structured and easy to understand.
- Use sub-agents if necessary to break down complex tasks into manageable parts.
