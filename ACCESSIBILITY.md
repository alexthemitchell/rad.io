# Accessibility Features

This document describes the accessibility features implemented in the rad.io SDR visualizer application to ensure the application is usable by people with disabilities, including those using screen readers and keyboard-only navigation.

## Table of Contents

- [Overview](#overview)
- [ARIA Attributes](#aria-attributes)
- [Keyboard Navigation](#keyboard-navigation)
- [Screen Reader Support](#screen-reader-support)
- [Focus Management](#focus-management)
- [Semantic HTML](#semantic-html)
- [Testing Accessibility](#testing-accessibility)

## Overview

rad.io has been designed with accessibility as a core principle. The application follows WCAG 2.1 Level AA guidelines and implements comprehensive support for assistive technologies.

### Key Features

- **Canvas Visualizations**: All canvas-based visualizations have descriptive ARIA labels providing textual alternatives
- **Keyboard Navigation**: Full keyboard support for all interactive elements with visual focus indicators
- **Screen Reader Support**: Live regions announce important state changes and updates
- **Semantic HTML**: Proper use of semantic elements (section, main, header) for better structure
- **Focus Management**: Logical tab order and visible focus indicators

## ARIA Attributes

### Canvas Visualizations

All three main visualizations (IQ Constellation, Spectrogram, Waveform) provide rich textual descriptions:

#### IQ Constellation Diagram
```tsx
<canvas 
  role="img"
  aria-label="IQ Constellation diagram showing 1024 signal samples. 
             In-phase (I) component ranges from -0.500 to 0.500 with range 1.000. 
             Quadrature (Q) component ranges from -0.500 to 0.500 with range 1.000. 
             The pattern represents the modulation scheme and signal quality."
  tabIndex={0}
/>
```

The description includes:
- Number of samples being displayed
- I/Q component ranges and variance
- Context about what the visualization represents

#### Spectrogram
```tsx
<canvas 
  role="img"
  aria-label="Spectrogram showing 50 time frames across 100 frequency bins (1000 to 1100). 
             Peak power of -45.23 dB detected at frequency bin 1050. 
             Colors represent signal strength from low (dark) to high (bright)."
  tabIndex={0}
/>
```

The description includes:
- Number of time frames and frequency bins
- Frequency range being displayed
- Peak power location and strength
- Color mapping explanation

#### Amplitude Waveform
```tsx
<canvas 
  role="img"
  aria-label="Amplitude waveform showing 2048 time-domain samples. 
             Signal amplitude ranges from 0.000 to 0.850 with average 0.425. 
             The waveform represents signal strength variation over time."
  tabIndex={0}
/>
```

The description includes:
- Number of time-domain samples
- Amplitude range (min, max, average)
- Context about the visualization

### Interactive Controls

All interactive controls have proper ARIA attributes:

#### Signal Type Selector
- `aria-pressed` indicates which signal type is currently selected
- `aria-label` provides context including selection state

#### Preset Stations
- `aria-pressed="true"` on the currently tuned station
- Descriptive labels including frequency and station name

#### Status Indicators
- `role="status"` with `aria-live="polite"` for connection status
- Updates announced to screen readers without interrupting

## Keyboard Navigation

### Frequency Tuning

The frequency input supports comprehensive keyboard navigation:

| Key | Action | FM Step | AM Step |
|-----|--------|---------|---------|
| **Arrow Up** | Increase frequency (fine) | +0.1 MHz | +10 kHz |
| **Arrow Down** | Decrease frequency (fine) | -0.1 MHz | -10 kHz |
| **Page Up** | Increase frequency (coarse) | +1.0 MHz | +100 kHz |
| **Page Down** | Decrease frequency (coarse) | -1.0 MHz | -100 kHz |

Example usage:
```typescript
// User presses Arrow Up while focused on frequency input
// Frequency increases by one step (0.1 MHz for FM)
handleKeyDown(event: KeyboardEvent) {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    setFrequency(currentFrequency + step);
  }
}
```

### Tab Navigation

All interactive elements follow a logical tab order:
1. Skip to main content link
2. Device control buttons (Connect, Start/Stop, Disconnect)
3. Signal type selector
4. Frequency input
5. Preset station buttons
6. Visualizations (focusable for screen reader context)

### Skip Links

A skip-to-content link allows keyboard users to bypass navigation:

```tsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
```

The link is visually hidden until focused, ensuring keyboard users can quickly access the main content.

## Screen Reader Support

### Live Regions

Dynamic status updates are announced to screen readers using ARIA live regions:

```tsx
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  className="visually-hidden"
>
  {liveRegionMessage}
</div>
```

Announcements include:
- Device connection status: "Connecting to SDR device...", "Started receiving radio signals"
- Frequency changes: "Frequency changed to 100.3 MHz"
- Signal type changes: "Signal type changed to FM"
- Connection errors: "Failed to connect to device"

### Visually Hidden Content

Additional context for screen reader users is provided using the `.visually-hidden` class:

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

This content is accessible to screen readers but not visually rendered.

### Descriptive Labels

All form controls have both visible labels and comprehensive `aria-label` attributes:

```tsx
<label className="control-label" htmlFor="frequency-input">
  Frequency (MHz)
</label>
<input
  id="frequency-input"
  aria-label="Center frequency in MHz. Range: 88.1 to 107.9 MHz. 
             Current: 100.3 MHz. Use arrow keys for fine tuning, 
             Page Up/Down for coarse tuning."
  aria-describedby="frequency-hint"
/>
```

## Focus Management

### Visual Focus Indicators

All focusable elements have clear, visible focus indicators:

```css
*:focus-visible {
  outline: 3px solid #667eea;
  outline-offset: 2px;
}

button:focus-visible {
  outline: 3px solid #667eea;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}

canvas:focus-visible {
  outline: 3px solid #667eea;
  outline-offset: 4px;
  box-shadow: 0 0 0 6px rgba(102, 126, 234, 0.2);
}
```

### Focus Order

The focus order follows the visual layout of the page:
1. Header and skip links
2. Primary device controls (toolbar)
3. Configuration controls (signal type, frequency)
4. Preset stations
5. Visualizations

## Semantic HTML

### Document Structure

The application uses semantic HTML elements for better screen reader navigation:

```tsx
<div className="container">
  <a href="#main-content" className="skip-link">Skip to main content</a>
  
  <header className="header" role="banner">
    <h1>rad.io</h1>
    <p>Software-Defined Radio Visualizer</p>
  </header>

  <main id="main-content" role="main">
    <div className="action-bar" role="toolbar" aria-label="Device control actions">
      {/* Control buttons */}
    </div>
    
    <section className="card" aria-labelledby="radio-controls-title">
      <h2 id="radio-controls-title">Radio Controls</h2>
      {/* Controls */}
    </section>
    
    <div className="visualizations" role="region" aria-label="Signal visualizations">
      {/* Visualization cards */}
    </div>
  </main>
</div>
```

### Card Components

Card components use proper heading hierarchy:

```tsx
<section className="card" aria-labelledby="card-title-iq-constellation">
  <h2 id="card-title-iq-constellation" className="card-title">
    IQ Constellation Diagram
  </h2>
  <p className="card-subtitle">
    Visual representation of the I (in-phase) and Q (quadrature) components
  </p>
  {children}
</section>
```

## Testing Accessibility

### Automated Tests

The application includes comprehensive accessibility tests in `src/components/__tests__/Accessibility.test.tsx`:

```bash
npm test -- Accessibility.test.tsx
```

Tests cover:
- ARIA attributes on all visualizations
- Keyboard navigation functionality
- Focus management
- Screen reader labels and descriptions
- Semantic HTML structure

### Manual Testing

#### Screen Reader Testing

Recommended tools:
- **NVDA** (Windows): Free and open source
- **JAWS** (Windows): Industry standard
- **VoiceOver** (macOS): Built into Mac
- **Orca** (Linux): Built into GNOME

Testing checklist:
1. Navigate the page using Tab key
2. Verify all controls are announced with meaningful labels
3. Trigger frequency changes and verify announcements
4. Navigate to canvas visualizations and verify descriptions
5. Test form controls for proper label associations

#### Keyboard Testing

Testing checklist:
1. ✓ Navigate entire interface without mouse
2. ✓ Verify visible focus indicators on all elements
3. ✓ Test frequency tuning with arrow keys and Page Up/Down
4. ✓ Activate all buttons with Enter/Space
5. ✓ Use Tab to move between controls in logical order
6. ✓ Use skip link to jump to main content

### ESLint Accessibility Rules

The project uses `eslint-plugin-jsx-a11y` to enforce accessibility best practices during development:

```javascript
// eslint.config.mjs
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/label-has-associated-control": "error",
      // ... additional rules
    }
  }
];
```

Run linting to check accessibility:
```bash
npm run lint
```

## Best Practices

### Adding New Components

When adding new components, follow these guidelines:

1. **Use semantic HTML**: Choose the most appropriate HTML element (button, input, section, etc.)
2. **Provide labels**: All interactive elements need visible labels or `aria-label`
3. **Support keyboard**: Ensure keyboard users can access all functionality
4. **Add ARIA when needed**: Use ARIA attributes to enhance semantics when HTML alone is insufficient
5. **Test with screen reader**: Verify the component works with at least one screen reader
6. **Write accessibility tests**: Add tests to verify ARIA attributes and keyboard behavior

### Example: Adding a New Control

```tsx
function NewControl() {
  const [value, setValue] = useState(0);
  
  return (
    <div className="control-group">
      <label htmlFor="new-control" className="control-label">
        Control Name
      </label>
      <input
        id="new-control"
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label={`Control Name: ${value}%`}
        aria-describedby="new-control-hint"
      />
      <span id="new-control-hint" className="visually-hidden">
        Use arrow keys to adjust value in 1% increments
      </span>
    </div>
  );
}
```

## Resources

### WCAG Guidelines
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM WCAG Checklist](https://webaim.org/standards/wcag/checklist)

### ARIA
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Using ARIA](https://www.w3.org/TR/using-aria/)

### Testing Tools
- [NVDA Screen Reader](https://www.nvaccess.org/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### References
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11Y Project Checklist](https://www.a11yproject.com/checklist/)
