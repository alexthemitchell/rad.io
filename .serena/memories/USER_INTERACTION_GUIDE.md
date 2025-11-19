# USER INTERACTION - Playwright MCP TLS Issue Resolution

## Context
User requested debugging of why GitHub Copilot Coding Agents cannot use Playwright MCP browser tools with TLS requirement for `https://localhost:8080`.

## Problem Identified
- Playwright MCP server (`@playwright/mcp@0.0.40`) doesn't support `ignoreHTTPSErrors` option
- rad.io dev server uses self-signed certificate (webpack-dev-server)
- MCP browser tools fail with `ERR_CERT_AUTHORITY_INVALID`

## Solution Delivered
Created comprehensive workaround using Playwright test framework via `bash` tool:
1. **Helper Test**: `e2e/screenshot-helper.spec.ts` with 5 screenshot scenarios
2. **Documentation**: Full guide in `docs/PLAYWRIGHT_TLS_WORKAROUND.md`
3. **Quick Reference**: TL;DR in `docs/SCREENSHOT_QUICK_REF.md`
4. **NPM Script**: `npm run screenshot` for convenience
5. **Instructions**: Updated `.github/copilot-instructions.md`
6. **Memory**: Created `PLAYWRIGHT_MCP_TLS_WORKAROUND` for future agents

## Key Learnings
- User prefers thorough documentation over quick fixes
- Screenshots as proof of functionality are valuable
- Comprehensive testing and security scans expected
- Memory system should capture durable, reusable knowledge

## User Preferences Observed
- Appreciates detailed investigation before implementation
- Values complete documentation for future reference
- Expects security validation (CodeQL scan)
- Prefers solutions that work within existing constraints

## Success Metrics
✅ All 5 screenshot tests pass
✅ CodeQL security scan clean
✅ Complete documentation (300+ lines)
✅ Working npm script
✅ Memory created for future agents
✅ Proof via actual screenshots provided

## Reusable Pattern
When MCP tools have limitations:
1. Identify the root cause (configuration vs. implementation)
2. Find alternative tools that respect existing configs
3. Create helper scripts/tests for easy reuse
4. Document thoroughly with examples
5. Update agent instructions
6. Create memory for future reference
