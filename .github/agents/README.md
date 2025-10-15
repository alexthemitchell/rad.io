# GitHub Copilot Agents

This directory contains custom GitHub Copilot agents that automate various development tasks and quality checks.

## Available Agents

### Self-Assessment Agent

**Purpose**: Performs comprehensive self-assessment of code changes, checking for quality, test coverage, and adherence to project standards.

**Configuration**: `self-assessment.yml`  
**Implementation**: `self-assessment.js`

**Features**:
- ✅ Code quality verification (ESLint, Prettier, TypeScript)
- ✅ Build validation
- ✅ Test execution and coverage analysis
- ✅ Constructive feedback generation
- ✅ Automated report creation
- ✅ Findings documentation in `.serena/memories`

**Usage**:

```bash
# Run self-assessment
node .github/agents/self-assessment.js

# Run with custom output location
node .github/agents/self-assessment.js --output=./custom-report.md

# Run with verbose output
node .github/agents/self-assessment.js --verbose
```

**When to Use**:
- After completing a task or feature
- Before creating a pull request
- To verify quality standards are met
- To get improvement suggestions

**Output**:
- Detailed markdown report in `.serena/memories/assessment-{date}.md`
- Summary of all quality checks (lint, format, type-check, build, tests)
- Test coverage metrics
- Categorized suggestions (critical, high, medium, low priority)
- Next steps and recommendations

## Agent System

### Overview

The agent system provides automated assistance for common development tasks:

1. **Quality Assurance**: Automated code quality verification
2. **Self-Assessment**: Post-completion validation and feedback
3. **Documentation**: Findings and suggestions tracked in `.serena/memories`

### Directory Structure

```
.github/agents/
├── README.md                    # This file
├── self-assessment.yml          # Agent configuration
└── self-assessment.js           # Implementation script

.serena/memories/
├── index.md                     # Index of all reports
└── assessment-{date}.md         # Individual assessment reports
```

### Quality Checks Performed

The self-assessment agent runs the following checks:

#### Code Quality
- **ESLint**: Validates code against linting rules
- **Prettier**: Ensures consistent code formatting  
- **TypeScript**: Verifies type safety and correctness

#### Build
- **Webpack**: Ensures application builds successfully

#### Testing
- **Jest**: Runs all 122+ unit tests
- **Coverage**: Analyzes test coverage metrics
- **Quality**: Verifies tests follow project patterns

#### Code Analysis
- Cyclomatic complexity
- Maintainability metrics
- Code duplication detection
- Best practices adherence

### Suggestion Categories

Suggestions are prioritized into four levels:

1. **Critical** (🔴): Must be addressed before merge
   - Build failures
   - Type errors
   - Failing tests
   - Linting errors

2. **High Priority** (🟡): Should be addressed soon
   - Formatting issues
   - Low test coverage
   - Security concerns

3. **Medium Priority** (🟢): Consider for improvement
   - Code complexity
   - Missing documentation
   - Performance opportunities

4. **Low Priority** (⚪): Nice to have
   - Code style improvements
   - Minor refactoring suggestions

### Report Format

Each assessment report includes:

```markdown
# Self-Assessment Report

## Summary
- Overall status
- Check results table

## Test Coverage
- Statement coverage
- Branch coverage
- Function coverage
- Line coverage

## Detailed Findings
- Code quality issues
- Build status
- Test results

## Suggestions for Improvement
- Critical issues
- High priority items
- Medium priority items
- Low priority items

## Next Steps
- Immediate actions
- Long-term improvements
```

### Integration

The self-assessment agent integrates with the existing CI/CD pipeline:

- **Pre-commit**: Optional local checks before committing
- **Pre-push**: Optional validation before pushing
- **Post-completion**: Automatic assessment after task completion
- **On-demand**: Manual execution anytime

### Memory System

The `.serena/memories` directory maintains a history of assessments:

- **Retention**: Assessments kept for 30 days, findings for 90 days
- **Index**: `index.md` provides chronological list of all reports
- **Auto-update**: Index automatically updated with each assessment
- **Searchable**: Easy to find past assessments and track improvements

### Best Practices

When using the self-assessment agent:

1. **Run Early**: Execute after significant changes to catch issues early
2. **Review Suggestions**: Carefully consider all feedback
3. **Address Critical**: Fix critical issues immediately
4. **Track Progress**: Use the index to see quality trends over time
5. **Learn**: Use suggestions to improve coding practices

### Extending the Agent

To add new checks or modify behavior:

1. Edit `self-assessment.yml` to add new check configurations
2. Update `self-assessment.js` to implement new check logic
3. Add corresponding test validation
4. Update this documentation

### Troubleshooting

**Problem**: Script fails to run

**Solution**:
```bash
# Ensure script is executable
chmod +x .github/agents/self-assessment.js

# Ensure dependencies are installed
npm ci
```

**Problem**: Coverage data not found

**Solution**:
```bash
# Run tests with coverage first
npm test -- --coverage
```

**Problem**: Report directory not created

**Solution**:
```bash
# Create directory manually
mkdir -p .serena/memories
```

## Contributing

When adding new agents:

1. Create agent configuration in `.github/agents/{agent-name}.yml`
2. Implement agent logic in `.github/agents/{agent-name}.js`
3. Add tests if applicable
4. Update this README with agent documentation
5. Follow existing patterns and conventions

## Related Documentation

- **Quality Checks**: `.github/workflows/quality-checks.yml`
- **Setup Guide**: `.github/workflows/copilot-setup-steps.md`
- **Project Guide**: `.github/copilot-instructions.md`
- **CI/CD Workflows**: `.github/workflows/README.md`

---

**Note**: The self-assessment agent complements but does not replace CI/CD quality checks. Both systems work together to ensure code quality.
