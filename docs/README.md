# rad.io Documentation

Welcome to the rad.io documentation! This documentation is organized using the [Diátaxis framework](https://diataxis.fr/) to help you find exactly what you need, whether you're learning, solving a problem, looking up details, or seeking to understand concepts.

## Documentation Structure

### 📚 [Tutorials](./tutorials/) - Learning-Oriented

**Start here if you're new to rad.io.** Step-by-step guides that teach by doing.

- [Getting Started with rad.io](./tutorials/01-getting-started.md)
- [Your First Visualization](./tutorials/02-first-visualization.md)
- [Building an FM Radio](./tutorials/03-fm-radio-receiver.md)
- [More tutorials →](./tutorials/)

**Best for**: Beginners, onboarding, learning the basics

---

### 🔧 [How-To Guides](./how-to/) - Problem-Oriented

**Need to accomplish a specific task?** Practical guides for solving real problems.

- [Add a New SDR Device](./how-to/add-new-sdr-device.md)
- [Implement a Demodulation Algorithm](./how-to/implement-demodulation.md)
- [Optimize DSP Performance](./how-to/optimize-dsp-performance.md)
- [More how-to guides →](./how-to/)

**Best for**: Developers working on specific features or fixes

---

### 📖 [Reference](./reference/) - Information-Oriented

**Looking for technical details?** Comprehensive API documentation and specifications.

- [SDR Basics](./reference/sdr-basics.md)
- [DSP Fundamentals](./reference/dsp-fundamentals.md)
- [Hardware Integration](./reference/hardware-integration.md)
- [Test Strategy](./reference/test-strategy.md)
- [More reference docs →](./reference/)

**Best for**: API lookups, technical specifications, fact-checking

---

### 💡 [Explanation](./explanation/) - Understanding-Oriented

**Want to understand the "why"?** Background, context, and design rationale.

- [SDR Architecture Overview](./explanation/sdr-architecture-overview.md)
- [WebUSB and Browser Integration](./explanation/webusb-browser-integration.md)
- [DSP Pipeline Explained](./explanation/dsp-pipeline-explained.md)
- [Architecture Decision Records](./decisions/)
- [More explanations →](./explanation/)

**Best for**: Understanding design decisions, architectural concepts, the "why"

---

## Quick Links

### For New Contributors

- 🚀 **[New Contributor Onboarding](./ONBOARDING.md)** - Get started in minutes
- 📝 **[Contributing Guide](../CONTRIBUTING.md)** - Development workflow and standards
- 🏗️ **[Architecture Overview](../ARCHITECTURE.md)** - System design and components

### For Users

- ⚡ **[Quick Start](../README.md#quick-start)** - Get up and running
- 📻 **[Usage Guide](../README.md#usage-guide)** - How to use the application
- ♿ **[Accessibility Guide](../ACCESSIBILITY.md)** - Keyboard shortcuts and screen reader support

### For Testers

- 🧪 **[Testing Documentation](./testing/)** - Comprehensive testing guide
- 🎯 **[E2E Testing](./e2e-tests.md)** - End-to-end test setup
- ✅ **[Accessibility Testing](./ACCESSIBILITY-TESTING-GUIDE.md)** - Testing for WCAG compliance

### Specialized Topics

- 🎨 **[Visualization Architecture](./VISUALIZATION_ARCHITECTURE.md)** - GPU-accelerated rendering
- 🔊 **[Audio Pipeline](./reference/audio-demodulation-pipeline.md)** - Web Audio integration
- 🚀 **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment
- 🎮 **[DSP Processing Pipeline](./dsp-processing-pipeline.md)** - Signal processing flow

## The Diátaxis Framework

This documentation follows the **Diátaxis** framework, which organizes documentation into four distinct types based on user needs:

| Type              | Purpose                   | Analogy                             |
| ----------------- | ------------------------- | ----------------------------------- |
| **Tutorials**     | Learning by doing         | Teaching a child to cook            |
| **How-To Guides** | Solving specific problems | A recipe for a specific dish        |
| **Reference**     | Technical specifications  | Encyclopedia article                |
| **Explanation**   | Understanding concepts    | A conversation about cooking theory |

### Which Section Should I Read?

**Ask yourself:**

- **"I want to learn rad.io"** → Start with [Tutorials](./tutorials/)
- **"I need to do X"** → Check [How-To Guides](./how-to/)
- **"What does this API do?"** → See [Reference](./reference/)
- **"Why was it designed this way?"** → Read [Explanation](./explanation/)

## Contributing to Documentation

We welcome documentation contributions! When adding docs:

1. **Choose the right section** based on Diátaxis principles:
   - Tutorials: Step-by-step learning for beginners
   - How-To: Task-focused guides for specific problems
   - Reference: Factual, exhaustive technical information
   - Explanation: Conceptual understanding and rationale

2. **Follow the style guide**:
   - Use clear, descriptive headings
   - Include code examples where helpful
   - Link to related documentation
   - Use inclusive, accessible language

3. **Keep docs maintainable**:
   - Avoid duplicating information
   - Link to authoritative sources
   - Update docs when code changes
   - Test code examples before committing

See [Contributing Guide](../CONTRIBUTING.md) for more details.

## Documentation Conventions

### Code Examples

All code examples are in TypeScript and should be runnable without modification (or clearly marked as pseudocode).

### Links and Cross-References

- Internal links use relative paths: `[Link](./path/to/doc.md)`
- External links open in new tabs (handled by renderer)
- Cross-reference between Diátaxis sections when helpful

### Accessibility

Documentation follows the same accessibility standards as the application:

- Descriptive link text (no "click here")
- Logical heading hierarchy (H1 → H2 → H3)
- Alt text for images
- Plain language explanations

See [Writing Accessible Docs](../CONTRIBUTING.md#writing-accessible-docs-in-this-repo) for guidelines.

## Need Help?

- 💬 **[GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)** - Ask questions
- 🐛 **[Issue Tracker](https://github.com/alexthemitchell/rad.io/issues)** - Report bugs or request features
- 📧 **[Support](../SUPPORT.md)** - Get help from the community

---

### Happy learning, building, and exploring! 📻✨
