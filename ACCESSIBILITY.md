# Accessibility Documentation

This document provides a comprehensive guide to accessibility features in rad.io and how to maintain them when contributing to the project.

## Overview

rad.io is committed to providing an accessible experience for all users, including those using assistive technologies like screen readers, keyboard-only navigation, and other adaptive devices. The application follows WCAG 2.1 AA standards and implements industry best practices for web accessibility.

## Accessibility Features

### 1. Keyboard Navigation

**Full Keyboard Control**: Every interactive element in the application is keyboard accessible without requiring a mouse.

#### Keyboard Shortcuts

| Context | Key | Action |
|---------|-----|--------|
| Frequency Input | ↑ Arrow Up | Increase frequency by 0.1 MHz (FM) / 10 kHz (AM) |
| Frequency Input | ↓ Arrow Down | Decrease frequency by 0.1 MHz (FM) / 10 kHz (AM) |
| Frequency Input | Page Up | Increase frequency by 1.0 MHz (FM) / 100 kHz (AM) |
| Frequency Input | Page Down | Decrease frequency by 1.0 MHz (FM) / 100 kHz (AM) |
| All Buttons | Enter / Space | Activate button |
| All Elements | Tab | Move to next focusable element |
| All Elements | Shift+Tab | Move to previous focusable element |
| Skip Link | Tab (on page load) | Jump directly to main content |

#### Focus Management

- **Visible Focus Indicators**: All focusable elements have a clear 3px solid blue outline (`#667eea`) when focused
- **Focus Order**: Logical tab order follows visual layout from top to bottom, left to right
- **Skip to Content**: First tab stop is a skip link allowing users to bypass navigation
- **No Keyboard Traps**: Users can always navigate away from any component using standard keyboard controls

### 2. Screen Reader Support

#### ARIA Labels and Descriptions

All interactive elements and visualizations have descriptive ARIA labels:

**Canvas Visualizations**:
- `role="img"` with detailed `aria-label` describing:
  - Data type and count (e.g., "1024 signal samples")
  - Value ranges (min, max, average)
  - What the visualization represents
  - Current peak values or notable features

**Form Controls**:
- `aria-label` with context: "Center frequency in MHz. Range: 88.1 to 107.9 MHz. Current: 100.3 MHz"
- `aria-describedby` linking to hint text for keyboard shortcuts
- `aria-pressed` for toggle buttons (FM/AM/P25 selection)

**Dynamic Content**:
- Live regions with `aria-live="polite"` announce:
  - Connection status changes
  - Frequency changes
  - Signal type changes
  - Reception start/stop events
  - Error messages

#### Semantic HTML

- Proper heading hierarchy (`h1` → `h2` → `h3`)
- Semantic elements: `<main>`, `<nav>`, `<section>`, `<header>`
- Form labels properly associated with controls via `htmlFor`
- Landmark regions: `role="banner"`, `role="main"`, `role="navigation"`, `role="toolbar"`

### 3. Visual Design

#### Color Contrast

All text and interactive elements meet WCAG 2.1 AA contrast requirements:
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text**: Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

#### Focus Indicators

```css
/* Clear, visible focus indicators */
*:focus-visible {
  outline: 3px solid #667eea;
  outline-offset: 2px;
}

/* Enhanced focus for interactive elements */
button:focus-visible {
  outline: 3px solid #667eea;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}
```

#### Responsive Design

- Layout adapts from desktop to mobile (768px breakpoint)
- Touch targets are minimum 44x44px on mobile
- Text scales appropriately with browser zoom (up to 200%)

### 4. Error Handling

- Error messages are announced via live regions
- Errors are associated with form fields via `aria-describedby`
- Clear, actionable error messages guide users to resolution

## Automated Testing

### ESLint Accessibility Rules

The project enforces 25+ jsx-a11y rules via ESLint:

```javascript
// Key enforced rules (see eslint.config.mjs)
"jsx-a11y/alt-text": "error",
"jsx-a11y/aria-props": "error",
"jsx-a11y/aria-role": "error",
"jsx-a11y/click-events-have-key-events": "error",
"jsx-a11y/interactive-supports-focus": "error",
"jsx-a11y/label-has-associated-control": "error",
// ... and 19 more rules
```

Run linting locally:
```bash
npm run lint
```

### jest-axe Testing

The project includes comprehensive axe-core automated accessibility tests:

```bash
# Run all accessibility tests
npm test -- src/components/__tests__/AxeAccessibility.test.tsx

# Run specific test suite
npm test -- src/components/__tests__/Accessibility.test.tsx
```

**Coverage** (36 total accessibility-focused tests):
- 15 axe-core automated scans
- 21 manual ARIA/keyboard tests
- All major components tested
- Color contrast verification
- ARIA attribute validation
- Semantic HTML verification

### Continuous Integration

All accessibility tests run automatically on every PR via GitHub Actions:
- ESLint accessibility rules must pass
- All jest-axe tests must pass
- No new violations allowed

## Manual Testing

### Screen Reader Testing

While automated tests catch many issues, manual screen reader testing is recommended for:
- Complex interactive components
- Dynamic content updates
- Multi-step workflows

**Recommended Screen Readers**:
- **NVDA** (Windows, free): https://www.nvaccess.org/
- **JAWS** (Windows, commercial): https://www.freedomscientific.com/
- **VoiceOver** (macOS, built-in): Cmd+F5 to enable
- **Orca** (Linux, free): Pre-installed on many distros

### Keyboard-Only Testing

Before submitting PRs with UI changes:

1. **Navigate without mouse**: Use only Tab, Shift+Tab, Enter, Space, and arrow keys
2. **Verify focus visible**: Can you always see where focus is?
3. **Check focus order**: Does tab order make logical sense?
4. **Test all interactions**: Can you activate all buttons, inputs, and controls?
5. **Escape from modals**: Can you exit any modal dialogs with Escape?

### Browser Zoom Testing

Test your changes at 200% browser zoom:
1. Open app in Chrome/Edge
2. Press Ctrl+Plus (+) repeatedly until 200%
3. Verify:
   - No horizontal scrolling required
   - Text remains readable
   - Controls remain accessible
   - Layout doesn't break

## Contributing Guidelines

### Adding New Components

When adding a new component, ensure:

1. **Semantic HTML**: Use appropriate elements (`<button>`, `<input>`, `<nav>`, etc.)
2. **ARIA Labels**: Add `aria-label` or `aria-labelledby` for non-text elements
3. **Keyboard Support**: All interactions work with keyboard
4. **Focus Management**: Focusable elements have `tabIndex` and visible focus styles
5. **Tests**: Add axe-core and manual accessibility tests

Example:
```tsx
function NewComponent() {
  return (
    <button
      aria-label="Descriptive action name"
      onClick={handleClick}
      className="btn"
    >
      <IconComponent aria-hidden="true" />
      Button Text
    </button>
  );
}
```

### Testing Checklist

Before submitting a PR:

- [ ] Run `npm run lint` (no accessibility errors)
- [ ] Run `npm test` (all tests pass, including accessibility)
- [ ] Test keyboard navigation (Tab, Enter, Space, Arrows)
- [ ] Verify focus indicators visible on all interactive elements
- [ ] Test with browser zoom at 200%
- [ ] Add new tests for new interactive components
- [ ] Update ARIA labels if component behavior changes

See [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) for the full PR checklist.

## Known Limitations

### WebUSB Browser Support

WebUSB is only available in Chromium-based browsers (Chrome, Edge, Opera). Firefox and Safari do not support WebUSB.

- Users on unsupported browsers see a clear error message
- All UI remains accessible; only device connection is unavailable

### WebGL Fallbacks

Canvas visualizations use WebGL for performance but gracefully fall back to 2D canvas:
- Screen reader announcements work in all rendering modes
- ARIA labels describe data regardless of rendering method
- Focus and keyboard navigation unaffected by rendering mode

## Resources

### External References

- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/
- **MDN Accessibility**: https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **WebAIM Resources**: https://webaim.org/resources/

### Project-Specific

- **ESLint Config**: `eslint.config.mjs`
- **Accessibility Tests**: `src/components/__tests__/Accessibility.test.tsx`
- **Axe Tests**: `src/components/__tests__/AxeAccessibility.test.tsx`
- **Component Examples**: `src/components/RadioControls.tsx`, `src/components/SignalTypeSelector.tsx`

## Getting Help

If you have questions about accessibility:

1. Review this document and the test files
2. Check the ARIA Authoring Practices Guide for patterns
3. Run axe-core tests to identify specific issues
4. Open an issue with the "accessibility" label

## Version History

- **v1.0** (2025-10-23): Initial comprehensive accessibility implementation
  - Full keyboard navigation
  - ARIA labels on all components
  - 36 automated accessibility tests
  - ESLint enforcement of 25+ a11y rules
  - Screen reader support throughout
