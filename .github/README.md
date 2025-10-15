# GitHub Configuration

This directory contains GitHub-specific configuration files, workflows, and documentation for the rad.io repository.

## GitHub Copilot Instructions

The repository is fully configured with GitHub Copilot coding agent instructions following [best practices](https://gh.io/copilot-coding-agent-tips).

### Main Documentation

📚 **[Copilot Instructions](copilot-instructions.md)** (467 lines)  
Comprehensive project guide covering:
- Project overview and architecture
- Directory structure and key files
- Development workflows and commands
- Testing strategy (122+ tests)
- Code style and best practices
- Common issues and solutions

🚀 **[Copilot Setup Steps](workflows/copilot-setup-steps.md)** (314 lines)  
Essential setup guide for agents including:
- Environment preparation
- Code quality tools
- Testing strategy and memory management
- Common issues and quick reference

✅ **[Setup Validation](COPILOT_SETUP_VALIDATION.md)**  
Validation document confirming the Copilot instructions are complete and follow all best practices.

## Workflows

### Quality Checks
**File**: `workflows/quality-checks.yml`

Automated CI/CD pipeline that runs on all pull requests:
- ✅ ESLint validation
- ✅ Prettier formatting check
- ✅ TypeScript type checking
- ✅ Jest test suite (122+ tests)
- ✅ Webpack build verification

### Copilot Setup Steps
**File**: `workflows/copilot-setup-steps.yml`

Workflow that prepares the environment for GitHub Copilot agents:
- Installs Node.js dependencies
- Sets up required runtimes
- Primes Serena dependencies
- Runs when setup files are modified

See [workflows/README.md](workflows/README.md) for detailed workflow documentation.

## Custom Agents

### Self-Assessment Agent
**Directory**: `agents/`

Automated quality assurance agent that:
- Verifies code quality (ESLint, Prettier, TypeScript)
- Validates build success
- Runs tests with coverage analysis
- Generates improvement suggestions
- Creates detailed markdown reports

**Usage**:
```bash
npm run self-assess
```

**Output**: Reports saved to `.serena/memories/`

See [agents/README.md](agents/README.md) for complete agent documentation.

## Branch Protection

**File**: `BRANCH_PROTECTION.md`

Documents branch protection rules and policies for the repository.

## Quick Reference

### For GitHub Copilot Agents

When working on this repository, start here:

1. 📖 Read **[copilot-instructions.md](copilot-instructions.md)** for project overview
2. 🚀 Follow **[workflows/copilot-setup-steps.md](workflows/copilot-setup-steps.md)** for setup
3. 🧪 Run quality checks: `npm run lint && npm run type-check && npm run build`
4. ✅ Run tests: `npm run test:unit` (for unit tests) or `npm test` (full suite)

### For Contributors

1. Read the main [README.md](../README.md) in the project root
2. Review [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
3. Check [ARCHITECTURE.md](../ARCHITECTURE.md) for technical details
4. Follow the quality gates defined in `workflows/quality-checks.yml`

## File Structure

```
.github/
├── README.md                          # This file
├── copilot-instructions.md            # Main Copilot instructions
├── COPILOT_SETUP_VALIDATION.md        # Setup validation document
├── BRANCH_PROTECTION.md               # Branch protection rules
├── workflows/
│   ├── README.md                      # Workflow documentation
│   ├── quality-checks.yml             # CI/CD quality pipeline
│   ├── copilot-setup-steps.yml        # Copilot setup workflow
│   └── copilot-setup-steps.md         # Setup documentation
└── agents/
    ├── README.md                      # Agent system documentation
    ├── self-assessment.yml            # Self-assessment configuration
    ├── self-assessment.js             # Self-assessment implementation
    ├── QUICK_REFERENCE.md             # Quick reference guide
    └── EXAMPLE_REPORT.md              # Example assessment report
```

## Quality Standards

All code contributions must pass:
- ✅ **Linting**: `npm run lint`
- ✅ **Formatting**: `npm run format:check`
- ✅ **Type Checking**: `npm run type-check`
- ✅ **Tests**: `npm test`
- ✅ **Build**: `npm run build`

Run all checks together: `npm run validate`

## Documentation Updates

When updating documentation in this directory:

1. Ensure markdown files are properly formatted
2. Update this README if adding new files
3. Keep internal links functional
4. Test any code examples provided
5. Update validation date in `COPILOT_SETUP_VALIDATION.md` if making structural changes

## Support

For questions about:
- **Copilot Instructions**: Review `copilot-instructions.md`
- **Setup Issues**: Check `workflows/copilot-setup-steps.md`
- **Quality Checks**: See `workflows/README.md`
- **Custom Agents**: Refer to `agents/README.md`
- **General Project**: See main `README.md` in project root

---

**Last Updated**: October 15, 2025  
**Copilot Setup Status**: ✅ Complete and Validated
