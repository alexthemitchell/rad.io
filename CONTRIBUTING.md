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

# Start development server
npm start
```

The development server will be available at `https://localhost:8080`

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
npm test               # Run all tests
npm run test:unit      # Run unit tests only (DSP, memory, device)
npm run test:components # Run component tests only
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report

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
  import { IQConstellation, Spectrogram } from '../components';
  
  // Avoid
  import { IQConstellation } from '../components/IQConstellation';
  import { Spectrogram } from '../components/Spectrogram';
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
describe('Feature Name', () => {
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

  it('should do something specific', () => {
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
import { clearMemoryPools, generateSamplesChunked } from '../../utils/testMemoryManager';

it('should handle large datasets efficiently', () => {
  // Generate large datasets in chunks
  const samples = generateSamplesChunked(1000000, generator, 10000);
  
  // Process in batches
  const result = processSamplesBatched(samples, processor, 5000);
  
  // Always cleanup
  clearMemoryPools();
});
```

### Test Coverage Goals

- **Unit tests**: >80% coverage for utility functions
- **Integration tests**: All major user flows
- **Component tests**: Critical rendering paths

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
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
   - Tests (Jest - 100% pass rate)
   - Build (Webpack)
4. **Keep PRs focused** - One feature or fix per PR
5. **Write clear PR descriptions** - Explain what, why, and how
6. **Link related issues** - Reference issue numbers in PR description

### PR Checklist

Before submitting a PR:

- [ ] Code follows style guidelines
- [ ] Added tests for new functionality
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting is correct (`npm run format:check`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention
- [ ] No unnecessary console statements

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
   describe('YourDevice', () => {
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
