# Accessibility Testing Guide for Contributors

This guide provides step-by-step procedures for testing accessibility in rad.io. Following these guidelines ensures all users can access and use the application effectively.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Automated Testing](#automated-testing)
3. [Manual Testing](#manual-testing)
4. [Screen Reader Testing](#screen-reader-testing)
5. [Keyboard Navigation Testing](#keyboard-navigation-testing)
6. [Visual Accessibility Testing](#visual-accessibility-testing)
7. [Testing Checklist](#testing-checklist)
8. [Tools and Resources](#tools-and-resources)

## Quick Start

Before submitting a PR with UI changes, run these essential tests:

```bash
# 1. Run automated accessibility tests
npm test -- --testPathPatterns="Accessibility"

# 2. Run linter (includes 25+ jsx-a11y rules)
npm run lint

# 3. Build the application
npm run build

# 4. Manual keyboard navigation test (see section below)
```

## Automated Testing

### Unit Tests with jest-axe

Our project includes comprehensive automated accessibility tests using axe-core.

**Run all accessibility tests:**

```bash
npm test -- --testPathPatterns="Accessibility"
```

**Run specific test suites:**

```bash
# Axe-core automated scans (15 tests)
npm test -- src/components/__tests__/AxeAccessibility.test.tsx

# Manual ARIA/keyboard tests (21 tests)
npm test -- src/components/__tests__/Accessibility.test.tsx
```

**What these tests check:**

- ARIA attribute validity and correctness
- Semantic HTML structure
- Color contrast ratios
- Form label associations
- Keyboard focusability
- Heading hierarchy
- Image alternative text
- Interactive element accessibility

**Expected output:**

```
Test Suites: 2 passed, 2 total
Tests:       36 passed, 36 total
```

All tests must pass before merging.

### Linting with ESLint

ESLint enforces 25+ jsx-a11y rules automatically:

```bash
npm run lint
```

**Common issues caught by linter:**

- Missing `alt` text on images
- Missing labels on form controls
- Non-interactive elements with click handlers
- Invalid ARIA attributes
- Keyboard event handlers without focus handlers

**Fix issues automatically (when possible):**

```bash
npm run lint:fix
```

### End-to-End Tests with Playwright

E2E accessibility tests verify full-page accessibility:

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI (for debugging)
npm run test:e2e:ui
```

E2E tests check:

- Navigation between pages
- Focus management across routes
- ARIA live region announcements
- Keyboard shortcuts functionality
- Form submission flows

## Manual Testing

Automated tests catch many issues, but manual testing is essential for complex interactions.

### Keyboard Navigation Testing

**Test without a mouse** to verify all functionality is accessible via keyboard.

#### Step-by-Step Procedure

1. **Open the application**
2. **Tab through all interactive elements:**
   - Press `Tab` repeatedly
   - Verify focus indicator is clearly visible
   - Verify tab order follows visual layout (top→bottom, left→right)
3. **Test interactive elements:**
   - `Enter` or `Space` activates buttons
   - Arrow keys adjust sliders and frequency inputs
   - `Escape` closes modals/dialogs
4. **Test the skip link:**
   - Press `Tab` immediately on page load
   - First element focused should be "Skip to main content"
   - Press `Enter` to verify it jumps to main content
5. **Test keyboard shortcuts:**
   - Press `?` to open shortcuts overlay
   - Test frequency adjustment: `↑` `↓` `Page Up` `Page Down`
   - Test navigation: `1` `2` `3` `4` `5` for main sections

#### Common Issues to Check

- ❌ **Keyboard trap**: Can you navigate away from modals/popups?
- ❌ **Invisible focus**: Can you always see where focus is?
- ❌ **Illogical order**: Does tab order make sense?
- ❌ **Mouse-only**: Are any features only accessible with mouse?

#### Expected Behavior

✅ All interactive elements focusable  
✅ Clear focus indicators (3px solid cyan ring)  
✅ Logical tab order matching visual layout  
✅ No keyboard traps  
✅ All features accessible without mouse

### Form Accessibility Testing

For any new forms or inputs:

1. **Label Association:**
   - Click labels to verify they focus corresponding inputs
   - Screen readers should announce label when input focused

2. **Error Handling:**
   - Trigger validation errors
   - Verify error messages are associated with inputs (`aria-describedby`)
   - Verify errors are announced to screen readers

3. **Required Fields:**
   - Verify required fields marked with `aria-required="true"`
   - Verify visual indicator (not color-only)

4. **Help Text:**
   - Verify hint text associated via `aria-describedby`
   - Verify hint text visible or accessible to screen readers

Example test:

```tsx
// In component test file
test('frequency input is properly labeled', () => {
  const { getByLabelText } = render(<FrequencyDisplay />);
  const input = getByLabelText(/center frequency/i);
  
  expect(input).toBeInTheDocument();
  expect(input).toHaveAttribute('aria-describedby');
});
```

### Dialog/Modal Accessibility Testing

When adding or modifying dialogs:

1. **Focus Management:**
   - Focus should move into dialog when opened
   - Focus should be trapped within dialog
   - Focus should return to trigger element when closed

2. **Escape Key:**
   - `Escape` key should close dialog
   - Verify focus returns correctly

3. **ARIA Attributes:**
   - Dialog has `role="dialog"` or `role="alertdialog"`
   - Dialog has `aria-labelledby` (title) or `aria-label`
   - Dialog container has `aria-modal="true"`

4. **Backdrop Click:**
   - Clicking backdrop should close dialog (optional)
   - Verify focus returns correctly

## Screen Reader Testing

Screen reader testing ensures content is properly announced to blind users.

### Recommended Screen Readers

| Platform | Screen Reader | Cost | Download |
|----------|--------------|------|----------|
| Windows | NVDA | Free | https://www.nvaccess.org/ |
| Windows | JAWS | Paid | https://www.freedomscientific.com/ |
| macOS | VoiceOver | Free (built-in) | Cmd+F5 to enable |
| Linux | Orca | Free | Pre-installed on most distros |

### NVDA Testing (Windows)

1. **Install NVDA** from https://www.nvaccess.org/
2. **Start NVDA** (Ctrl+Alt+N)
3. **Navigate the application:**
   - Use `Tab` to move between interactive elements
   - Use arrow keys to read content
   - Use `H` to jump between headings
   - Use `B` to jump between buttons
4. **Listen for announcements:**
   - Are all buttons and links announced clearly?
   - Are all form labels announced?
   - Are all images described?
   - Are status updates announced via live regions?

**Key NVDA Commands:**

- `Ctrl+Alt+N`: Start/stop NVDA
- `NVDA+Q`: Quit NVDA
- `NVDA+T`: Read current title
- `NVDA+B`: Read current control
- `Insert+↓`: Start say all
- `Ctrl`: Stop speech

### VoiceOver Testing (macOS)

1. **Enable VoiceOver**: Cmd+F5
2. **Navigate the application:**
   - Use `VO+→` to move forward (VO = Ctrl+Option)
   - Use `VO+←` to move backward
   - Use `VO+H` for help
3. **Test the rotor:**
   - Press `VO+U` to open rotor
   - Navigate by headings, links, form controls
4. **Disable VoiceOver**: Cmd+F5

**Key VoiceOver Commands:**

- `VO` = `Ctrl+Option`
- `VO+H`: Help
- `VO+A`: Start reading
- `VO+U`: Open rotor
- `VO+→/←`: Navigate
- `VO+Space`: Activate

### What to Listen For

✅ **Clear announcements**: Role, name, and state announced  
✅ **Logical order**: Content announced in meaningful sequence  
✅ **Status updates**: Changes announced via live regions  
✅ **Error messages**: Validation errors announced  
✅ **Visualizations**: Canvas elements describe data (not just "image")

❌ **Silent elements**: Interactive elements with no announcement  
❌ **Confusing labels**: Generic labels like "button" or "image"  
❌ **Missing updates**: State changes not announced  
❌ **Verbose announcements**: Overly long or repeated information

## Keyboard Navigation Testing

### Standard Keyboard Patterns

| Element | Keys | Expected Behavior |
|---------|------|-------------------|
| Button | `Enter` or `Space` | Activates button |
| Link | `Enter` | Follows link |
| Checkbox | `Space` | Toggles checked state |
| Radio | Arrow keys | Selects option in group |
| Slider | Arrow keys | Adjusts value |
| Tab list | Arrow keys | Changes active tab |
| Menu | Arrow keys, `Enter`, `Escape` | Navigate, select, close |
| Dialog | `Escape` | Closes dialog |

### Application-Specific Shortcuts

Test all keyboard shortcuts documented in ShortcutsOverlay (`?` key):

**Global Shortcuts:**

- `?`: Open keyboard shortcuts help
- `1-5`: Navigate to main sections (Monitor, Scanner, Decode, Analysis, Recordings)

**Frequency Control:**

- `↑/↓`: Fine frequency adjustment
- `Page Up/Down`: Coarse frequency adjustment
- `[/]`: Cycle step sizes

**Visualization:**

- `+/-`: Zoom in/out
- `0`: Reset zoom
- Arrow keys: Pan visualization

### Testing Procedure

1. Open the application
2. Press each shortcut key
3. Verify expected action occurs
4. Verify focus remains visible
5. Verify shortcut doesn't conflict with browser shortcuts

## Visual Accessibility Testing

### Color Contrast Testing

**Automated Testing:**

Our tests verify WCAG AA contrast requirements (4.5:1 for text, 3:1 for UI):

```bash
npm test -- --testPathPatterns="Accessibility"
```

**Manual Verification:**

Use browser DevTools to check specific elements:

1. Open Chrome DevTools
2. Inspect element
3. Look for contrast ratio in color picker
4. Verify ratio meets requirements

**Online Tools:**

- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Colour Contrast Analyser**: https://www.tpgi.com/color-contrast-checker/

### Browser Zoom Testing

Test at 200% browser zoom (WCAG requirement):

1. Open the application in Chrome/Edge
2. Press `Ctrl/Cmd + Plus (+)` repeatedly until 200%
3. Verify:
   - ✅ No horizontal scrolling required
   - ✅ Text remains readable
   - ✅ Controls remain accessible
   - ✅ Layout doesn't break
   - ✅ Focus indicators still visible

### Color Blindness Simulation

Test with color vision deficiency simulation:

**Browser Extensions:**

- Chrome: "Colorblindly" extension
- Firefox: Built-in accessibility simulator (DevTools → Accessibility)

**What to Test:**

1. Enable color blindness simulation (protanopia, deuteranopia, tritanopia)
2. Navigate the application
3. Verify:
   - ✅ Information not conveyed by color alone
   - ✅ Status indicators use icons + color
   - ✅ Charts/graphs use patterns or labels
   - ✅ Error states use text + color

### High Contrast Mode Testing

**Windows High Contrast:**

1. Press `Alt+Shift+Print Screen` to enable
2. Navigate the application
3. Verify UI remains functional and readable

**macOS Increased Contrast:**

1. System Preferences → Accessibility → Display
2. Enable "Increase contrast"
3. Test application

### Reduced Motion Testing

Test `prefers-reduced-motion` support:

**Enable Reduced Motion:**

- **macOS**: System Preferences → Accessibility → Display → Reduce motion
- **Windows**: Settings → Ease of Access → Display → Show animations
- **Linux**: Varies by desktop environment

**What to Verify:**

1. Enable reduced motion in OS settings
2. Navigate the application
3. Verify:
   - ✅ Animations disabled or minimal
   - ✅ Transitions instant or very fast
   - ✅ Functionality still works
   - ✅ No layout shifts

## Testing Checklist

Use this checklist before submitting PRs with UI changes:

### Automated Tests

- [ ] All accessibility tests pass (`npm test -- --testPathPatterns="Accessibility"`)
- [ ] ESLint passes (`npm run lint`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] No console errors or warnings

### Keyboard Navigation

- [ ] All interactive elements focusable
- [ ] Focus indicators clearly visible (3px cyan ring)
- [ ] Logical tab order (follows visual layout)
- [ ] No keyboard traps (can navigate away from all components)
- [ ] Skip link works (first Tab on page load)
- [ ] All buttons activate with `Enter` or `Space`
- [ ] All shortcuts documented and functional

### Screen Reader

- [ ] All interactive elements have clear labels
- [ ] All images have descriptive `alt` text or `aria-label`
- [ ] All form inputs have associated labels
- [ ] Live regions announce dynamic updates
- [ ] Heading hierarchy is logical (h1 → h2 → h3)
- [ ] Landmark regions properly defined
- [ ] Tested with at least one screen reader (NVDA/VoiceOver)

### Visual

- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Information not conveyed by color alone
- [ ] Layout works at 200% browser zoom
- [ ] Text scales without loss of functionality
- [ ] Focus indicators visible in high contrast mode
- [ ] Tested with color blindness simulation

### Forms (if applicable)

- [ ] All inputs have associated labels
- [ ] Required fields marked with `aria-required`
- [ ] Error messages associated with inputs (`aria-describedby`)
- [ ] Help text associated with inputs
- [ ] Validation errors announced to screen readers

### Dialogs/Modals (if applicable)

- [ ] Focus moves into dialog on open
- [ ] Focus trapped within dialog
- [ ] Focus returns to trigger on close
- [ ] `Escape` key closes dialog
- [ ] Dialog has proper ARIA attributes (`role`, `aria-labelledby`, `aria-modal`)

## Tools and Resources

### Testing Tools

**Browser Extensions:**

- **axe DevTools** (Chrome/Firefox): Free automated accessibility testing
- **WAVE** (Chrome/Firefox): Visual accessibility evaluation
- **Lighthouse** (Chrome): Built-in accessibility auditing
- **Colorblindly** (Chrome): Color blindness simulation

**Standalone Tools:**

- **Colour Contrast Analyser**: Desktop app for contrast checking
- **Pa11y**: Command-line accessibility testing
- **Accessibility Insights**: Microsoft's accessibility testing tools

### Screen Readers

- **NVDA** (Windows): https://www.nvaccess.org/
- **JAWS** (Windows): https://www.freedomscientific.com/
- **VoiceOver** (macOS/iOS): Built-in, Cmd+F5 to enable
- **Orca** (Linux): Pre-installed on most distros

### Learning Resources

- **WCAG 2.1 Quick Reference**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/
- **WebAIM Resources**: https://webaim.org/resources/
- **A11y Project Checklist**: https://www.a11yproject.com/checklist/
- **Inclusive Components**: https://inclusive-components.design/

### Project Documentation

- **ACCESSIBILITY.md**: Feature documentation and user guide
- **ADR-0017**: Comprehensive Accessibility Pattern Implementation
- **ADR-0023**: Continuous Accessibility Compliance and Modern Web Standards
- **UI-DESIGN-SPEC.md**: Design system and accessibility requirements

## Getting Help

If you encounter accessibility issues or have questions:

1. **Check existing tests**: Review `src/components/__tests__/Accessibility.test.tsx` for examples
2. **Review documentation**: Read ACCESSIBILITY.md and relevant ADRs
3. **Search issues**: Check GitHub issues for similar problems
4. **Ask for guidance**: Open a discussion or draft PR for feedback
5. **Label correctly**: Use "accessibility" label for related issues/PRs

## Contributing Improvements

Found a way to improve accessibility testing? We welcome contributions!

1. Add new test cases to existing test files
2. Document testing procedures in this guide
3. Share tools and techniques that worked well
4. Report false positives or testing gaps
5. Suggest process improvements

Remember: Accessibility benefits everyone, not just users with disabilities. Clear labels, logical navigation, and robust keyboard support make the application better for all users.
