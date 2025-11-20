# Recording List View Component Implementation

## Overview

Implemented comprehensive UI for viewing, searching, sorting, and managing IQ recordings stored in IndexedDB (Issue #258).

## Components Created

### RecordingCard (`src/components/Recordings/RecordingCard.tsx`)

- Displays individual recording with metadata (frequency, label, date, duration, size)
- Action buttons: Play (▶️), Export (⬇️), Edit Tags (✏️), Delete (🗑️)
- Full accessibility: ARIA labels, keyboard navigation, 44×44px touch targets
- Formatting utilities for frequency (Hz/kHz/MHz/GHz), bytes (B/KB/MB/GB), duration (mm:ss/hh:mm:ss), timestamps

### RecordingList (`src/components/Recordings/RecordingList.tsx`)

- Grid layout (responsive: auto-fill minmax(300px, 1fr))
- Search: filters by label or frequency (case-insensitive, real-time)
- Sort: Date/Frequency/Size/Duration with ascending/descending toggle
- States: Loading (EmptyState), Empty (helpful message), Results (grid of cards)
- Accessibility: keyboard controls, ARIA roles, screen reader support

### Recordings Page Updates (`src/pages/Recordings.tsx`)

- Loads recordings from RecordingManager on mount
- Delete confirmation modal (Escape key support, focus management)
- Export downloads binary .iq file (Float32 I/Q interleaved)
- Play button placeholder (sets selectedRecordingId for future playback)

## Key Patterns

### State Management

```typescript
const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
  null,
);
```

### Search/Filter/Sort Logic

- useMemo for derived state (filtered + sorted recordings)
- Default sort: date descending (newest first)
- Toggle sort direction on same field click
- Search matches label OR frequency string

### Accessibility Wins

- Semantic HTML: article, section, aside, role="dialog"
- ARIA: labelledby, describedby, live regions, pressed states
- Keyboard: Tab navigation, Enter/Space activation, Escape closes dialogs
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables transitions
- Touch targets: min-width/height 44px per WCAG 2.1 AA

## Testing Strategy

- Component tests (RecordingCard, RecordingList): Mock RecordingManager, test interactions, formatting, accessibility
- Page tests (Recordings.tsx): Mock hooks and manager, test async loading, delete flow, integration
- 30 new tests added, all passing

## Future Enhancements

- Tag editing modal (button exists, handler TBD)
- Actual playback controls (Audio/IQ visualization)
- Virtual scrolling (react-virtuoso) if >1000 recordings
- Batch operations (multi-select, bulk delete)
- Advanced filters (date range, size range, signal type)

## Dependencies

- Requires RecordingManager from Issue #257 (IndexedDB Storage Layer)
- No new npm packages added (avoided react-window/react-virtuoso for minimal changes)
- Uses existing EmptyState, type definitions from lib/recording/types.ts
