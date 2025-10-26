# Contributing to rad.io

Thank you for your interest in contributing to rad.io! This document provides guidelines and best practices for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing Guidelines](#testing-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js >= 16.x
- npm >= 8.x
- Modern web browser with WebUSB support (Chrome 61+, Edge 79+, Opera 48+)

### Setup

```bash
# Clone the repository
git clone https://github.com/alexthemitchell/rad.io.git
cd rad.io

# Install dependencies
npm install

# Start development server (HTTPS)
npm start
```

The development server runs over HTTPS at `https://localhost:8080` by default.

## Development Workflow

### Available Scripts

```bash
# Development
npm start              # Start HTTPS dev server with hot reload
npm run dev            # Alias for npm start

# Building
npm run build          # Development build
npm run build:prod     # Production build with optimizations

# Code Quality
npm run lint           # Check code for linting issues
npm run lint:fix       # Auto-fix linting issues
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting
npm run type-check     # Run TypeScript type checking
npm run validate       # Run all quality checks + build

# Testing
npm test               # Run all tests with coverage
npm run test:watch     # Run tests in watch mode

# Cleanup
npm run clean          # Remove build artifacts and dependencies
```

### Recommended Development Flow

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes incrementally**
   - Write code following our style guide
   - Add tests for new functionality
   - Run `npm run validate` frequently

3. **Ensure quality before committing**

   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   npm test
   npm run build
   ```

> Optional: Run a focused test suite
>
> ```bash
> npm test -- src/utils/__tests__/dsp.test.ts
> ```

4. **Commit with descriptive messages**

```bash
git add .
git commit -m "feat: add support for new SDR device"
```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style

### TypeScript Guidelines

- **Use strict type checking** - The project uses TypeScript strict mode
- **Avoid `any` types** - Use specific types or generics instead
- **Use interfaces for public APIs** - Especially for device implementations
- **Document complex types** - Add JSDoc comments for non-obvious types

### React Guidelines

- **Use functional components** - No class components
- **Use hooks for state management** - `useState`, `useEffect`, `useCallback`, etc.
- **Keep components focused** - Single responsibility principle
- **Use TypeScript for props** - Always define prop types

### Code Organization

- **Barrel exports** - Use `index.ts` files for cleaner imports

  ```typescript
  // Good
  import { IQConstellation, Spectrogram } from "../components";

  // Avoid
  import { IQConstellation } from "../components/IQConstellation";
  import { Spectrogram } from "../components/Spectrogram";
  ```

- **File naming conventions**
  - Components: `PascalCase.tsx`
  - Hooks: `useCamelCase.ts`
  - Utils: `camelCase.ts`
  - Types/Interfaces: `PascalCase.ts`

### ESLint Rules

Key rules enforced:

- **No unused variables** - Clean up unused imports and variables
- **Curly braces required** - All control structures must use braces
- **No console.log** - Use `console.warn` or `console.error` instead
- **React Hooks rules** - Follow hooks best practices
- **Strict equality** - Use `===` instead of `==`
- **Prefer const** - Use `const` over `let` when possible

## Testing Guidelines

### Test Organization

Tests are organized by feature:

- `src/utils/__tests__/` - Unit tests for DSP and utility functions
- `src/models/__tests__/` - Unit tests for device models
- `src/components/__tests__/` - Component tests

### Writing Tests

```typescript
describe("Feature Name", () => {
  beforeEach(() => {
    // Setup before each test
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    // Cleanup after each test
    clearMemoryPools();
  });

  it("should do something specific", () => {
    // Arrange
    const input = createTestData();

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### Memory Management in Tests

For tests generating large datasets:

```typescript
import {
  clearMemoryPools,
  generateSamplesChunked,
} from "../../utils/testMemoryManager";

it("should handle large datasets efficiently", () => {
  // Generate large datasets in chunks
  const samples = generateSamplesChunked(1000000, generator, 10000);

  // Process in batches
  const result = processSamplesBatched(samples, processor, 5000);

  // Always cleanup
  clearMemoryPools();
});
```

## Test Coverage Goals

rad.io enforces strict coverage thresholds to maintain code quality and prevent regressions. All new code must meet or exceed these minimums:

### Module-Specific Thresholds

#### Critical DSP Utilities (≥95% coverage required)

- `src/utils/dsp.ts` - Core DSP functions (FFT, spectrogram, waveform)
- `src/utils/testMemoryManager.ts` - Test infrastructure

**Why 95%?** These modules perform complex mathematical operations that directly affect signal quality. Any uncovered edge case could result in incorrect visualizations or crashes.

#### Device Models (≥90% coverage required)

- `src/models/SDRDevice.ts` - Universal device interface
- `src/models/HackRFOne.ts` - Hardware communication layer

**Why 90%?** Device drivers interact with hardware and must handle all error conditions gracefully. High coverage ensures robust USB communication and proper error recovery.

#### Core Utilities (≥75-85% coverage required)

- `src/utils/audioStream.ts` (85%) - Real-time audio processing
- `src/utils/iqRecorder.ts` (75%) - Recording and playback
- `src/utils/p25decoder.ts` (95%) - P25 protocol decoder
- `src/utils/rdsDecoder.ts` (55%) - RDS/RBDS data decoder
- `src/utils/tmcDecoder.ts` (85%) - Traffic message decoder

#### UI Components (≥70-75% coverage encouraged)

- React components with WebGL fallbacks may have lower thresholds due to browser API mocking limitations
- Focus on testing component logic, state management, and user interactions
- Visual rendering tested via manual verification and E2E tests

### Coverage Enforcement

**CI/CD Pipeline**

- All PRs must maintain or improve overall coverage
- Per-module thresholds are enforced in `jest.config.js`
- Codecov integration provides visual coverage reports
- PRs that decrease coverage below thresholds will fail CI

**Local Verification**

```bash
# Check coverage for all modules
npm test -- --coverage

# Check coverage for specific module
npm test -- src/utils/__tests__/dsp.test.ts --coverage

# Generate HTML coverage report
npm test -- --coverage --coverageReporters=html
open coverage/index.html
```

**Coverage Badge**

[![codecov](https://codecov.io/gh/alexthemitchell/rad.io/branch/main/graph/badge.svg)](https://codecov.io/gh/alexthemitchell/rad.io)

The badge in README.md reflects current coverage and links to detailed reports.

### Test Strategy by Module Type

#### DSP Functions

- Test mathematical correctness with known inputs/outputs
- Validate edge cases (zero, negative, NaN, Infinity)
- Verify energy conservation (Parseval's theorem)
- Test frequency accuracy within ±1 bin
- Benchmark performance for large datasets

**Example:**

```typescript
it("should satisfy Parseval's theorem (energy conservation)", () => {
  const samples = generateSineWave(1000, 440, 48000);
  const spectrum = calculateSpectrogramRow(samples, 512);

  const timeEnergy = samples.reduce((sum, s) => sum + s.i ** 2 + s.q ** 2, 0);
  const freqEnergy = spectrum.reduce((sum, val) => sum + val ** 2, 0);

  expect(freqEnergy).toBeCloseTo(timeEnergy / spectrum.length, -1);
});
```

#### Device Models

- Mock WebUSB API to simulate hardware responses
- Test all error conditions (device disconnected, invalid commands)
- Verify state management (open/close, start/stop)
- Test parameter validation (frequency ranges, gain limits)
- Simulate realistic data streams

**Example:**

```typescript
it("should recover from device disconnection", async () => {
  const device = new HackRFOne(mockUSBDevice);
  await device.open();
  await device.startReceiving();

  // Simulate disconnection
  mockUSBDevice.opened = false;

  await expect(device.setFrequency(100e6)).rejects.toThrow("Device not open");
  expect(device.isOpen()).toBe(false);
});
```

#### React Components

- Test user interactions (clicks, keyboard input)
- Verify state changes and side effects
- Mock browser APIs (WebGL, WebUSB, Web Audio)
- Test accessibility (ARIA attributes, keyboard navigation)
- Validate error boundaries and fallback rendering

**Example:**

```typescript
it("should fallback to 2D canvas when WebGL unavailable", () => {
  // Mock WebGL failure
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

  const { container } = render(<IQConstellation samples={mockSamples} />);

  // Should still render
  expect(container.querySelector("canvas")).toBeInTheDocument();
});
```

### Adding Tests for New Features

When adding new functionality:

1. **Write tests first (TDD approach)** - Define expected behavior before implementation
2. **Test public APIs** - Focus on inputs/outputs, not internal implementation
3. **Cover edge cases** - Test boundary conditions, invalid inputs, error handling
4. **Mock external dependencies** - Isolate unit under test from browser APIs, network, file system
5. **Verify coverage** - Run `npm test -- --coverage` to confirm new code meets thresholds
6. **Document test assumptions** - Add comments explaining complex test setups or mock data

### Dealing with Hard-to-Test Code

Some code paths are difficult to test due to browser API limitations:

- **WebGL rendering** - Mock `getContext()` to test fallback logic
- **WebUSB device access** - Create mock USB device objects
- **Web Audio API** - Mock `AudioContext` and nodes
- **IndexedDB** - Use fake-indexeddb package
- **Web Workers** - Test worker code in isolation

**When coverage is impractical:**

1. Document why full coverage isn't achievable (add comment in code)
2. Manually verify behavior with browser testing
3. Add E2E tests if available
4. Consider refactoring to extract testable logic

### Coverage vs Quality

**Coverage is a tool, not a goal.** High coverage doesn't guarantee bug-free code:

- 100% statement coverage can miss logic errors
- Edge cases may not be covered even with high line coverage
- Integration issues can exist despite perfect unit test coverage

**Focus on:**

- **Meaningful tests** - Each test should verify specific behavior
- **Realistic scenarios** - Use production-like data and workflows
- **Regression prevention** - Add tests for every bug fix
- **Maintainability** - Tests should be clear, concise, and well-documented

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(device): add support for RTL-SDR v4
fix(visualization): correct FFT frequency shifting
docs(readme): update installation instructions
refactor(hooks): extract device lifecycle logic
test(dsp): add edge case tests for waveform calculation
```

## Pull Request Process

1. **Update documentation** - If adding features, update README.md and related docs
2. **Add tests** - New features require tests
3. **Run quality checks** - All CI checks must pass
   - Linting (ESLint)
   - Formatting (Prettier)
   - Type checking (TypeScript)
   - Tests (Jest - all tests must pass)
   - Build (Webpack)
4. **Keep PRs focused** - One feature or fix per PR
5. **Write clear PR descriptions** - Explain what, why, and how
6. **Link related issues** - Reference issue numbers in PR description

### PR Checklist

Before submitting a PR:

- ☐ Code follows style guidelines
- ☐ Added tests for new functionality
- ☐ All tests pass (`npm test`)
- ☐ Linting passes (`npm run lint`)
- ☐ Formatting is correct (`npm run format:check`)
- ☐ Type checking passes (`npm run type-check`)
- ☐ Build succeeds (`npm run build`)
- ☐ Self-assessment passed (`npm run self-assess`) - optional but recommended
- ☐ Documentation updated if needed
- ☐ Commit messages follow convention
- ☐ No unnecessary console statements
- ☐ **Accessibility checklist completed** (see [.github/ACCESSIBILITY_CHECKLIST.md](.github/ACCESSIBILITY_CHECKLIST.md))

### Accessibility Requirements

All PRs must maintain or improve accessibility. Before submitting:

1. **Run automated tests**: `npm run lint` and `npm test` must pass
2. **Test keyboard navigation**: Navigate your changes using only Tab, Enter, Space, and arrow keys
3. **Verify focus indicators**: Ensure all interactive elements have visible focus
4. **Check ARIA labels**: All non-text elements have descriptive labels
5. **Review the checklist**: See [.github/ACCESSIBILITY_CHECKLIST.md](.github/ACCESSIBILITY_CHECKLIST.md)

**Key Resources**:

- Full accessibility guide: [ACCESSIBILITY.md](./ACCESSIBILITY.md)
- PR review checklist: [.github/ACCESSIBILITY_CHECKLIST.md](.github/ACCESSIBILITY_CHECKLIST.md)
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/

### Additional Notes

- When running large or memory-intensive tests, prefer targeted runs and cleanups as shown in examples under `src/components/__tests__/` and `src/utils/__tests__/`.

## Writing accessible docs in this repo

When updating documentation, follow these quick checks:

- Use descriptive image alt text that conveys purpose (e.g., “Screenshot of rad.io SDR visualizer showing IQ constellation…”).
- Ensure link text is meaningful out of context (avoid “click here”).
- Maintain a logical heading hierarchy (H1 → H2 → H3; don’t skip levels).
- Use emojis as visual cues only; don’t rely on them to convey essential information.
- Keep contrast and readability in mind; prefer plain language.

Additional resource: GitHub’s accessibility tips for profile/readme content

- https://github.blog/developer-skills/github/5-tips-for-making-your-github-profile-page-accessible/

## Adding New SDR Devices

To add support for a new SDR device:

1. **Implement the `ISDRDevice` interface**

   ```typescript
   // src/models/YourDevice.ts
   export class YourDevice implements ISDRDevice {
     // Implement all interface methods
   }
   ```

2. **Create a device adapter if needed**

   ```typescript
   // src/models/YourDeviceAdapter.ts
   export class YourDeviceAdapter implements ISDRDevice {
     // Adapter pattern for format conversion
   }
   ```

3. **Add device hook**

   ```typescript
   // src/hooks/useYourDevice.ts
   export function useYourDevice() {
     // Hook for React integration
   }
   ```

4. **Write comprehensive tests**

   ```typescript
   // src/models/__tests__/YourDevice.test.ts
   describe("YourDevice", () => {
     // Test all interface methods
   });
   ```

5. **Update documentation**
   - Add to README.md
   - Update ARCHITECTURE.md if needed
   - Add usage examples

## Questions?

If you have questions or need help:

- Check existing documentation in `/docs` and `.github/`
- Review existing code for examples
- Open an issue for discussion

Thank you for contributing to rad.io! 🎉
