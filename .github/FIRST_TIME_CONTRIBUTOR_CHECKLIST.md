# First-Time Contributor Checklist

Welcome! This checklist will guide you through making your first contribution to rad.io.

## Before You Start

- [ ] Read the [README.md](../README.md) to understand what rad.io does
- [ ] Review the [Code of Conduct](../CODE_OF_CONDUCT.md) - we're a respectful community
- [ ] Check out the [Community Guidelines](../COMMUNITY.md) to understand how we work

## Setting Up Your Environment

### 1. Fork and Clone

- [ ] Fork the repository on GitHub (click "Fork" button)
- [ ] Clone your fork locally:

  ```bash
  git clone https://github.com/YOUR_USERNAME/rad.io.git
  cd rad.io
  ```

- [ ] Add upstream remote:

  ```bash
  git remote add upstream https://github.com/alexthemitchell/rad.io.git
  ```

### 2. Install Dependencies

- [ ] Ensure you have Node.js 18+ installed
- [ ] Install dependencies:

  ```bash
  npm install
  ```

- [ ] Verify installation:

  ```bash
  npm run validate
  ```

### 3. Explore the Project

- [ ] Start the development server:

  ```bash
  npm start
  ```

- [ ] Visit https://localhost:8080 and explore the app

  > **Note:** HTTPS is required for WebUSB functionality. The development server uses a self-signed certificate; you will need to accept this certificate in your browser to access the site and use WebUSB features.

- [ ] Open Monitor: https://localhost:8080/monitor (use `?mockSdr=1` for simulated mode)
- [ ] Run tests to see everything works:

  ```bash
  npm test
  ```

## Finding Something to Work On

- [ ] Browse [good first issue](https://github.com/alexthemitchell/rad.io/labels/good%20first%20issue) labels
- [ ] Check [help wanted](https://github.com/alexthemitchell/rad.io/labels/help%20wanted) issues
- [ ] Look for issues labeled `documentation` if you prefer starting there
- [ ] Ask in [Discussions](https://github.com/alexthemitchell/rad.io/discussions) if you need guidance

### Good First Contributions

**Easy wins for first-time contributors:**

- Fix typos in documentation
- Improve code comments
- Add examples to guides
- Fix simple bugs
- Write tests for existing code
- Improve error messages

## Making Your Changes

### 1. Create a Branch

- [ ] Update main branch:

  ```bash
  git checkout main
  git pull upstream main
  ```

- [ ] Create a feature branch:

  ```bash
  git checkout -b feature/your-feature-name
  ```

### 2. Make Your Changes

- [ ] Follow the code style (linter will help)
- [ ] Add tests if adding/changing functionality
- [ ] Update documentation if needed
- [ ] Keep commits focused and logical

### 3. Test Your Changes

- [ ] Run linting:

  ```bash
  npm run lint
  npm run lint:fix  # Auto-fix issues
  ```

- [ ] Run type checking:

  ```bash
  npm run type-check
  ```

- [ ] Run tests:

  ```bash
  npm test
  ```

- [ ] Test in browser manually
- [ ] Run full validation:

  ```bash
  npm run validate
  ```

### 4. Commit Your Changes

- [ ] Stage your changes:

  ```bash
  git add .
  ```

- [ ] Commit with a clear message:

  ```bash
  git commit -m "feat: add new feature X"
  ```

- [ ] Follow [Conventional Commits](https://www.conventionalcommits.org/) format
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `test:` for tests
  - `refactor:` for refactoring
  - `chore:` for maintenance

## Submitting Your Pull Request

### 1. Push to GitHub

- [ ] Push your branch:

  ```bash
  git push origin feature/your-feature-name
  ```

### 2. Create Pull Request

- [ ] Go to your fork on GitHub
- [ ] Click "Pull Request" button
- [ ] Fill out the PR template completely
- [ ] Link related issues (use "Fixes #123")
- [ ] Add screenshots if relevant
- [ ] Mark as draft if still working on it

### 3. PR Checklist

Before submitting, verify:

- [ ] Code follows style guidelines
- [ ] Tests added for new functionality
- [ ] All tests pass locally
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Build succeeds
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No console.log statements (use console.info/warn/error)
- [ ] Accessibility considered (if UI changes)

### 4. Add Yourself to Contributors

- [ ] Edit [CONTRIBUTORS.md](../CONTRIBUTORS.md)
- [ ] Add your name, GitHub link, and contribution
- [ ] Include this in your PR

## During Review

### 1. Engage with Reviewers

- [ ] Respond to comments promptly
- [ ] Ask questions if feedback is unclear
- [ ] Make requested changes
- [ ] Mark conversations as resolved when done
- [ ] Thank reviewers for their time

### 2. Making Changes

- [ ] Make additional commits on the same branch
- [ ] Push updates:

  ```bash
  git add .
  git commit -m "fix: address review comments"
  git push origin feature/your-feature-name
  ```

- [ ] Re-request review if needed

### 3. Staying Up to Date

If main branch updates while your PR is open:

- [ ] Fetch upstream changes:

  ```bash
  git fetch upstream
  git merge upstream/main
  ```

- [ ] Resolve any conflicts
- [ ] Push updated branch

## After Your PR is Merged

### 1. Celebrate! 🎉

- [ ] Your contribution is now part of rad.io!
- [ ] You're listed in CONTRIBUTORS.md
- [ ] You're part of the community

### 2. Clean Up

- [ ] Delete your feature branch:

  ```bash
  git branch -d feature/your-feature-name
  git push origin --delete feature/your-feature-name
  ```

- [ ] Update your fork:

  ```bash
  git checkout main
  git pull upstream main
  git push origin main
  ```

### 3. What's Next?

- [ ] Look for another issue to tackle
- [ ] Help others in Discussions
- [ ] Review other contributors' PRs
- [ ] Suggest improvements
- [ ] Become a regular contributor!

## Common Issues and Solutions

### Tests Failing

**Problem**: Tests pass locally but fail in CI

- **Solution**: Run full test suite with `npm test` (not watch mode)
- **Solution**: Check if you're using consistent Node.js version

### Linting Errors

**Problem**: Linting fails

- **Solution**: Run `npm run lint:fix` to auto-fix most issues
- **Solution**: Check ESLint output for specific issues

### Merge Conflicts

**Problem**: PR has conflicts with main

- **Solution**: Merge latest main into your branch
- **Solution**: Ask for help in PR comments if stuck

### Build Failing

**Problem**: Webpack build fails

- **Solution**: Delete `node_modules` and `dist`, run `npm install` again
- **Solution**: Check Node.js version (need 18+)

## Getting Help

### Stuck or Confused?

- **Ask in your PR**: Maintainers are happy to help
- **GitHub Discussions**: Great for general questions
- **Documentation**: Check [docs/ONBOARDING.md](../docs/ONBOARDING.md)
- **Issues**: Comment on the issue you're working on

### Need Guidance?

- We're here to help newcomers!
- No question is too small
- We all started somewhere
- Be patient with yourself

## Resources

### Essential Reading

- [Contributing Guide](../CONTRIBUTING.md) - Detailed contribution guidelines
- [Onboarding Guide](../docs/ONBOARDING.md) - Technical onboarding
- [Architecture](../ARCHITECTURE.md) - System design

### Learning Resources

- [Git Tutorial](https://git-scm.com/book/en/v2)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React Documentation](https://react.dev/)
- [First Timers Only](https://www.firsttimersonly.com/)

## Tips for Success

### Do's ✅

- **Start small** - Pick an easy first issue
- **Ask questions** - We're here to help
- **Test thoroughly** - Run all checks before submitting
- **Be patient** - Reviews take time
- **Learn from feedback** - Every comment helps you improve
- **Have fun** - Contributing should be enjoyable!

### Don'ts ❌

- **Don't skip tests** - They catch bugs early
- **Don't ignore linting** - Code style matters
- **Don't be afraid to ask** - Confusion is normal
- **Don't give up** - First PR is always hardest
- **Don't work on large features first** - Start small
- **Don't skip documentation** - Future you will thank you

## Acknowledgments

Thank you for contributing to rad.io! Your efforts help make this project better for everyone.

Every contribution matters, whether it's code, documentation, bug reports, or helping others. Welcome to the community!

---

**Questions?** Open a [Discussion](https://github.com/alexthemitchell/rad.io/discussions) or ask in your PR!

_Last updated: 2025-10-30_
