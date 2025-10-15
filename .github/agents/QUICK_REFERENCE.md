# Self-Assessment Agent Quick Reference

## Quick Start

```bash
# Run self-assessment
npm run self-assess

# View latest report
cat .serena/memories/assessment-$(date +%Y-%m-%d).md

# View all reports
cat .serena/memories/index.md
```

## What It Checks

| Check | Description | Required |
|-------|-------------|----------|
| **ESLint** | Code linting and style | ✅ Yes |
| **Prettier** | Code formatting | ✅ Yes |
| **TypeScript** | Type checking | ✅ Yes |
| **Build** | Webpack compilation | ✅ Yes |
| **Tests** | Jest test execution | ✅ Yes |

## Output

- **Report Location**: `.serena/memories/assessment-YYYY-MM-DD.md`
- **Index**: `.serena/memories/index.md`
- **Exit Code**: 0 = all passed, 1 = issues found

## Priority Levels

| Priority | Icon | When to Address |
|----------|------|-----------------|
| Critical | 🔴 | Before merge |
| High | 🟡 | Soon |
| Medium | 🟢 | Consider |
| Low | ⚪ | Optional |

## Common Issues

### "Command failed: npm test"
**Cause**: Tests running out of memory  
**Solution**: Agent handles this gracefully, runs subset of tests

### "No coverage data"
**Cause**: Tests didn't run with --coverage  
**Solution**: Agent detects and handles, suggests manual run

### "Reports not saved"
**Cause**: Directory doesn't exist  
**Solution**: Agent creates `.serena/memories/` automatically

## Integration

### Pre-commit Hook
```bash
#!/bin/bash
npm run self-assess || exit 1
```

### Pre-push Hook
```bash
#!/bin/bash
npm run self-assess && git push || echo "Fix issues before pushing"
```

### CI/CD
```yaml
- name: Self-Assessment
  run: npm run self-assess
```

## Workflow Examples

### Basic Development Flow
```bash
# Make changes
vim src/components/MyComponent.tsx

# Run assessment
npm run self-assess

# Fix issues if any
npm run lint:fix
npm run format

# Verify
npm run self-assess

# Commit
git commit -m "feat: add new component"
```

### Before PR
```bash
# Run comprehensive check
npm run self-assess

# Review report
cat .serena/memories/assessment-$(date +%Y-%m-%d).md

# Address issues
npm run lint:fix
npm run format
npm test

# Create PR
git push origin feature-branch
```

## Customization

### Skip Tests
Edit `.github/agents/self-assessment.js` and modify the test check section.

### Add Custom Checks
Add new check functions in the `checks` object:

```javascript
checks: {
  async customCheck() {
    log.section('Running Custom Check...');
    // Your check logic
    return { passed: true, issues: [] };
  }
}
```

### Modify Report Format
Edit the `generateReport()` function to customize output.

## Tips

1. **Run Early**: Don't wait until the end to check quality
2. **Review Reports**: Learn from suggestions to improve coding
3. **Track Progress**: Compare reports over time in index
4. **Automate**: Add to git hooks or CI/CD pipeline
5. **Share**: Use reports in code reviews

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Script won't run | `chmod +x .github/agents/self-assessment.js` |
| No output | Check console for errors, run with `--verbose` |
| Wrong coverage | Run `npm test -- --coverage` separately |
| Old reports | Clean up `.serena/memories/` manually |

## Related Commands

```bash
# Manual quality checks
npm run lint           # Just linting
npm run format:check   # Just formatting
npm run type-check     # Just types
npm run build          # Just build
npm test               # Just tests

# Combined validation
npm run validate       # Lint + format + type-check + build

# Full assessment
npm run self-assess    # All checks + report
```

## Learn More

- **Full Documentation**: `.github/agents/README.md`
- **Example Report**: `.github/agents/EXAMPLE_REPORT.md`
- **Memory System**: `.serena/README.md`
- **Contributing**: `CONTRIBUTING.md`

---

**Last Updated**: October 2025  
**Version**: 1.0.0
