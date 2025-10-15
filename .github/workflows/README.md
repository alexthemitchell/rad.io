# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the rad.io project.

## Quality Checks Workflow

**File**: `quality-checks.yml`

**Trigger**: Runs on all pull requests and pushes to `main` branch

### Jobs

#### 1. Lint Code
- Runs ESLint on all source files
- Checks for code quality issues and potential bugs
- Command: `npm run lint`

#### 2. Run Tests  
- Executes Jest test suite with coverage reporting
- Uploads coverage to Codecov (optional)
- Command: `npm test -- --coverage`
- **122 tests** must pass

#### 3. Check Formatting
- Validates Prettier code formatting
- Ensures consistent code style across the project
- Command: `npx prettier --check "src/**/*.{ts,tsx,js,jsx,json,css,md}"`

#### 4. Build Application
- Builds the application with webpack
- Ensures the project compiles successfully
- Uploads build artifacts for 7 days
- Command: `npm run build`

#### 5. TypeScript Type Check
- Runs TypeScript compiler in check mode
- Validates all type definitions without emitting files
- Command: `npx tsc --noEmit`

#### 6. All Quality Checks Passed
- Final gate that requires all previous jobs to succeed
- Prevents merging if any check fails

### Required Status Checks

To enforce these checks on pull requests, configure branch protection for `main`:

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Click **Add rule** or edit existing rule for `main`
3. Enable: **Require status checks to pass before merging**
4. Select all required checks:
   - ✅ Lint Code
   - ✅ Run Tests
   - ✅ Check Formatting
   - ✅ Build Application
   - ✅ TypeScript Type Check
   - ✅ All Quality Checks Passed

### Badge Status

Add this badge to your README.md:

```markdown
[![Quality Checks](https://github.com/alexthemitchell/rad.io/actions/workflows/quality-checks.yml/badge.svg)](https://github.com/alexthemitchell/rad.io/actions/workflows/quality-checks.yml)
```

### Local Development

Before creating a pull request, run these commands locally to ensure all checks will pass:

```bash
# Install dependencies (first time only)
npm install

# Format code
npm run format

# Check formatting
npm run format:check

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build
npm run build
```

### Workflow Configuration

- **Node.js Version**: 20 (LTS)
- **Package Manager**: npm with cache enabled
- **Install Command**: `npm ci` (clean install for reproducible builds)
- **Timeout**: Default (360 minutes)

### Artifacts

- **Build Output**: Uploaded from `dist/` directory, retained for 7 days
- **Coverage Reports**: Uploaded to Codecov if token is configured

### Secrets Required

- `CODECOV_TOKEN` (optional): For uploading coverage reports to Codecov

### Troubleshooting

**Build fails with "Module not found"**
- Ensure all dependencies are listed in `package.json`
- Run `npm install` locally to verify

**Tests fail in CI but pass locally**
- Check for environment-specific code
- Verify test isolation (no shared state between tests)

**Formatting check fails**
- Run `npm run format` to auto-fix
- Commit the formatted files

**Linting fails**
- Run `npm run lint:fix` to auto-fix where possible
- Manually fix remaining issues

**Type check fails**
- Run `npm run type-check` locally
- Fix TypeScript errors in source files

### Performance

Average workflow runtime: **2-4 minutes**

- Lint: ~30 seconds
- Test: ~45 seconds  
- Format: ~20 seconds
- Build: ~60 seconds
- Type Check: ~30 seconds

Jobs run in parallel for faster feedback.
