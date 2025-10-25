# ADR-0018 Page Architecture Implementation

## Purpose

Documents the implementation of ADR-0018 UX Information Architecture, including new page structure, routing, navigation patterns, and scaffold components for future development.

## Route Structure

All routes implemented in `src/App.tsx`:

### Primary Workspaces
- `/` and `/monitor` → Monitor page (default landing)
- `/scanner` → Scanner page
- `/decode` → Decode page (digital modes)
- `/analysis` → Analysis page (deep signal analysis)
- `/recordings` → Recordings library

### Supporting Panels (dual-purpose: panel + full page)
- `/bookmarks` → Bookmarks (frequency management)
- `/devices` → Devices (WebUSB SDR management)
- `/measurements` → Measurements (signal analysis tools)
- `/diagnostics` → Diagnostics (telemetry & logs)

All panels accept `isPanel?: boolean` prop to render as side panel or full page.

### Configuration & Help
- `/settings` → Settings (tabbed: Display, Radio, Audio, Calibration, Advanced)
- `/calibration` → Calibration wizard
- `/help` → Help & documentation (tabbed: Onboarding, Keyboard, Accessibility, Releases, Support)

## Navigation Pattern

`src/components/Navigation.tsx` implements keyboard shortcuts:
- `1-5` for primary workspaces (Monitor, Scanner, Decode, Analysis, Recordings)
- `?` for Help
- Keyboard shortcuts only active when not in input fields
- Uses `aria-keyshortcuts` for accessibility

Navigation links include keyboard hints in tooltips.

## Component Organization

### Pages Directory (`src/pages/`)
- `Monitor.tsx` (replaces LiveMonitor, not yet migrated)
- `Scanner.tsx` (existing)
- `Decode.tsx` (new scaffold)
- `Analysis.tsx` (existing)
- `Recordings.tsx` (new scaffold)
- `Settings.tsx` (new, tabbed interface)
- `Calibration.tsx` (new, wizard flow)
- `Help.tsx` (new, multi-section)

### Panels Directory (`src/panels/`)
- `Bookmarks.tsx`
- `Devices.tsx`
- `Measurements.tsx`
- `Diagnostics.tsx`

All panels use `isPanel` prop pattern for flexible rendering.

### Global Shell Components (`src/components/`)
- `TopAppBar.tsx` (connection status, sample rate, buffer health, quick record)
- `StatusFooter.tsx` (FPS, GPU mode, audio state, storage)
- `FrequencyDisplay.tsx` (VFO controls with JetBrains Mono font)
- `Navigation.tsx` (updated with keyboard shortcuts)

## Scaffold Pattern

All new pages/panels follow this pattern:
- JSDoc comment with purpose, dependencies (ADR references), features, success criteria
- TODO comments for future implementation
- Proper accessibility (roles, labels, keyboard support)
- Semantic HTML structure

Example from `Decode.tsx`:
```typescript
/**
 * Decode page for digital mode decoders (RTTY, PSK31/63/125, SSTV)
 * Dependencies: ADR-0016, ADR-0008
 * TODO: Implement mode selection, decoder outputs
 */
```

## Testing Updates

Tests updated for new structure:
- `src/components/__tests__/Navigation.test.tsx` → Updated for 6 navigation links
- `src/__tests__/App.test.tsx` → Updated mocks for all new pages/panels

All 1076 tests passing after updates.

## Next Steps for Implementation

1. **Migrate LiveMonitor content to Monitor page** (`src/pages/LiveMonitor.tsx` → `src/pages/Monitor.tsx`)
2. **Integrate global shell components** into App.tsx layout
3. **Implement deep linking** with query params (fftSize, window, palette, etc.)
4. **Add panel toggle mechanism** for showing/hiding supporting panels
5. **Implement state management** for cross-page device/buffer sharing
6. **Populate scaffolds** starting with highest-priority pages (Monitor, Scanner, Decode)

## Key Invariants

- Primary workspaces always accessible via keyboard shortcuts 1-5
- Panels can render standalone or embedded (via `isPanel` prop)
- Navigation shows active state for current route
- All pages include accessibility (ARIA, keyboard, screen reader support)
- Tests mock all page/panel components to avoid dependency chains

## File Paths Reference

- Main routing: `src/App.tsx`
- Navigation: `src/components/Navigation.tsx`
- Pages: `src/pages/*.tsx`
- Panels: `src/panels/*.tsx`
- Global shell: `src/components/{TopAppBar,StatusFooter,FrequencyDisplay}.tsx`
- Tests: `src/__tests__/App.test.tsx`, `src/components/__tests__/Navigation.test.tsx`
