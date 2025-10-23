# Accessibility Review Checklist

Use this checklist when reviewing pull requests to ensure accessibility standards are maintained.

## Automated Checks

Before manual review, verify these automated checks pass:

- [ ] **ESLint**: All jsx-a11y rules pass (`npm run lint`)
- [ ] **Jest Tests**: All accessibility tests pass (`npm test`)
- [ ] **Axe-core**: All automated accessibility scans pass
- [ ] **Build**: Application builds without errors (`npm run build`)

## Code Review

### Semantic HTML

- [ ] Uses appropriate semantic elements (`<button>`, `<nav>`, `<main>`, `<section>`, etc.)
- [ ] No `<div>` or `<span>` used where semantic element is more appropriate
- [ ] Heading hierarchy is logical (no skipped levels)
- [ ] Form inputs have associated labels (via `htmlFor` or wrapping)

### ARIA Attributes

- [ ] ARIA labels present on non-text interactive elements
- [ ] `aria-label` text is descriptive and concise
- [ ] `aria-pressed` used for toggle buttons (not `aria-selected`)
- [ ] `aria-live` regions used for dynamic status updates
- [ ] `role` attributes are appropriate (don't override semantic HTML)
- [ ] No invalid ARIA attributes or values

### Keyboard Navigation

- [ ] All interactive elements are keyboard accessible
- [ ] `tabIndex` is 0 or omitted (never positive numbers)
- [ ] Focus order is logical (follows visual layout)
- [ ] Focus is visible on all focusable elements
- [ ] Enter/Space activate buttons and controls
- [ ] Arrow keys work for appropriate controls (radio groups, sliders)
- [ ] Escape key closes modals/dialogs (if applicable)
- [ ] No keyboard traps (can always navigate away)

### Visual Design

- [ ] Color contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- [ ] Focus indicators are clearly visible (minimum 3px)
- [ ] Touch targets are minimum 44x44px on mobile
- [ ] Layout doesn't break at 200% browser zoom
- [ ] Information isn't conveyed by color alone

### Dynamic Content

- [ ] Live regions announce important changes
- [ ] Error messages are announced to screen readers
- [ ] Loading states have accessible announcements
- [ ] Dynamic content updates don't cause focus loss

### Images and Media

- [ ] Images have meaningful `alt` text
- [ ] Decorative images have `alt=""` or `aria-hidden="true"`
- [ ] Icons have text labels or `aria-label`
- [ ] Canvas visualizations have descriptive `aria-label`

## Manual Testing

### Keyboard-Only Testing

- [ ] Navigate entire feature using only keyboard
- [ ] Verify Tab/Shift+Tab work correctly
- [ ] Activate all buttons with Enter/Space
- [ ] Test any custom keyboard shortcuts
- [ ] Confirm no focus is lost or trapped

### Screen Reader Testing (Recommended)

If PR includes significant UI changes, test with a screen reader:

- [ ] **Windows**: NVDA (free) or JAWS
- [ ] **macOS**: VoiceOver (built-in, Cmd+F5)
- [ ] **Linux**: Orca

Verify:

- [ ] All content is announced
- [ ] Navigation makes sense when using screen reader
- [ ] Interactive elements clearly indicate their purpose
- [ ] State changes are announced (loading, errors, etc.)

### Browser Zoom Testing

- [ ] Test at 100%, 150%, and 200% zoom
- [ ] No horizontal scrolling required
- [ ] All text remains readable
- [ ] Controls remain accessible
- [ ] Layout doesn't break or overlap

## Component-Specific Checks

### New Buttons

- [ ] Uses `<button>` element (not `<div>` or `<a>`)
- [ ] Has descriptive `aria-label` if no visible text
- [ ] Toggle buttons use `aria-pressed`
- [ ] Disabled state is clear (visual + `disabled` attribute)

### New Form Inputs

- [ ] Has associated `<label>` element
- [ ] `aria-label` or `aria-labelledby` if no visible label
- [ ] Error messages linked via `aria-describedby`
- [ ] Required fields marked with `required` or `aria-required`
- [ ] Clear placeholder text (not sole label)

### New Visualizations (Canvas/SVG)

- [ ] Has `role="img"` attribute
- [ ] Descriptive `aria-label` explains what visualization shows
- [ ] Includes data ranges and key values in label
- [ ] Focusable if interactive (`tabIndex={0}`)
- [ ] Empty state has appropriate message

### New Modals/Dialogs

- [ ] Uses `role="dialog"` or `role="alertdialog"`
- [ ] Has `aria-labelledby` or `aria-label`
- [ ] Focus moves to modal on open
- [ ] Focus returns to trigger on close
- [ ] Escape key closes modal
- [ ] Focus trapped within modal when open

## Testing Commands

```bash
# Run linting
npm run lint

# Run all tests
npm test

# Run only accessibility tests
npm test -- Accessibility

# Run axe-core tests
npm test -- AxeAccessibility

# Build to verify no errors
npm run build

# Run full validation
npm run validate
```

## Common Issues and Fixes

### Issue: "Button has no accessible name"

**Fix**: Add `aria-label` or visible text content to button

```tsx
// ❌ Bad
<button><IconComponent /></button>

// ✅ Good
<button aria-label="Close dialog">
  <IconComponent aria-hidden="true" />
</button>
```

### Issue: "Form element does not have an associated label"

**Fix**: Add a `<label>` element with `htmlFor`

```tsx
// ❌ Bad
<input type="text" placeholder="Frequency" />

// ✅ Good
<label htmlFor="freq-input">Frequency (MHz)</label>
<input id="freq-input" type="text" />
```

### Issue: "Elements must have sufficient color contrast"

**Fix**: Increase contrast between text and background

```css
/* ❌ Bad - 2.5:1 contrast */
color: #999;
background: #fff;

/* ✅ Good - 4.8:1 contrast */
color: #666;
background: #fff;
```

### Issue: "Interactive element cannot be focused"

**Fix**: Ensure element is natively focusable or add `tabIndex={0}`

```tsx
// ❌ Bad - div is not focusable
<div onClick={handleClick}>Click me</div>

// ✅ Good - button is natively focusable
<button onClick={handleClick}>Click me</button>

// ✅ Also good - custom element with tabIndex
<div role="button" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown}>
  Click me
</div>
```

## Resources

- **WCAG 2.1 Quick Reference**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/
- **Project Accessibility Docs**: [ACCESSIBILITY.md](../ACCESSIBILITY.md)
- **axe DevTools Browser Extension**: https://www.deque.com/axe/devtools/

## Questions?

If you're unsure about any accessibility aspect:

1. Check [ACCESSIBILITY.md](../ACCESSIBILITY.md) for guidance
2. Run automated tests to identify specific issues
3. Ask for accessibility review in PR comments
4. Reference ARIA patterns in similar components

## Approval Criteria

For a PR to be approved:

- ✅ All automated checks pass
- ✅ Manual keyboard testing completed
- ✅ Focus indicators visible
- ✅ ARIA labels accurate and descriptive
- ✅ No new accessibility violations introduced
- ✅ Tests added for new interactive components

---

**Note**: This checklist should be used in addition to standard code review practices, not as a replacement.
