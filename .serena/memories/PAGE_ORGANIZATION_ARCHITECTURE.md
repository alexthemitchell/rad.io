# Page Organization & Architecture Learnings

## Purpose
This memory captures key architectural patterns and learnings for organizing React applications into multiple pages, specifically for SDR applications with complex state management needs.

## Key Architectural Patterns

### Multi-Page Organization by User Intent
Pages should be organized around **user workflows** rather than technical capabilities:
- **Discovery/Exploration**: Scanning, searching, finding signals
- **Active Monitoring**: Real-time reception, listening, viewing live data
- **Analysis/Deep Dive**: Detailed inspection, performance metrics, recording

### State Management Across Pages

**Device State (Shared)**:
- Use singleton hooks (e.g., `useHackRFDevice()`) for hardware resources
- Device connection persists across page navigation
- Multiple pages can access the same device instance
- Pattern: Context or custom hook with ref-based singleton

**Page-Specific State (Isolated)**:
- Sample buffers: Each page manages its own (prevents memory bloat)
- Audio processing: Only active on pages that need it
- Visualization state: Per-page to avoid unnecessary computation

**Navigation State (Temporary)**:
- Use React Router's `location.state` for cross-page data passing
- Example: Scanner → LiveMonitor frequency tuning
- Pattern: `navigate(path, { state: { frequency, signalType } })`

### Why useRef for Performance-Critical State

**Performance Rationale**:
- Sample buffers update 30+ times/second
- RAF (requestAnimationFrame) callbacks need stable references
- Avoiding re-renders on every sample chunk (performance critical)
- Refs store mutable values without triggering re-renders

**When to use useRef vs useState**:
- **useRef**: High-frequency updates, RAF callbacks, timers, buffers
- **useState**: UI-visible state, user interactions, control values
- Mixed approach: Refs for internals, state for rendering

**Example Pattern**:
```typescript
// Internal state (no re-render needed)
const sampleBufferRef = useRef<Sample[]>([]);
const rafIdRef = useRef<number | null>(null);

// UI state (needs re-render)
const [samples, setSamples] = useState<Sample[]>([]);

// Update internal buffer frequently
sampleBufferRef.current = newSamples;

// Update UI state on throttled schedule (30 FPS)
if (shouldUpdate) {
  setSamples([...sampleBufferRef.current]);
}
```

### Accessibility Across Pages

**Screen Reader Patterns**:
- Create reusable hooks for common a11y features
- `useLiveRegion()`: Centralizes ARIA live region management
- Benefits: Consistent announcements, reduced duplication, easier testing

**Pattern**:
```typescript
// Hook provides announce function + LiveRegion component
const { announce, LiveRegion } = useLiveRegion();

// Announce without prop drilling
announce("Device connected");

// Render once per page
<LiveRegion />
```

### Navigation Architecture

**Tab-Based Navigation**:
- Clear visual hierarchy (header with tabs)
- Mobile-responsive (vertical stack on small screens)
- Active state highlighting for orientation
- Use NavLink for automatic active class

**Skip Links & Focus Management**:
- Include skip-to-main-content links on all pages
- Maintain focus context during navigation
- Announce page changes to screen readers

## CSS Organization Strategy

**Current Challenge**: Single 1256-line CSS file becoming unwieldy

**Future Strategy Options**:

1. **CSS Modules** (Recommended for React):
   - File per component: `Component.module.css`
   - Scoped by default, no naming collisions
   - Import: `import styles from './Component.module.css'`
   - Use: `className={styles.button}`

2. **Styled Components / Emotion**:
   - CSS-in-JS with TypeScript support
   - Component-scoped styles
   - Dynamic styling based on props
   - Tree-shaking unused styles

3. **File Split Approach** (Minimal change):
   - `main.css`: Global styles, reset, typography
   - `layout.css`: Grid, flex, spacing utilities
   - `navigation.css`: Nav-specific styles
   - `components.css`: Card, button, form styles
   - `visualizations.css`: Canvas, chart styles
   - Import order in index: global → layout → components

**Migration Path**:
- Start with file split (least disruptive)
- Gradually migrate to CSS Modules for new components
- Keep global utilities (color palette, spacing scale)

## Common Pitfalls & Solutions

**Pitfall**: Sharing sample buffers across pages
- **Problem**: Memory bloat, stale data
- **Solution**: Per-page buffers, clear on unmount

**Pitfall**: Re-rendering on every sample
- **Problem**: UI lag, dropped frames
- **Solution**: Throttle with RAF, use refs for buffers

**Pitfall**: Device state conflicts
- **Problem**: Multiple pages trying to control device
- **Solution**: Singleton pattern, single source of truth

**Pitfall**: Lost navigation context
- **Problem**: User forgets which frequency they were on
- **Solution**: Pass state via router, auto-tune on arrival

## Performance Optimization Lessons

**30 FPS Throttling**:
- Sample updates run at device rate (2+ MSPS)
- UI updates throttled to 30 FPS via `UPDATE_INTERVAL_MS`
- Pattern: `if (now - lastUpdate > interval) { updateUI(); }`

**Audio Processing Isolation**:
- Only LiveMonitor runs audio pipeline
- Other pages don't waste CPU on unused processing
- Conditional initialization based on page needs

**Buffer Management**:
- Cap at 32768 samples (prevents unbounded growth)
- Slice old data: `buffer.slice(buffer.length - MAX)`
- Clear buffers on page unmount

## Testing Considerations

**Page-Level Testing**:
- Each page can be tested in isolation
- Mock shared hooks (useHackRFDevice, etc.)
- Test navigation state handling
- Verify cleanup on unmount

**Hook Testing**:
- Test `useLiveRegion` independently
- Verify announce timing and message queue
- Test LiveRegion rendering and ARIA attributes

## Future Enhancements

**State Persistence**:
- localStorage for user preferences
- Session state for temporary data
- IndexedDB for large datasets (recordings)

**Advanced Routing**:
- Nested routes for sub-pages
- Route guards for device requirements
- Query params for shareable configs

**Cross-Page Features**:
- Signal bookmarks (saved across pages)
- History tracking (recent frequencies)
- Multi-device support (device selector)

## Key Takeaway

For SDR applications with real-time data and complex user workflows:
- Organize by **user intent**, not technical structure
- Use **refs for performance**, **state for UI**
- Share device, isolate buffers
- Make accessibility **reusable and consistent**
- Plan for CSS organization **before it becomes painful**
