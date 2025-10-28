# ADR 0023: Continuous Accessibility Compliance and Modern Web Standards

## Status

Accepted

## Date

2025-10-28

## Context

WebSDR Pro (rad.io) is a professional-grade SDR visualizer serving diverse users including RF engineers, radio amateurs, researchers, emergency responders, and broadcast professionals. The application must meet WCAG 2.1 Level AA standards and follow modern web best practices to ensure universal access and professional quality.

### Current Accessibility Implementation

The project has already established strong accessibility foundations through ADR-0017 (Comprehensive Accessibility Pattern Implementation) and ADR-0018 (UX Information Architecture). Current implementation includes:

**Implemented Features:**

- Full keyboard navigation with logical focus order and visible indicators
- ARIA labels and live regions for dynamic content updates
- Semantic HTML with proper landmark regions and heading hierarchy
- Screen reader support with descriptive labels for visualizations
- Reduced motion support respecting `prefers-reduced-motion`
- Color contrast meeting WCAG AA requirements (4.5:1 text, 3:1 UI)
- Token-driven design system with OKLCH colors (src/styles/tokens.css)
- Responsive design with touch targets ≥44×44px
- 36 automated accessibility tests (jest-axe + manual ARIA/keyboard)
- ESLint enforcement of 25+ jsx-a11y rules

**Test Coverage:**

- AxeAccessibility.test.tsx: 15 axe-core automated scans
- Accessibility.test.tsx: 21 manual ARIA/keyboard tests
- Continuous Integration: All tests run on every PR
- Zero critical violations in automated testing

### Problem Statement

While the application has excellent accessibility foundations, modern web applications require:

1. **Continuous Compliance**: Ongoing monitoring and verification as features evolve
2. **Comprehensive Documentation**: Clear guidance for contributors maintaining accessibility
3. **Enhanced Testing**: E2E testing with real assistive technology patterns
4. **Modern Standards**: Alignment with latest WCAG 2.2 additions and ARIA 1.3 patterns
5. **Performance + Accessibility**: Ensuring accessibility features don't degrade UX
6. **Audit Trail**: Documented compliance for professional/enterprise adoption

## Decision

Establish a comprehensive continuous accessibility compliance program encompassing:

### 1. Multi-Layer Testing Strategy

**Automated Testing (Current + Enhanced):**

- Continue jest-axe unit testing (36 tests currently passing)
- Add Playwright E2E tests with @axe-core/playwright for full-page scans
- Add contrast ratio verification tests using computed styles
- Add keyboard navigation E2E tests simulating real user flows
- Add focus management verification across route changes
- Target: 100% component coverage, zero critical violations

**Manual Testing Protocols:**

- Quarterly screen reader testing (NVDA, JAWS, VoiceOver)
- Keyboard-only navigation testing for all new features
- Browser zoom testing (200%) for responsive breakpoints
- Color simulation testing (protanopia, deuteranopia, tritanopia)
- High contrast mode verification (Windows, macOS)

**Performance + Accessibility Monitoring:**

- Lighthouse CI integration for accessibility scores (target: 100)
- WebPageTest accessibility audits on production deploys
- Performance budget ensuring accessibility features don't regress UX

### 2. Documentation Framework

**For Contributors:**

- ACCESSIBILITY-TESTING-GUIDE.md: Step-by-step testing procedures
- Component accessibility patterns reference with code examples
- ARIA implementation checklist for new components
- Keyboard shortcut registration and documentation process

**For Users:**

- Comprehensive keyboard shortcuts reference (via ShortcutsOverlay)
- Assistive technology compatibility matrix
- Accessibility features overview in README
- Release notes highlighting accessibility improvements

**For Compliance:**

- VPAT (Voluntary Product Accessibility Template) documentation
- WCAG 2.1 AA compliance statement with verified checkpoints
- Known limitations and remediation timeline
- Third-party audit results and remediation plans

### 3. Design System Accessibility

**Token-Driven Accessibility:**

- Focus ring tokens for consistent visibility (--rad-ring, --rad-focus-ring-width)
- Color tokens meeting WCAG contrast requirements
- Motion tokens respecting prefers-reduced-motion
- Typography tokens ensuring readability (Inter UI, JetBrains Mono tabular)

**Component Library Standards:**

- All interactive components include aria-label or aria-labelledby
- All form controls have associated labels (visual or screen-reader-only)
- All buttons use semantic `<button>` elements (not div/span with onClick)
- All icons include aria-hidden="true" with adjacent text labels
- All visualizations (canvas) use role="img" with descriptive aria-label

### 4. Continuous Improvement Process

**Quarterly Reviews:**

- Audit new components for accessibility compliance
- Review and update ARIA patterns based on latest specifications
- Test with latest assistive technology versions
- Update documentation based on user feedback

**Feature Development:**

- Accessibility requirements included in all feature specs
- Accessibility review required before PR approval
- Automated tests for new interactive components
- Manual testing before release

**Incident Response:**

- Accessibility issues labeled and prioritized
- Critical issues (keyboard traps, screen reader blockers) get immediate attention
- Non-critical issues scheduled for next minor release
- All fixes include regression tests

## Consequences

### Positive

- **Inclusive Access**: All users can access application features regardless of ability
- **Legal Compliance**: Meets WCAG 2.1 AA for regulatory requirements
- **Market Expansion**: Serves broader user base including disabled RF professionals
- **Quality Indicator**: Accessibility correlates with overall code quality
- **Performance**: Token-driven design enables efficient theming and updates
- **Maintainability**: Clear patterns reduce ad-hoc accessibility fixes
- **Professional Credibility**: Demonstrates commitment to inclusive engineering

### Negative

- **Initial Effort**: Setting up enhanced testing requires ~40 hours
- **Ongoing Maintenance**: Quarterly reviews and testing add ~16 hours/quarter
- **Learning Curve**: Contributors need training on accessibility best practices
- **Tool Limitations**: Some automated tests produce false positives requiring manual verification

### Neutral

- **Documentation Overhead**: Maintaining comprehensive docs requires discipline
- **Testing Time**: E2E accessibility tests add ~2 minutes to CI pipeline
- **Tradeoffs**: Some design decisions favor accessibility over visual aesthetics

## Implementation Plan

### Phase 1: Enhanced Testing Infrastructure (Week 1-2)

1. **Add Playwright E2E Accessibility Tests:**

   ```bash
   npm install --save-dev @axe-core/playwright
   ```

   - Create e2e/accessibility/ test suite
   - Scan all primary routes (/monitor, /scanner, /decode, /analysis)
   - Verify keyboard navigation flows
   - Test focus management across route changes
   - Verify ARIA live region announcements

2. **Add Contrast Verification Tests:**
   - Create utility for extracting computed contrast ratios
   - Test all text/background combinations
   - Test all interactive element states (default, hover, focus, active)
   - Fail tests below WCAG AA thresholds

3. **Integrate Lighthouse CI:**
   - Add lighthouse-ci configuration
   - Set accessibility score threshold: 100
   - Run on all PRs and production deploys

### Phase 2: Comprehensive Documentation (Week 2-3)

1. **Create ACCESSIBILITY-TESTING-GUIDE.md:**
   - Automated testing procedures
   - Manual testing checklists
   - Screen reader testing steps
   - Keyboard navigation verification
   - Tool recommendations and setup

2. **Expand Component Patterns:**
   - Document ARIA patterns for each component type
   - Provide code examples with explanations
   - Include common pitfalls and solutions
   - Link to W3C ARIA Authoring Practices

3. **Create VPAT Documentation:**
   - Document WCAG 2.1 AA checkpoint compliance
   - List any known limitations with remediation plans
   - Include testing methodology
   - Update quarterly

### Phase 3: Continuous Monitoring (Ongoing)

1. **Quarterly Accessibility Audits:**
   - Screen reader testing (NVDA, JAWS, VoiceOver)
   - Keyboard-only navigation verification
   - Color simulation testing
   - Update VPAT with findings

2. **Release Process:**
   - Accessibility review required for all features
   - Automated tests must pass
   - Manual testing for complex interactions
   - Release notes include accessibility improvements

3. **User Feedback Loop:**
   - Accessibility issue template in GitHub
   - Priority labeling and triage
   - Response time commitments
   - Resolution tracking

## Verification and Success Criteria

### Quantitative Metrics

- **Zero** critical accessibility violations (axe-core, Lighthouse)
- **100%** component coverage in automated tests
- **100** Lighthouse accessibility score on all routes
- **≥4.5:1** contrast ratio for all text
- **≥3:1** contrast ratio for all UI components
- **≥44×44px** touch targets on mobile
- **36+** accessibility tests (currently 36, target to grow with features)

### Qualitative Metrics

- **Keyboard-only navigation**: All features accessible without mouse
- **Screen reader compatibility**: All content announced correctly
- **Focus management**: Clear visual indicators, logical tab order
- **Reduced motion**: Respect user preferences without breaking UX
- **Error handling**: Clear, actionable messages announced to assistive tech
- **Documentation**: Contributors can implement accessible components independently

### User Validation

- **Usability testing** with disabled RF professionals: ≥4/5 satisfaction score
- **Task completion**: All core workflows (tune, scan, decode, record) completable with assistive tech
- **Efficiency**: Keyboard users achieve <10% time penalty vs. mouse users
- **Error recovery**: Users can recover from errors without sighted assistance

## Related ADRs

- **ADR-0017**: Comprehensive Accessibility Pattern Implementation (foundational patterns)
- **ADR-0018**: UX Information Architecture and Page Map (navigation structure)
- **ADR-0019**: Viridis Colormap Waterfall Visualization (colorblind-safe palettes)
- **ADR-0015**: Visualization Rendering Strategy (accessible canvas rendering)
- **ADR-0006**: Testing Strategy and Framework Selection (testing infrastructure)

## References

### Standards and Guidelines

- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/ - Official Web Content Accessibility Guidelines
- **WCAG 2.2**: https://www.w3.org/WAI/WCAG22/quickref/ - Latest additions (focus appearance, dragging)
- **ARIA 1.3**: https://www.w3.org/TR/wai-aria-1.3/ - Latest ARIA specification
- **ARIA Authoring Practices Guide**: https://www.w3.org/WAI/ARIA/apg/ - Implementation patterns

### Testing Tools

- **axe-core**: https://github.com/dequelabs/axe-core - Automated accessibility testing engine
- **@axe-core/playwright**: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright - Playwright integration
- **jest-axe**: https://github.com/nickcolley/jest-axe - Jest wrapper for axe-core
- **Lighthouse**: https://developers.google.com/web/tools/lighthouse - Automated auditing
- **Pa11y**: https://pa11y.org/ - Alternative automated testing tool

### Assistive Technology

- **NVDA**: https://www.nvaccess.org/ - Free Windows screen reader
- **JAWS**: https://www.freedomscientific.com/products/software/jaws/ - Commercial Windows screen reader
- **VoiceOver**: Built into macOS and iOS - Apple's screen reader
- **Orca**: https://wiki.gnome.org/Projects/Orca - Linux screen reader

### Learning Resources

- **WebAIM**: https://webaim.org/ - Web accessibility training and resources
- **A11y Project**: https://www.a11yproject.com/ - Community-driven accessibility resources
- **Inclusive Components**: https://inclusive-components.design/ - Accessible component patterns
- **GOV.UK Design System**: https://design-system.service.gov.uk/accessibility/ - Exemplary accessibility patterns

### Project-Specific

- **ACCESSIBILITY.md**: Comprehensive accessibility feature documentation
- **src/styles/a11y.css**: Global accessibility utilities and focus styles
- **src/styles/tokens.css**: Token-driven design system with accessible colors
- **src/components/**tests**/Accessibility.test.tsx**: Manual ARIA/keyboard tests
- **src/components/**tests**/AxeAccessibility.test.tsx**: Automated axe-core tests

## Lifecycle

This ADR establishes ongoing processes and will remain **Accepted** indefinitely. Quarterly reviews may result in:

- **Minor Updates**: Adding new tools, updating procedures
- **Major Revisions**: Significant process changes trigger new ADR
- **Superseded**: Only if fundamentally new approach adopted (unlikely)

Last reviewed: 2025-10-28

Next review: 2026-01-28 (Quarterly)

## Appendix: WCAG 2.1 AA Compliance Checklist

### Perceivable

- ✅ 1.1.1 Non-text Content: All images, icons, visualizations have text alternatives
- ✅ 1.2.1 Audio-only and Video-only: N/A (no prerecorded media)
- ✅ 1.2.2 Captions: N/A (no video with audio)
- ✅ 1.2.3 Audio Description: N/A (no video)
- ✅ 1.2.4 Captions (Live): N/A (no live audio/video)
- ✅ 1.2.5 Audio Description: N/A (no video)
- ✅ 1.3.1 Info and Relationships: Semantic HTML, ARIA, proper heading hierarchy
- ✅ 1.3.2 Meaningful Sequence: Logical reading and navigation order
- ✅ 1.3.3 Sensory Characteristics: Instructions don't rely solely on shape/color/position
- ✅ 1.3.4 Orientation: No orientation restrictions
- ✅ 1.3.5 Identify Input Purpose: Proper autocomplete attributes on forms
- ✅ 1.4.1 Use of Color: Color not sole means of conveying information
- ✅ 1.4.2 Audio Control: User can control audio output
- ✅ 1.4.3 Contrast (Minimum): 4.5:1 text, 3:1 UI components
- ✅ 1.4.4 Resize Text: Text scales to 200% without loss of functionality
- ✅ 1.4.5 Images of Text: No images of text (using real text)
- ✅ 1.4.10 Reflow: Content reflows at 320px without horizontal scroll
- ✅ 1.4.11 Non-text Contrast: 3:1 for UI components and graphics
- ✅ 1.4.12 Text Spacing: No loss of content when spacing increased
- ✅ 1.4.13 Content on Hover/Focus: Hover/focus content dismissible, hoverable, persistent

### Operable

- ✅ 2.1.1 Keyboard: All functionality available via keyboard
- ✅ 2.1.2 No Keyboard Trap: Users can navigate away from all components
- ✅ 2.1.4 Character Key Shortcuts: Shortcuts can be turned off or remapped (via ShortcutsOverlay)
- ✅ 2.2.1 Timing Adjustable: No time limits on interactions
- ✅ 2.2.2 Pause, Stop, Hide: Auto-updating content (waterfall) can be paused
- ✅ 2.3.1 Three Flashes: No flashing content >3 times per second
- ✅ 2.4.1 Bypass Blocks: Skip link provided
- ✅ 2.4.2 Page Titled: Descriptive page title
- ✅ 2.4.3 Focus Order: Logical tab order
- ✅ 2.4.4 Link Purpose: Link text describes destination
- ✅ 2.4.5 Multiple Ways: Multiple navigation paths available
- ✅ 2.4.6 Headings and Labels: Descriptive headings and labels
- ✅ 2.4.7 Focus Visible: Clear focus indicators on all interactive elements
- ✅ 2.5.1 Pointer Gestures: No multipoint or path-based gestures required
- ✅ 2.5.2 Pointer Cancellation: Activation on up-event, cancelable
- ✅ 2.5.3 Label in Name: Accessible name contains visible label text
- ✅ 2.5.4 Motion Actuation: No motion-based input required

### Understandable

- ✅ 3.1.1 Language of Page: HTML lang attribute set
- ✅ 3.1.2 Language of Parts: Language changes marked (if applicable)
- ✅ 3.2.1 On Focus: Focus doesn't trigger unexpected changes
- ✅ 3.2.2 On Input: Input doesn't trigger unexpected changes
- ✅ 3.2.3 Consistent Navigation: Navigation consistent across pages
- ✅ 3.2.4 Consistent Identification: Components identified consistently
- ✅ 3.3.1 Error Identification: Errors clearly identified
- ✅ 3.3.2 Labels or Instructions: Form inputs have clear labels
- ✅ 3.3.3 Error Suggestion: Error messages suggest corrections
- ✅ 3.3.4 Error Prevention: Confirmation for destructive actions

### Robust

- ✅ 4.1.1 Parsing: Valid HTML (automated testing)
- ✅ 4.1.2 Name, Role, Value: Custom components have proper ARIA
- ✅ 4.1.3 Status Messages: ARIA live regions for status updates

**Note**: This checklist reflects current implementation as of 2025-10-28. Quarterly reviews will verify continued compliance as features evolve.
