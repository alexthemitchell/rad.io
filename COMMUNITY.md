# Community Guidelines

Welcome to the rad.io community! We're building a professional, open-source SDR visualizer together. This document outlines how we work together, communicate, and grow as a community.

## Our Mission

rad.io aims to make software-defined radio accessible through professional browser-based tools. We believe in:

- **Open Collaboration**: Everyone can contribute, regardless of experience level
- **Quality First**: We maintain high standards while supporting learning
- **Inclusive Environment**: We welcome contributors from all backgrounds
- **Practical Focus**: We prioritize features that solve real problems

## Community Channels

### GitHub Discussions

Our primary forum for community interaction:

- **💡 Ideas**: Propose new features or improvements
- **❓ Q&A**: Get help with usage, development, or contributions
- **📢 Announcements**: Stay updated on releases and major changes
- **💬 General**: Community chat, show-and-tell, off-topic

Visit: [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)

### GitHub Issues

For specific, actionable items:

- **🐛 Bug Reports**: Report problems with the application
- **✨ Feature Requests**: Request specific functionality
- **📚 Documentation**: Suggest documentation improvements
- **❓ Questions**: Technical questions (or use Discussions)

### Pull Requests

For contributing code and documentation:

- Review our [Contributing Guide](./CONTRIBUTING.md)
- Follow the PR template
- Engage with reviewers constructively
- All contributions are valued!

## Getting Started

### New to rad.io?

1. **Read the Docs**
   - [README.md](./README.md) - Project overview
   - [ONBOARDING.md](./docs/ONBOARDING.md) - Detailed onboarding guide
   - [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute

2. **Set Up Your Environment**

   ```bash
   git clone https://github.com/alexthemitchell/rad.io.git
   cd rad.io
   npm install
   npm run validate  # Run all quality checks
   npm start         # Start development server
   ```

3. **Explore the Project**
   - Browse the [docs/](./docs/) directory
   - Try the demo at `https://localhost:8080/demo`
   - Run tests: `npm test`

4. **Find Your First Issue**
   - Look for [`good first issue`](https://github.com/alexthemitchell/rad.io/labels/good%20first%20issue) labels
   - Check [`help wanted`](https://github.com/alexthemitchell/rad.io/labels/help%20wanted) issues
   - Ask in Discussions if you need guidance

### New to Open Source?

We're here to help! Here are some resources:

- [First Timers Only](https://www.firsttimersonly.com/) - Guide for new contributors
- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/) - GitHub's guide
- [Pro Git Book](https://git-scm.com/book/en/v2) - Learn Git
- Ask questions in our Discussions - we love helping newcomers!

## Communication Guidelines

### Be Respectful and Professional

- Follow our [Code of Conduct](./CODE_OF_CONDUCT.md)
- Assume positive intent
- Provide constructive feedback
- Be patient with others' learning
- Welcome diverse perspectives

### Effective Communication

**When Asking Questions:**

- Search existing issues/discussions first
- Provide context and details
- Include error messages, screenshots, or code snippets
- Describe what you've already tried

**When Providing Feedback:**

- Be specific about what works and what doesn't
- Suggest improvements, not just criticisms
- Acknowledge good work
- Focus on the code/idea, not the person

**When Reviewing PRs:**

- Review changes promptly (within a week if possible)
- Test the changes if applicable
- Provide clear, actionable feedback
- Approve when ready, or explain what needs fixing

## Contribution Pathways

There are many ways to contribute beyond code:

### 📝 Documentation

- Fix typos or unclear explanations
- Add examples or tutorials
- Improve API documentation
- Translate documentation (future)

### 🐛 Bug Fixes

- Reproduce and document bugs
- Fix issues labeled `good first issue`
- Add tests for edge cases

### ✨ Features

- Implement requested features
- Propose and build new functionality
- Add support for new SDR devices

### 🧪 Testing

- Write unit tests
- Add E2E tests
- Test with real hardware
- Report testing results

### 🎨 Design

- Improve UI/UX
- Create diagrams and visualizations
- Enhance accessibility

### 💬 Community Support

- Answer questions in Discussions
- Help others debug issues
- Review pull requests
- Mentor new contributors

## Recognition and Credit

We value all contributions! Contributors are recognized through:

### Contributors List

All contributors are listed in [CONTRIBUTORS.md](./CONTRIBUTORS.md) with their contributions.

### Git History

Your commits become part of the permanent project history.

### Release Notes

Significant contributions are highlighted in release notes.

### Badges

- First-time contributors get a 🎉 welcome in their first PR
- Regular contributors build reputation through consistent participation

## Community Meetings

### Schedule

**Monthly Community Call** (proposed)

- First Tuesday of each month, 6 PM UTC
- Open to all community members
- Agenda posted in Discussions beforehand
- Meeting notes shared afterward

### Format

1. **Welcome & Introductions** (5 min)
2. **Project Updates** (10 min)
   - Recent releases
   - Roadmap progress
3. **Community Topics** (30 min)
   - Issues discussion
   - Feature planning
   - Technical deep-dives
4. **Open Floor** (15 min)
   - Questions
   - Feedback
   - Show and tell

### Participation

- Meetings recorded and shared (if participants consent)
- Written summaries posted for those who can't attend
- Async participation via GitHub Discussions
- No attendance requirement - come when you can!

## Governance

### Decision Making

See [GOVERNANCE.md](./GOVERNANCE.md) for our governance model.

**In brief:**

- Small changes: decided by maintainers
- Significant changes: RFC process with community feedback
- All voices are heard, decisions made by consensus

### Maintainers

Maintainers review PRs, triage issues, and steward the project. Current maintainers:

- Alex Mitchell ([@alexthemitchell](https://github.com/alexthemitchell)) - Project Lead

**Becoming a Maintainer:**

- Consistent, high-quality contributions
- Active community participation
- Demonstrated understanding of the project
- Nominated by existing maintainers

## Resources

### Documentation

- [Architecture](./ARCHITECTURE.md) - System design
- [Onboarding](./docs/ONBOARDING.md) - New contributor guide
- [Testing Strategy](./docs/testing/TEST_STRATEGY.md) - Testing guide
- [Accessibility](./ACCESSIBILITY.md) - Accessibility standards

### External Resources

- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB) - Browser USB access
- [SDR Basics](./docs/reference/sdr-basics.md) - Software-defined radio primer
- [DSP Fundamentals](./docs/reference/dsp-fundamentals.md) - Signal processing

### Support

- **Questions**: [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)
- **Bugs**: [GitHub Issues](https://github.com/alexthemitchell/rad.io/issues)
- **Security**: See [SECURITY.md](./SECURITY.md)
- **Email**: alex+github@alexmitchelltech.com (maintainer contact)

## Engagement Metrics

We track community health through:

- **Issue Response Time**: Target < 3 days for initial response
- **PR Review Time**: Target < 7 days for initial review
- **Test Coverage**: Maintain > 38% coverage (see CONTRIBUTING.md)
- **Community Growth**: Monthly active contributors
- **Documentation**: Completeness and accessibility

These metrics help us improve, not pressure contributors. Community health matters more than numbers.

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Our [Code of Conduct](./CODE_OF_CONDUCT.md) outlines our expectations.

**Summary:**

- Be respectful and inclusive
- Focus on constructive collaboration
- Report violations to maintainers
- We investigate all reports promptly

## FAQ

### How do I get started contributing?

Read the [Onboarding Guide](./docs/ONBOARDING.md), pick a [`good first issue`](https://github.com/alexthemitchell/rad.io/labels/good%20first%20issue), and open a PR!

### What if I don't know much about SDR?

That's okay! Many contributions don't require SDR knowledge. Check out our [SDR Basics](./docs/reference/sdr-basics.md) guide if you want to learn.

### Can I propose major changes?

Yes! Open an issue with the `RFC` label to discuss your proposal before implementing.

### How long do reviews take?

We aim for initial review within 7 days. Complex PRs may take longer. Feel free to ping reviewers if blocked.

### What if my PR isn't perfect?

That's fine! We review iteratively. Submit your best effort and we'll help refine it.

### Can I contribute without coding?

Absolutely! Documentation, testing, design, and community support are all valuable contributions.

### Who do I contact for help?

- General questions: [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)
- Specific issues: Comment on the relevant GitHub issue
- Private concerns: alex+github@alexmitchelltech.com

## Thank You

Every contribution, no matter how small, helps rad.io grow. We appreciate your time, effort, and ideas.

Welcome to the community! 🎉

---

*This document is a living guide. Suggest improvements via PR or Discussion.*
