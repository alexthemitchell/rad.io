# rad.io - GitHub Copilot Instructions

## Project Overview

rad.io is a professional browser-based Software-Defined Radio (SDR) application with industry-standard visualizations, universal device support, and comprehensive testing. The project emphasizes type safety, performance, and plug-and-play hardware integration using WebUSB.

**Key Technologies:**

- React 19 with TypeScript (strict mode)
- WebUSB API for hardware communication
- WebGL/WebGPU for GPU-accelerated visualizations
- AssemblyScript/WebAssembly for performance-critical DSP
- Jest for testing

**Architecture Pattern:** Model-View-Hook

- Models (src/models/): Device implementations
- Hooks (src/hooks/): React integration
- Views (src/components/, src/pages/): UI components

## Project Resources

- Use [`package.json`](../package.json) scripts to run, build, and test the project
- Use [`docs/decisions/`](../docs/decisions/) for architectural decision records (ADRs)
- Use [`docs/reference/`](../docs/reference/) for specialized SDR and DSP knowledge
- Review [`ARCHITECTURE.md`](../ARCHITECTURE.md) for system design and patterns
- Check [`CONTRIBUTING.md`](../CONTRIBUTING.md) for development workflow

Check output of `npm start` to get deployed server URL (usually https://localhost:8080)

## Code Quality Standards

**Type Safety:**

- Use strict TypeScript - no `any` types
- All device implementations must implement `ISDRDevice` interface
- Comprehensive type definitions for all functions and variables

**Testing Requirements:**

- Write tests for all new features and bug fixes
- Maintain or improve code coverage (target: >80%)
- Run `npm test` before submitting changes
- Use Jest for unit tests, Playwright for E2E tests

**Performance:**

- GPU-accelerated visualizations (WebGL/WebGPU with graceful fallbacks)
- Use Web Workers for heavy DSP processing
- Profile before optimizing - measure, don't guess

## Development Guidelines

- Always think step-by-step, be methodical and deliberate in your approach. Eliminate guesswork, assumptions, and shortcuts
- **Take as long as you need to do research using all of the tools available to you. Prioritize correctness and quality over speed**
- **Always use #problems as a first line of quality check. Fix all problems before submitting changes**
- **When considering PR comments, always address each comment individually. If you disagree with a comment, explain your reasoning clearly and respectfully. In some cases, you will be responding to yourself; this is expected, and it is fair to disagree with yourself**
- **Fix issues you find, even if they seem unrelated to your current task**

## Tool Usage Best Practices

- **It is incredibly important to use the tools available to you when implementing your solutions**
- Start every turn by using #oraios/serena/activate_project
- Always check for #problems after making changes to the codebase
- Look for tools like #problems #runTests #testFailure #usages and #runSubagent to help you interact with the development environment
- **Critical**: Prefer to use #runTests and #testFailure to run tests (and see detailed failure output respectively)
- Avoid using #runCommands/runInTerminal unless no other tool can provide the answer and the output is absolutely necessary
- Use Playwright MCP browser tools to test your code in a browser environment. Take screenshots and analyze them to verify your work
- **Prefer to read symbol data with serena tools over reading entirety of files**: use #oraios/serena/find_referencing_symbols #oraios/serena/get_symbols_overview #oraios/serena/search_for_pattern

## Project-Specific Context

- The goal of this project includes the creation of TypeScript-first WebUSB drivers for SDR hardware. This is a complex task that requires careful planning and execution. Use the tools available to you to research and implement these drivers, and always keep the user in mind as a resource to help you solve problems
- All SDR devices must implement the universal `ISDRDevice` interface for plug-and-play support
- Follow the Model-View-Hook pattern: Models → Hooks → Views
- GPU acceleration is critical for visualizations - use WebGL/WebGPU with Canvas 2D fallback
- If you can check the PR quality yourself before submitting, do so. Use #problems to identify any issues and fix them before creating a PR
- Always finish your turn by checking for #problems and fixing them before returning to the user
- Keep track of best practices for interacting with the User in the USER_INTERACTION_GUIDE memory. The goal is to minimize the number of turns needed to complete tasks by learning the User's preferences and expectations

## Custom Agents Available

This repository has specialized custom agents for specific tasks:

- **documentation-agent**: Expert in generating and enhancing technical documentation
- **hardware-agent**: Specialist in hardware integration and low-level programming
- **SDR-agent**: Expert in Software-Defined Radio and WebUSB, specializing in HackRF One and RTL-SDR devices

Delegate tasks to these agents when working in their domain areas.
