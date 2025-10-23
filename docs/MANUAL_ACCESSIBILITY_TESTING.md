# Manual Accessibility Testing Guide

This guide provides step-by-step instructions for manually testing accessibility in rad.io using various assistive technologies and techniques.

## Table of Contents

1. [Screen Reader Testing](#screen-reader-testing)
2. [Keyboard-Only Testing](#keyboard-only-testing)
3. [Zoom and Responsive Testing](#zoom-and-responsive-testing)
4. [Color and Contrast Testing](#color-and-contrast-testing)
5. [Focus Indicator Testing](#focus-indicator-testing)
6. [Testing Checklist](#testing-checklist)

## Screen Reader Testing

### NVDA (Windows - Free)

**Setup**:

1. Download from https://www.nvaccess.org/download/
2. Install and run NVDA (Ctrl+Alt+N to start)
3. Open Chrome or Edge browser
4. Navigate to https://localhost:8080

**Testing Procedure**:

#### Initial Navigation

1. **Page Load**:
   - NVDA should announce: "rad.io, heading level 1"
   - Should hear: "Software-Defined Radio Visualizer"
   - Verify document structure is announced

2. **Skip Link** (First Tab):
   - Press Tab once
   - Should announce: "Skip to main content, link"
   - Press Enter to activate
   - Should announce: "Main, region" or similar

3. **Navigation Menu**:
   - Tab through navigation links
   - Each should announce: "Live Monitor, link" (or similar)
   - Verify all navigation items are accessible

#### Device Controls Testing

1. **Connect Button**:
   - Tab to "Connect SDR device via WebUSB" button
   - Should announce full button name and purpose
   - Should announce: "button, clickable"
   - Press Enter to activate (will prompt for device)

2. **Signal Type Selector**:
   - Tab to FM/AM/P25 buttons
   - Should announce: "FM Radio mode, currently selected, button, pressed"
   - Arrow keys should navigate between options (if implemented)
   - Each button should clearly indicate its state

3. **Frequency Input**:
   - Tab to frequency input field
   - Should announce: "Center frequency in MHz, Range: 88.1 to 107.9 MHz, Current: 100.3 MHz, edit text"
   - Should announce keyboard shortcuts hint
   - Type a new frequency and hear it announced
   - Use arrow keys and hear incremental changes

4. **Preset Stations**:
   - Tab through preset buttons
   - Each should announce: "NPR - 88.5 MHz, Click to tune to this preset station, button"
   - Active station should indicate "Currently tuned"

#### Visualization Testing

1. **IQ Constellation**:
   - Tab to canvas element
   - Should announce: "IQ Constellation diagram showing 1024 signal samples..."
   - Should include data ranges and description
   - Verify complete information is read

2. **Amplitude Waveform**:
   - Tab to waveform canvas
   - Should announce: "Amplitude waveform showing X samples..."
   - Should include min, max, average values

3. **Spectrogram**:
   - Tab to spectrogram canvas
   - Should announce: "Spectrogram showing X time frames across Y frequency bins..."
   - Should include peak power information

#### Dynamic Content Testing

1. **Connection Status**:
   - Click "Connect Device" button
   - Live region should announce: "Connecting to SDR device..."
   - On success: "Started receiving radio signals"
   - On error: Error message should be announced

2. **Frequency Changes**:
   - Change frequency using input or presets
   - Should announce: "Frequency changed to 100.3 MHz"

**Expected Behavior**:

- All text content readable
- All interactive elements identifiable
- State changes announced automatically
- Navigation order is logical
- No unexpected focus jumps

**Common Issues to Check**:

- [ ] Missing button labels
- [ ] Visualizations without descriptions
- [ ] State changes not announced
- [ ] Unlabeled form fields
- [ ] Confusing navigation order

### VoiceOver (macOS - Built-in)

**Setup**:

1. Press Cmd+F5 to enable VoiceOver
2. Open Safari, Chrome, or Edge
3. Navigate to https://localhost:8080

**Testing Procedure**:

#### Navigation

1. **VoiceOver Cursor**:
   - Use Ctrl+Option+Arrow keys to navigate
   - Should hear each element described
   - Verify heading hierarchy is announced

2. **Web Rotor**:
   - Press Ctrl+Option+U to open Web Rotor
   - Navigate to "Headings" - verify all headings listed
   - Navigate to "Links" - verify all links listed
   - Navigate to "Form Controls" - verify all inputs/buttons
   - Navigate to "Landmarks" - verify main, navigation, etc.

3. **Quick Navigation**:
   - Press Ctrl+Option+Cmd+H to jump through headings
   - Should announce: "rad.io, heading level 1"
   - Verify logical heading structure

#### Interaction Testing

Same as NVDA testing above, but using VoiceOver-specific commands:

- Ctrl+Option+Space to activate elements
- Ctrl+Option+Arrow keys to explore
- Tab to move between interactive elements

**VoiceOver-Specific Checks**:

- [ ] Web Rotor shows all interactive elements
- [ ] Landmark navigation works correctly
- [ ] State changes announced with correct verbosity
- [ ] Complex widgets (if any) properly described

### JAWS (Windows - Commercial)

**Setup**:

1. Purchase/trial from https://www.freedomscientific.com/
2. Install and configure
3. Open Chrome or Edge
4. Navigate to https://localhost:8080

**Testing Notes**:

- JAWS is more verbose than NVDA
- May announce additional information about element types
- Virtual cursor navigation similar to NVDA
- Use Insert+F7 for links list
- Use Insert+F5 for form fields list

Follow same testing procedures as NVDA.

## Keyboard-Only Testing

### Prerequisites

- Unplug your mouse or cover it
- Use only keyboard for all interactions
- Test in Chrome, Edge, or Safari

### Test Scenarios

#### 1. Initial Page Load and Skip Link

**Steps**:

1. Load https://localhost:8080
2. Press Tab once
3. Verify focus is on "Skip to main content" link
4. Verify skip link is visible (should appear on focus)
5. Press Enter
6. Verify focus moves to main content area

**Expected Result**:

- Skip link appears when focused
- Skip link has clear visual indicator
- Activating skip link bypasses navigation

**Pass Criteria**:

- [ ] Skip link visible on focus
- [ ] Skip link clearly indicates focus
- [ ] Skip link successfully moves focus

#### 2. Navigation Menu

**Steps**:

1. From skip link, press Tab
2. Should land on first navigation link ("Live Monitor")
3. Continue tabbing through navigation
4. Verify each link is clearly focused
5. Press Enter on a link to navigate

**Expected Result**:

- All navigation links reachable via Tab
- Focus indicator clearly visible on each link
- Enter/Space activates links

**Pass Criteria**:

- [ ] All links keyboard accessible
- [ ] Focus indicator visible
- [ ] Links activate with Enter

#### 3. Device Control Bar

**Steps**:

1. Tab to "Connect Device" button
2. Verify focus indicator visible
3. Press Space or Enter to activate
4. Tab through other control buttons
5. Verify each button accessible and focused

**Expected Result**:

- All buttons reachable via Tab
- Clear focus indicators on all buttons
- Space/Enter activates buttons
- Disabled buttons skipped or clearly marked

**Pass Criteria**:

- [ ] All buttons keyboard accessible
- [ ] Space and Enter both activate buttons
- [ ] Disabled state clearly indicated

#### 4. Signal Type Selection

**Steps**:

1. Tab to signal type buttons (FM/AM/P25)
2. Verify focus indicator visible
3. Use Arrow keys to move between options (if implemented)
4. Or use Tab to move between buttons
5. Press Space/Enter to select option

**Expected Result**:

- All signal type buttons accessible
- Selected state clearly indicated visually
- Keyboard can change selection

**Pass Criteria**:

- [ ] All options keyboard accessible
- [ ] Selected state has visual indicator
- [ ] Can change selection with keyboard

#### 5. Frequency Input and Keyboard Shortcuts

**Steps**:

1. Tab to frequency input field
2. Verify focus indicator visible
3. Test each keyboard shortcut:
   - Press Arrow Up → frequency should increase by 0.1 MHz (FM)
   - Press Arrow Down → frequency should decrease by 0.1 MHz
   - Press Page Up → frequency should increase by 1.0 MHz
   - Press Page Down → frequency should decrease by 1.0 MHz
4. Type a new frequency directly
5. Press Enter or Tab away to apply

**Expected Result**:

- Frequency input clearly focused
- All keyboard shortcuts work as documented
- Changes are visible immediately
- Min/max bounds respected

**Pass Criteria**:

- [ ] Input has clear focus indicator
- [ ] Arrow keys adjust frequency (fine)
- [ ] Page Up/Down adjust frequency (coarse)
- [ ] Direct typing works
- [ ] Bounds are enforced

#### 6. Preset Stations

**Steps**:

1. Tab through preset station buttons
2. Verify each button clearly focused
3. Press Space/Enter to select a preset
4. Verify frequency updates
5. Verify active preset has visual indicator

**Expected Result**:

- All presets keyboard accessible
- Active preset clearly marked
- Selecting preset updates frequency

**Pass Criteria**:

- [ ] All presets accessible via Tab
- [ ] Active preset visually distinct
- [ ] Selection updates frequency

#### 7. Visualizations (Canvas Elements)

**Steps**:

1. Tab to IQ Constellation canvas
2. Verify canvas receives focus (outline visible)
3. Tab to Amplitude Waveform
4. Tab to Spectrogram
5. Verify each visualization focusable

**Expected Result**:

- All canvases focusable (tabIndex={0})
- Clear focus indicators on canvases
- Screen reader announces content (test separately)

**Pass Criteria**:

- [ ] All visualizations focusable
- [ ] Focus indicators visible
- [ ] ARIA labels present (check in DevTools)

#### 8. Complete Tab Order Test

**Steps**:

1. Start at top of page (press Ctrl+Home if needed)
2. Press Tab repeatedly
3. Document the tab order:
   - Skip link
   - Navigation links (3)
   - Connect Device button
   - Start Reception button
   - Stop Reception button
   - Signal type buttons (3)
   - Frequency input
   - Preset stations (6)
   - Other controls
   - Visualizations (3)
4. Verify tab order matches visual layout

**Expected Result**:

- Tab order follows visual top-to-bottom, left-to-right
- No jumps or unexpected focus movement
- All interactive elements reachable
- No focus traps

**Pass Criteria**:

- [ ] Logical tab order
- [ ] All elements reachable
- [ ] No keyboard traps
- [ ] Order matches visual layout

#### 9. No Keyboard Trap Test

**Steps**:

1. Tab through entire page
2. When reaching last focusable element, press Tab again
3. Verify focus wraps to browser chrome or first element
4. Press Shift+Tab to go backwards
5. Verify can navigate backwards through all elements

**Expected Result**:

- Can always move forward and backward
- No element "traps" keyboard focus
- Can always reach browser address bar (Ctrl+L or Cmd+L)

**Pass Criteria**:

- [ ] No keyboard traps exist
- [ ] Can navigate forward completely
- [ ] Can navigate backward completely
- [ ] Can reach browser chrome

## Zoom and Responsive Testing

### Browser Zoom Test (200%)

**Setup**:

1. Open rad.io in Chrome or Edge
2. Press Ctrl+0 (Cmd+0 on Mac) to reset zoom to 100%
3. Press Ctrl++ (Cmd++) to increase zoom to 200%

**Test Procedure**:

1. **Layout Integrity**:
   - [ ] No horizontal scrolling required
   - [ ] All text remains readable
   - [ ] No overlapping elements
   - [ ] Controls remain accessible

2. **Interactive Elements**:
   - [ ] All buttons still clickable
   - [ ] Input fields still usable
   - [ ] Dropdowns still functional
   - [ ] Visualizations still visible

3. **Navigation**:
   - [ ] Navigation menu still usable
   - [ ] Tab order still logical
   - [ ] Focus indicators still visible

4. **Text Content**:
   - [ ] All text readable (no truncation)
   - [ ] Line length remains reasonable
   - [ ] Headings still distinguishable

**Common Issues at 200% Zoom**:

- Text overflow from containers
- Buttons too small to activate
- Overlapping elements
- Broken layouts

### Mobile Viewport Test

**Setup**:

1. Open Chrome DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select mobile device (iPhone SE, Pixel 5, etc.)

**Test Procedure**:

1. **Touch Targets** (minimum 44x44px):
   - [ ] All buttons large enough to tap
   - [ ] Adequate spacing between targets
   - [ ] No accidental activations

2. **Layout**:
   - [ ] Content fits in viewport
   - [ ] No horizontal scroll (for content)
   - [ ] Text readable without zoom
   - [ ] Images scale appropriately

3. **Navigation**:
   - [ ] Menu accessible on mobile
   - [ ] All pages reachable
   - [ ] Forms usable with virtual keyboard

4. **Orientation**:
   - Test both portrait and landscape
   - [ ] Layout adapts correctly
   - [ ] No content cut off
   - [ ] All features accessible

## Color and Contrast Testing

### Using Browser DevTools

**Chrome/Edge**:

1. Open DevTools (F12)
2. Select Elements tab
3. Click on text element
4. Look at "Accessibility" pane in sidebar
5. Check "Contrast" section

**What to Check**:

- Normal text: Minimum 4.5:1 ratio
- Large text (18pt+): Minimum 3:1 ratio
- UI components: Minimum 3:1 ratio

**Test These Elements**:

- [ ] Body text on background
- [ ] Button text on button background
- [ ] Link text (default and visited)
- [ ] Form labels
- [ ] Error messages
- [ ] Focus indicators
- [ ] Disabled button text

### Using axe DevTools Extension

**Setup**:

1. Install from Chrome Web Store: "axe DevTools"
2. Open DevTools (F12)
3. Click "axe DevTools" tab

**Testing**:

1. Click "Scan ALL of my page"
2. Wait for results
3. Review "Needs Review" items for contrast
4. Filter by "Color Contrast" issue type
5. Fix any violations

### Manual Color Blindness Test

**Setup**:

1. Use a color blindness simulator:
   - Chrome extension: "Colorblindly"
   - DevTools > Rendering > Emulate vision deficiencies

**Test Each Mode**:

- [ ] Protanopia (red-blind)
- [ ] Deuteranopia (green-blind)
- [ ] Tritanopia (blue-blind)
- [ ] Achromatopsia (no color)

**Verify**:

- [ ] Information not conveyed by color alone
- [ ] Charts/graphs still distinguishable
- [ ] States (active, disabled) clear without color
- [ ] Error states indicated by text/icons

## Focus Indicator Testing

### Visual Focus Test

**Steps**:

1. Tab through all interactive elements
2. For each element, verify:
   - [ ] Focus indicator is visible
   - [ ] Focus indicator has sufficient contrast (3:1 minimum)
   - [ ] Focus indicator is at least 1px thick
   - [ ] Indicator fully surrounds or underlines element

**Elements to Test**:

- Buttons
- Links
- Form inputs
- Custom controls
- Canvas elements
- Any element with tabIndex

### Focus Indicator Contrast

Use DevTools to check focus indicator colors:

1. Focus an element
2. Inspect in DevTools
3. Check computed styles for `outline` or `box-shadow`
4. Verify color contrast against background

**Expected Styles** (in rad.io):

```css
*:focus-visible {
  outline: 3px solid #667eea; /* Blue outline */
  outline-offset: 2px;
}
```

**Verification**:

- [ ] #667eea against white background: > 3:1 ✅
- [ ] Focus indicators always visible
- [ ] No "invisible" focus states

## Testing Checklist

### Pre-Release Checklist

Before considering accessibility complete:

#### Automated Tests

- [ ] ESLint jsx-a11y rules all passing
- [ ] Jest accessibility tests (36 tests) all passing
- [ ] Playwright E2E tests all passing
- [ ] axe DevTools reports zero violations

#### Manual Tests

- [ ] Keyboard-only navigation complete
- [ ] Screen reader test completed (NVDA or VoiceOver)
- [ ] 200% zoom test completed
- [ ] Mobile viewport test completed
- [ ] Color contrast verified
- [ ] Focus indicators verified
- [ ] Color blindness simulation completed

#### Documentation

- [ ] ACCESSIBILITY.md up to date
- [ ] Known issues documented
- [ ] Keyboard shortcuts documented
- [ ] Testing procedures documented

### Issue Documentation Template

When you find an accessibility issue:

```markdown
## Accessibility Issue: [Short Description]

**Severity**: Critical / High / Medium / Low

**WCAG Criterion**: [e.g., 2.1.1 Keyboard, 1.4.3 Contrast (Minimum)]

**User Impact**: [Who is affected and how]

**Steps to Reproduce**:

1.
2.
3.

**Expected Behavior**:

**Actual Behavior**:

**Proposed Fix**:

**Testing Method**: Screen Reader / Keyboard / Color / Zoom / Other
```

## Resources

### Screen Readers

- **NVDA**: https://www.nvaccess.org/
- **JAWS**: https://www.freedomscientific.com/
- **VoiceOver**: Built into macOS (Cmd+F5)

### Testing Tools

- **axe DevTools**: https://www.deque.com/axe/devtools/
- **WAVE**: https://wave.webaim.org/
- **Lighthouse**: Built into Chrome DevTools
- **Colorblindly**: Chrome extension for color blindness simulation

### Standards and Guidelines

- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/
- **WebAIM**: https://webaim.org/

### Internal Documentation

- **ACCESSIBILITY.md**: Complete accessibility guide
- **ACCESSIBILITY_CHECKLIST.md**: PR review checklist
- **E2E_ACCESSIBILITY_TESTING.md**: Automated E2E testing guide

## Getting Help

If you encounter accessibility issues or need guidance:

1. Review this manual testing guide
2. Check automated test results for specific violations
3. Consult WCAG 2.1 guidelines for the relevant criterion
4. Open an issue with the "accessibility" label
5. Request accessibility review in PR comments

---

**Remember**: Accessibility is not a one-time checklist. It's an ongoing commitment to ensuring all users can access and use rad.io effectively.
