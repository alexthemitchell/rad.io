# Branch Protection Configuration

This repository uses GitHub Actions for automated quality control. All pull requests to `main` must pass the following checks before merging:

## Required Checks

1. **Lint Code** - ESLint validation for code quality
2. **Run Tests** - Jest test suite with coverage reporting
3. **Check Formatting** - Prettier code formatting validation
4. **Build Application** - Webpack build must succeed
5. **TypeScript Type Check** - TypeScript compiler validation

## Setting Up Branch Protection

Repository administrators should configure the following branch protection rules for `main`:

### Required Status Checks

Go to **Settings** → **Branches** → **Add branch protection rule** for `main`:

1. ✅ **Require status checks to pass before merging**
   - Require branches to be up to date before merging
   - Required status checks:
     - `Lint Code`
     - `Run Tests`
     - `Check Formatting`
     - `Build Application`
     - `TypeScript Type Check`
     - `All Quality Checks Passed`

2. ✅ **Require pull request reviews before merging**
   - Required approving reviews: 1 (recommended)
   - Dismiss stale pull request approvals when new commits are pushed

3. ✅ **Require conversation resolution before merging**

4. ✅ **Do not allow bypassing the above settings**

## Local Development Workflow

Before pushing code, run these commands locally:

```bash
# Format code
npm run format

# Check formatting
npm run format:check

# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npm run type-check

# Build
npm run build
```

## Pre-commit Hook (Optional)

Consider adding a pre-commit hook using Husky to automatically run checks:

```bash
npm install --save-dev husky lint-staged
npx husky init
```

Add to `.husky/pre-commit`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run format:check
npm run lint
npm run type-check
npm test
```

## CI/CD Pipeline

The quality checks workflow runs on:
- Every push to `main` branch
- Every pull request targeting `main` branch

### Workflow Jobs

1. **lint**: Runs ESLint on all source files
2. **test**: Runs Jest test suite with coverage reporting
3. **format**: Checks Prettier formatting
4. **build**: Builds the application with webpack
5. **type-check**: Validates TypeScript types
6. **all-checks**: Final gate ensuring all checks passed

All jobs must succeed for a PR to be mergeable.

## Troubleshooting

### Formatting Failures
Run `npm run format` to auto-fix formatting issues.

### Linting Failures
Run `npm run lint:fix` to auto-fix linting issues where possible.

### Test Failures
Review test output and fix failing tests. Run `npm run test:watch` for interactive testing.

### Build Failures
Check webpack output for errors. Common issues:
- Missing dependencies
- TypeScript errors
- Invalid imports

### Type Check Failures
Run `npm run type-check` locally to see TypeScript errors. Fix type issues in source files.
