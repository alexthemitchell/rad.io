# CI/CD Pipeline & Quality Gates

## Pipeline Overview
We use GitHub Actions for all CI checks.

| Trigger | Job | Gates |
| :--- | :--- | :--- |
| **Push** (Feature Branch) | `build-and-test` | Lint, Build, Unit Tests |
| **PR** (Target Main) | `regression-suite` | All above + Bundle Size + E2E |
| **Tag** (v*) | `release` | Build Artifacts + Publish Release |

## Quality Gates (Blocking)

### 1. The "Clean Code" Gate
- **Linting:** `eslint` must pass with zero warnings (strict mode).
- **Formatting:** `prettier --check` must pass.
- **Types:** `tsc --noEmit` must pass with `strict: true`.

### 2. The "Functionality" Gate
- **Unit Tests:** `jest` must pass (100% success).
- **Coverage:** DSP modules must have >90% coverage.

### 3. The "Performance" Gate
- **Bundle Size:** Warn if main bundle > 500KB. Fail if > 1MB.
- **Complexity:** Cyclomatic complexity check (optional).

## Automation Strategy
- **Dependabot:** Weekly updates for npm packages.
- **CodeQL:** Security scanning on main branch.
