# Copilot Agent Setup Steps

This document provides essential setup steps and context for GitHub Copilot agents working on the rad.io repository. Following these steps ensures a clean environment and proper understanding of the project structure.

## Initial Setup

### 1. Environment Preparation

Before making any changes, ensure your environment is properly set up:

```bash
# Navigate to repository root
cd /home/runner/work/rad.io/rad.io

# Install dependencies (clean install for reproducible builds)
npm ci

# Verify installation
npm --version
node --version
```

### 2. Understanding Project Context

**Read these files first** to understand the codebase:

1. **`.github/copilot-instructions.md`** - Complete project guide with architecture, patterns, and best practices
2. **`ARCHITECTURE.md`** - Detailed technical architecture documentation
3. **`README.md`** - Project overview and quick start guide
4. **`MEMORY_API.md`** - Device memory API documentation (if working on memory/performance)

### 3. Code Quality Tools

This project enforces strict quality standards. Familiarize yourself with these tools:

```bash
# Format code with Prettier
npm run format

# Check formatting (CI requirement)
npm run format:check

# Lint code with ESLint
npm run lint

# Auto-fix linting issues
npm run lint:fix

# TypeScript type checking
npm run type-check

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build the application
npm run build
```

### 4. Pre-Commit Checklist

**ALWAYS run these commands before committing changes:**

```bash
# 1. Format all code
npm run format

# 2. Lint and fix issues
npm run lint:fix

# 3. Type check
npm run type-check

# 4. Run relevant tests
npm test -- path/to/test/file

# 5. Verify build succeeds
npm run build
```

## Working with Tests

### Test Execution Strategy

The project has **122+ tests** that must pass. Due to memory constraints:

**DO:**

- Clean up after tests with proper hooks (`afterEach`, `beforeEach`)
- Use memory management utilities from `src/utils/testMemoryManager.ts`

**DON'T:**

- Run the full test suite unless necessary
- Generate large test datasets (>10k samples) without chunking
- Skip cleanup in tests (always use `unmount()` for components)
- Ignore memory warnings during test execution

### Memory Management in Tests

When working with tests that process large datasets:

```typescript
import { clearMemoryPools, generateSamplesChunked } from '../../utils/testMemoryManager';

describe("Test Suite", () => {
  // Force GC before each test
  beforeEach(() => {
    if (global.gc) global.gc();
  });

  // Clean up memory pools after each test
  afterEach(() => {
    clearMemoryPools();
  });

  it("test with large dataset", () => {
    // Use chunked generation for datasets >10k
    const samples = generateSamplesChunked(50000, (n) => ({
      I: Math.cos(n),
      Q: Math.sin(n)
    }));

    const { container, unmount } = render(<Component samples={samples} />);

    // ... assertions ...

    // Always unmount components
    unmount();
  });
});
```

## GitHub Actions CI/CD

All pull requests must pass these quality checks:

1. ✅ **Lint Code** - ESLint validation
2. ✅ **Run Tests** - 122+ tests must pass
3. ✅ **Check Formatting** - Prettier validation
4. ✅ **Build Application** - Webpack build must succeed
5. ✅ **TypeScript Type Check** - No type errors allowed

See `.github/workflows/README.md` for detailed workflow documentation.

## Common Issues and Solutions

### Issue: "prettier: not found"

**Solution:**

```bash
# Use npx to run prettier without global install
npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"
```

### Issue: Tests run out of memory (FATAL ERROR: heap limit)

**Solution:**

- Reduce test dataset sizes (see `src/components/__tests__/VisualizationSDRData.test.tsx` for examples)
- Use memory management utilities
- Add cleanup hooks
- Run tests individually instead of full suite

### Issue: Canvas mock errors in tests

**Solution:**

- Check `jest.setup.ts` for proper canvas mocking
- Ensure all canvas methods are mocked in test setup
- See `src/components/__tests__/IQConstellation.test.tsx` for reference

### Issue: TypeScript errors after adding new features

**Solution:**

```bash
# Run type check to see all errors
npm run type-check

# Check specific file
npx tsc --noEmit path/to/file.ts
```

## Development Workflow

### Making Changes

1. **Understand the change** - Read issue/comment thoroughly
2. **Explore codebase** - Use `view`, `bash`, and search to understand context
3. **Plan changes** - Create minimal, focused modifications
4. **Implement iteratively** - Make small changes, test frequently
5. **Validate** - Run lint, format, type-check, tests
6. **Document** - Update relevant documentation
7. **Report progress** - Use `report_progress` tool with clear commit messages

### Code Style Guidelines

- **TypeScript**: Strict mode, explicit types, no `any`
- **React**: Functional components with hooks
- **Testing**: Comprehensive coverage, realistic test data
- **Comments**: Only when necessary to explain complex logic
- **Naming**: Descriptive, consistent with existing patterns

### File Modification Best Practices

- **Minimal changes**: Only modify what's necessary
- **Preserve formatting**: Run prettier after changes
- **Maintain compatibility**: Don't break existing APIs
- **Add tests**: For new features or bug fixes
- **Update docs**: When changing public APIs

## Device Implementation

When adding or modifying SDR device support:

1. **Implement `ISDRDevice` interface** completely
2. **Add USB vendor/product IDs** to `KNOWN_SDR_DEVICES`
3. **Implement format conversion** if needed (Int8/Uint8/Int16 → IQ)
4. **Add device-specific tests** in `src/models/__tests__/`
5. **Implement memory management** (`getMemoryInfo()`, `clearBuffers()`)
6. **Document capabilities** in device info

See `src/models/HackRFOneAdapter.ts` for reference implementation.

## DSP and Visualization

When working with signal processing or visualizations:

1. **Use typed arrays** (`Float32Array`) for performance
2. **Pre-allocate buffers** where possible
3. **Implement adaptive downsampling** for large datasets
4. **Use canvas optimization** (alpha: false, desynchronized: true)
5. **Handle high-DPI displays** with `devicePixelRatio`
6. **Test with realistic signals** (FM, AM, QPSK, noise)

See `src/utils/dsp.ts` and `src/components/IQConstellation.tsx` for examples.

## Repository Structure Reference

```
rad.io/
├── .github/
│   ├── copilot-instructions.md    # Main project guide (READ FIRST)
│   ├── workflows/
│   │   ├── quality-checks.yml     # CI/CD workflow
│   │   ├── README.md              # Workflow documentation
│   │   └── copilot-setup-steps.md # This file
│   └── BRANCH_PROTECTION.md       # Branch protection rules
├── src/
│   ├── components/                # React UI components
│   ├── hooks/                     # React hooks
│   ├── models/                    # SDR device implementations
│   ├── pages/                     # Top-level pages
│   ├── utils/                     # Utilities (DSP, memory mgmt)
│   └── styles/                    # CSS styles
├── ARCHITECTURE.md                # Technical architecture
├── MEMORY_API.md                  # Memory API documentation
├── README.md                      # Project overview
├── package.json                   # Dependencies and scripts
└── tsconfig.json                  # TypeScript configuration
```

## Quick Reference Commands

```bash
# Essential commands for daily development
npm ci                              # Install dependencies
npm run format                      # Format code
npm run lint:fix                    # Fix linting issues
npm run type-check                  # Check types
npm test -- path/to/test.ts        # Run specific test
npm run build                       # Build application

# Investigation commands
git log --oneline -10               # Recent commits
git status                          # Check changes
git diff                            # See modifications
npm run type-check                  # Find type errors

# Memory-conscious testing
npm test -- --maxWorkers=1 path/to/test.ts
NODE_OPTIONS='--expose-gc' npm test
```

## Getting Help

If you encounter issues:

1. **Check existing documentation** in `.github/` and root directory
2. **Review test files** for usage examples
3. **Examine source code** comments and JSDoc
4. **Look at git history** for similar changes
5. **Run diagnostics** (type-check, lint, test specific files)

## Final Checklist

Before submitting changes via `report_progress`:

- [ ] Code is properly formatted (`npm run format`)
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Relevant tests pass (`npm test -- path/to/test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if API changes)
- [ ] Commit message is clear and descriptive
- [ ] Changes are minimal and focused

---

**Remember**: Quality over speed. Take time to understand the codebase before making changes. When in doubt, ask for clarification in comments.
