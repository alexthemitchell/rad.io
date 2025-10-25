Before finishing a task: run Prettier (`npm run format`), lint (`npm run lint` or `npm run lint:fix`), TypeScript check (`npm run type-check`), execute relevant Jest suites (`npm test -- <path>` or targeted scripts), ensure Webpack build succeeds (`npm run build`), and confirm documentation is updated for changed APIs. Optionally run `npm run self-assess` for full QA report.

**CRITICAL: All tests must pass with 100% pass rate. Partial test passes are not acceptable for PR merge. The same is true for formatting and linting.**
