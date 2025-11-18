# GitHub Issues for Gap Analysis Implementation

This document contains 10 GitHub issues designed for junior-level engineers to implement the gaps identified in the codebase analysis. Copy each issue to GitHub's issue creation form.

**Source**: Based on docs/GAP_ANALYSIS_REPORT.md and docs/ACTIONABLE_RECOMMENDATIONS.md

---

## Issue 1: Add VFO Visual Marker to Spectrum Display

**Labels**: `enhancement`, `good first issue`, `ui`, `medium priority`

**Description**:

**Priority**: Medium | **Effort**: 2-3 days | **Good First Issue**

Add a visual cursor/marker on the spectrum display showing the current VFO (Variable Frequency Oscillator) frequency position.

### Current State
- FrequencyDisplay component works and shows frequency
- Spectrum renders but has no visual indicator of current frequency

### Expected Behavior
- Vertical line/cursor on spectrum at current frequency
- Updates in real-time as frequency changes
- Clear visual style (cyan color per design spec)

### Files to Modify
- `src/visualization/components/Spectrum.tsx`
- `src/visualization/renderers/SpectrumAnnotations.ts`

### Technical Hints
- Subscribe to frequency changes from Zustand store
- Render vertical line using canvas overlay
- Use `--rad-accent` CSS variable for color (cyan)

### Acceptance Criteria
- [ ] VFO cursor displays on spectrum at current frequency
- [ ] Cursor color matches design spec (cyan)
- [ ] Cursor updates when frequency changes
- [ ] Accessible (proper ARIA labels)
- [ ] Tests added for VFO cursor rendering

### References
- UI-DESIGN-SPEC.md Section 4.1
- docs/GAP_ANALYSIS_REPORT.md
- Related: ROADMAP.md Iteration 6

---

## Issue 2: Implement Storage Quota Display in Recordings Page

**Labels**: `enhancement`, `good first issue`, `ui`, `medium priority`

**Description**:

**Priority**: Medium | **Effort**: 1 day | **Good First Issue**

Add storage quota information display to the Recordings page to show users how much browser storage they're using.

### Current State
- Recordings page is placeholder with TODOs
- No storage information displayed

### Expected Behavior
- Display total storage quota
- Show used storage
- Show available storage
- Visual indicator (progress bar or percentage)

### Files to Modify
- `src/pages/Recordings.tsx`

### Technical Details
- Use StorageManager API: `navigator.storage.estimate()`
- Display quota, usage, and percentage used
- Add warning when >85% full (per PRD)
- Handle browsers that don't support the API

### Example Code
```typescript
const estimate = await navigator.storage.estimate();
const usage = estimate.usage || 0;
const quota = estimate.quota || 0;
const percentUsed = (usage / quota) * 100;
```

### Acceptance Criteria
- [ ] Storage quota displayed with total and used space
- [ ] Visual progress bar or percentage indicator
- [ ] Warning shown when storage >85% full
- [ ] Handles quota API not available gracefully
- [ ] Tests added for quota display logic

### References
- PRD.md Feature #6 (Recording System)
- docs/ACTIONABLE_RECOMMENDATIONS.md

---

## Issue 3: Add CSV Export for Bookmarks

**Labels**: `enhancement`, `good first issue`, `feature`, `medium priority`

**Description**:

**Priority**: Medium | **Effort**: 2-3 days | **Good First Issue**

Implement CSV export functionality for the bookmarks panel to allow users to export their frequency bookmarks.

### Current State
- Bookmark management works (create, edit, delete, search)
- No import/export functionality

### Expected Behavior
- Export button in bookmarks panel
- Exports to CSV format with standard fields
- Includes frequency, mode, label, tags, description

### Files to Create/Modify
- Create: `src/utils/bookmark-import-export.ts`
- Modify: `src/panels/Bookmarks.tsx`

### CSV Format Example
```csv
Frequency (Hz),Mode,Label,Tags,Description,Bandwidth,Squelch
100000000,FM,Local FM Station,"broadcast,fm","Local radio station",200000,0.5
146520000,FM,2m Simplex,"amateur,vhf","2-meter calling frequency",12500,0.3
```

### Technical Hints
- Convert bookmarks array to CSV string
- Use `Blob` and `URL.createObjectURL` for download
- Escape special characters in CSV (quotes, commas)
- Include timestamp in filename

### Acceptance Criteria
- [ ] Export button added to Bookmarks panel
- [ ] Clicking export downloads CSV file
- [ ] CSV includes all bookmark metadata
- [ ] Filename includes timestamp (e.g., `bookmarks-2025-11-18.csv`)
- [ ] Tests added for CSV generation
- [ ] Handles special characters in bookmark data (quotes, commas, newlines)

### References
- ROADMAP.md Iteration 7
- docs/GAP_ANALYSIS_REPORT.md

---

## Issue 4: Add Marker Table to Analysis Page

**Labels**: `enhancement`, `ui`, `medium priority`

**Description**:

**Priority**: Medium | **Effort**: 2 days

Wire up the existing MarkerTable component to the Analysis page and connect it to frequency marker state.

### Current State
- MarkerTable component exists as UI shell (`src/components/MarkerTable.tsx`)
- Analysis page exists but marker table not integrated
- No marker state management

### Expected Behavior
- MarkerTable displayed on Analysis page
- Shows frequency markers (M1, M2, M3...)
- Updates when markers are added/removed
- Calculates delta measurements (M2 - M1)

### Files to Modify
- `src/pages/Analysis.tsx`
- `src/components/MarkerTable.tsx`
- Create: `src/store/slices/markerSlice.ts`

### Technical Details
- Create Zustand slice for marker state
- Store marker positions (frequency, power)
- Support delta measurements (M2 - M1)

### Marker State Schema
```typescript
interface Marker {
  id: string;
  label: string; // "M1", "M2", etc.
  frequency: number; // Hz
  power: number; // dBFS or dBm
}

interface MarkerState {
  markers: Marker[];
  addMarker: (frequency: number, power: number) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
}
```

### Acceptance Criteria
- [ ] MarkerTable component displayed on Analysis page
- [ ] Marker state managed in Zustand store
- [ ] Can add markers (placeholder button for now)
- [ ] Can remove markers (delete button)
- [ ] Shows frequency and power for each marker
- [ ] Calculates and shows delta measurements
- [ ] Tests added for marker state management

### References
- PRD.md Feature #5 (Measurement Suite)
- docs/ACTIONABLE_RECOMMENDATIONS.md
- Related issue: Will be used by Issue #10 (Spectrum marker placement)

---

## Issue 5: Implement Empty State for Scanner Activity Log

**Labels**: `enhancement`, `good first issue`, `ui`, `low priority`

**Description**:

**Priority**: Low | **Effort**: 1 day | **Good First Issue**

Add an empty state table to the Scanner page showing the structure of the activity log that will populate when scanning works.

### Current State
- Scanner page exists with minimal UI
- No activity log table

### Expected Behavior
- Empty table with column headers
- Helpful message when no scan data
- Ready to populate when scanner logic is implemented

### Files to Modify
- `src/pages/Scanner.tsx`
- Create: `src/components/Scanner/ActivityLog.tsx`

### Table Columns
- Timestamp (ISO format)
- Frequency (MHz with 3 decimals)
- Signal Strength (dBm or S-units)
- Duration (seconds)
- Mode (AM/FM/SSB/etc.)
- Actions (bookmark button, record button)

### Empty State Message
```
"No scan activity yet. Start a scan to see detected signals here."
```

### Acceptance Criteria
- [ ] ActivityLog component created
- [ ] Displayed on Scanner page
- [ ] Shows empty state with helpful message
- [ ] Column headers match expected data structure
- [ ] Accessible table structure (proper ARIA labels)
- [ ] Responsive design (stacks on mobile)
- [ ] Tests added for component rendering

### References
- ROADMAP.md Iteration 9
- docs/ACTIONABLE_RECOMMENDATIONS.md

---

## Issue 6: Add Quick Actions Bar to Monitor Page

**Labels**: `enhancement`, `good first issue`, `ui`, `low priority`

**Description**:

**Priority**: Low | **Effort**: 1-2 days | **Good First Issue**

Add a quick actions toolbar to the Monitor page for common tasks (bookmark current frequency, start recording, toggle grid).

### Current State
- Monitor page has visualization but limited quick actions
- Common tasks require navigation to other panels

### Expected Behavior
- Toolbar with icon buttons for quick actions
- Bookmark current frequency (star icon)
- Start/stop recording (record icon)
- Toggle grid overlay (grid icon)
- Show keyboard shortcuts (? icon)

### Files to Modify
- `src/pages/Monitor.tsx`
- Create: `src/components/Monitor/QuickActions.tsx`

### Technical Details
- Use Phosphor Icons (per design spec): `BookmarkSimple`, `Record`, `GridFour`, `Question`
- Tooltips on hover showing keyboard shortcuts
- Icons update state (recording icon turns red when active)
- Integrate with existing functionality

### Icon/Action Mapping
```typescript
const actions = [
  { icon: 'BookmarkSimple', tooltip: 'Bookmark (B)', action: addBookmark },
  { icon: 'Record', tooltip: 'Record (R)', action: toggleRecording },
  { icon: 'GridFour', tooltip: 'Grid (G)', action: toggleGrid },
  { icon: 'Question', tooltip: 'Help (?)', action: showHelp },
];
```

### Acceptance Criteria
- [ ] QuickActions component created
- [ ] Displays on Monitor page (top-right or bottom toolbar)
- [ ] Bookmark button adds current frequency to bookmarks
- [ ] Record button triggers recording (uses existing RecordingControls logic)
- [ ] Grid button toggles grid overlay on spectrum
- [ ] Help button shows keyboard shortcuts overlay
- [ ] Tooltips show on hover
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Tests added

### References
- UI-DESIGN-SPEC.md Section 4
- docs/GAP_ANALYSIS_REPORT.md
- Icon system: Phosphor Icons documentation

---

## Issue 7: Create IndexedDB Storage Layer for Recordings

**Labels**: `enhancement`, `backend`, `high priority`, `architecture`

**Description**:

**Priority**: High | **Effort**: 3-5 days | **Senior guidance recommended**

Implement IndexedDB-based persistent storage for IQ recordings to enable recording library functionality.

### Current State
- IQRecorder class exists but only stores in memory (`src/utils/iqRecorder.ts`)
- No persistent storage for recordings
- ROADMAP incorrectly claimed this was implemented

### Expected Behavior
- Recordings saved to IndexedDB
- Metadata stored separately for quick queries
- Support for large recordings (>100MB)
- Quota management and error handling

### Files to Create
- `src/lib/recording/recording-manager.ts`
- `src/lib/recording/recording-storage.ts`
- `src/lib/recording/types.ts`

### Database Schema
```typescript
// Database name: 'rad-io-recordings'
// Version: 1

// Object store: 'recordings'
interface RecordingEntry {
  id: string;           // UUID
  metadata: {
    frequency: number;
    sampleRate: number;
    timestamp: Date;
    duration: number;
    deviceName?: string;
    tags: string[];
    label?: string;
  };
  chunks: Blob[];       // Chunked IQ data (10MB per chunk)
}

// Object store: 'recordings-meta' (for quick queries)
interface RecordingMeta {
  id: string;
  frequency: number;
  timestamp: Date;
  duration: number;
  size: number;         // Total bytes
  label?: string;
}
```

### Technical Details
- Use chunked writes for large files (10MB chunks)
- Implement quota checking before saving
- Support for SigMF metadata format (future)
- Transaction-based operations for data integrity

### API Design
```typescript
class RecordingManager {
  async saveRecording(recording: IQRecording): Promise<string>;
  async loadRecording(id: string): Promise<IQRecording>;
  async deleteRecording(id: string): Promise<void>;
  async listRecordings(): Promise<RecordingMeta[]>;
  async getStorageUsage(): Promise<{ used: number; quota: number }>;
}
```

### Acceptance Criteria
- [ ] RecordingManager class created and exported
- [ ] IndexedDB database initialized on app start
- [ ] Can save recording with metadata
- [ ] Can load recording by ID
- [ ] Can list all recordings (metadata only)
- [ ] Can delete recording and free space
- [ ] Handles quota exceeded errors gracefully
- [ ] Chunks large recordings (>10MB)
- [ ] Comprehensive tests added (unit and integration)
- [ ] Documentation updated (ARCHITECTURE.md)

### References
- ROADMAP.md Iteration 8
- ARCHITECTURE.md State & Persistence section
- ADR-0005 Storage Strategy
- Related: Issue #8 depends on this

---

## Issue 8: Implement Recording List View Component

**Labels**: `enhancement`, `ui`, `high priority`, `feature`

**Description**:

**Priority**: High | **Effort**: 3 days

Create a recording list/grid view component to display saved recordings with metadata and actions.

### Current State
- Recordings page is placeholder (`src/pages/Recordings.tsx`)
- No UI for viewing recordings

### Expected Behavior
- List or grid view of recordings
- Shows metadata (frequency, date, duration, size)
- Search and filter capabilities
- Actions: play, delete, export

### Files to Modify
- `src/pages/Recordings.tsx`
- Create: `src/components/Recordings/RecordingList.tsx`
- Create: `src/components/Recordings/RecordingCard.tsx`

### Dependencies
- **MUST COMPLETE FIRST**: Issue #7 (IndexedDB Storage Layer)

### Technical Details
- Virtual scrolling for large lists (use react-window or react-virtuoso)
- Each card shows: frequency, timestamp, duration, file size, tags
- Actions per card: Play (▶️), Delete (🗑️), Export (⬇️), Edit tags (✏️)
- Sort by: date (default), frequency, size, duration
- Filter by: tags, date range
- Search by: label, frequency

### Component Structure
```typescript
interface RecordingCardProps {
  recording: RecordingMeta;
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
}

interface RecordingListProps {
  recordings: RecordingMeta[];
  onRecordingSelect: (id: string) => void;
}
```

### Acceptance Criteria
- [ ] RecordingList component created
- [ ] RecordingCard component for each item
- [ ] Displays all recordings from RecordingManager
- [ ] Search by label/frequency works
- [ ] Filter by tags works
- [ ] Sort by date/frequency/size works
- [ ] Click card to select recording
- [ ] Delete button removes recording (with confirmation)
- [ ] Export button downloads recording as .iq file
- [ ] Play button loads recording for playback (placeholder for now)
- [ ] Empty state when no recordings
- [ ] Loading state while fetching
- [ ] Accessible (keyboard navigation, ARIA, screen reader support)
- [ ] Tests added (component and integration)

### References
- PRD.md Feature #6 (Recording System)
- docs/ACTIONABLE_RECOMMENDATIONS.md
- UI-DESIGN-SPEC.md Section 4.8

---

## Issue 9: Add Bookmark Import from CSV

**Labels**: `enhancement`, `feature`, `medium priority`

**Description**:

**Priority**: Medium | **Effort**: 2 days

Implement CSV import functionality to complement the export feature.

### Current State
- Bookmark management works
- CSV export available (Issue #3)
- No import capability

### Expected Behavior
- Import button in bookmarks panel
- File picker for CSV files
- Validation of CSV format
- Preview before importing
- Duplicate detection and handling

### Files to Modify
- `src/utils/bookmark-import-export.ts`
- `src/panels/Bookmarks.tsx`

### Dependencies
- **RECOMMENDED**: Issue #3 (CSV Export) completed first for consistency

### Technical Details
- Parse CSV with validation (use csv-parse or papaparse)
- Detect duplicate frequencies (within 1kHz tolerance)
- Preview dialog showing:
  - Number of bookmarks to import
  - List of duplicates detected
  - Option: Skip duplicates, Overwrite, or Import as new
- Validate required fields (frequency, mode)
- Handle malformed CSV gracefully

### CSV Validation Rules
```typescript
- Frequency: must be valid number, within device range (24 MHz - 1.7 GHz for RTL-SDR)
- Mode: must be one of: AM, FM, SSB, USB, LSB, CW, DIGITAL
- Bandwidth: optional, must be positive number
- Tags: optional, comma-separated in quotes
```

### Acceptance Criteria
- [ ] Import button added to Bookmarks panel
- [ ] File picker opens on click (accepts .csv files only)
- [ ] CSV parsed and validated
- [ ] Shows preview dialog with import summary
- [ ] Detects duplicates (frequency within 1kHz)
- [ ] Offers duplicate handling options
- [ ] Imports bookmarks to Zustand store
- [ ] Error handling for invalid CSV (shows error message)
- [ ] Success message after import (e.g., "25 bookmarks imported, 3 duplicates skipped")
- [ ] Tests added for CSV parsing, validation, and duplicate detection

### References
- ROADMAP.md Iteration 7
- docs/GAP_ANALYSIS_REPORT.md
- Related: Issue #3 (CSV Export)

---

## Issue 10: Add Frequency Marker Placement on Spectrum

**Labels**: `enhancement`, `ui`, `high priority`, `feature`

**Description**:

**Priority**: High | **Effort**: 3-4 days

Implement interactive frequency marker placement on the spectrum display for measurement purposes.

### Current State
- Spectrum displays signal
- No way to place markers
- MarkerTable exists but disconnected (Issue #4)

### Expected Behavior
- Click on spectrum to place marker
- Drag marker to adjust position
- Shows frequency and power at marker position
- Multiple markers supported (M1, M2, M3... up to 10)
- Markers sync with MarkerTable

### Files to Modify
- `src/visualization/components/Spectrum.tsx`
- `src/visualization/renderers/SpectrumAnnotations.ts`
- `src/store/slices/markerSlice.ts` (created in Issue #4)

### Dependencies
- **RECOMMENDED**: Issue #4 (Marker Table) completed first

### Technical Details
- Canvas click handler to detect marker placement
- Convert pixel X position to frequency (based on spectrum range)
- Read power value from FFT data at that frequency
- Render vertical line + label on spectrum
- Support drag to reposition marker
- Keyboard shortcut: 'M' to add marker at center frequency

### Coordinate Conversion
```typescript
function pixelToFrequency(pixelX: number, canvasWidth: number, 
                          startFreq: number, endFreq: number): number {
  const ratio = pixelX / canvasWidth;
  return startFreq + ratio * (endFreq - startFreq);
}
```

### Marker Rendering
- Vertical line: 2px wide, cyan color (`--rad-accent`)
- Label box: Shows "M1: 100.5 MHz, -45.2 dBFS"
- Drag handle: Small circle at top of line
- Highlight on hover

### Acceptance Criteria
- [ ] Click on spectrum places marker at clicked frequency
- [ ] Marker shows frequency and power value
- [ ] Can place multiple markers (up to 10)
- [ ] Markers have sequential labels (M1, M2, M3...)
- [ ] Drag marker vertically does nothing, drag horizontally repositions
- [ ] Markers sync with MarkerTable (both directions)
- [ ] Keyboard shortcut 'M' places marker at center
- [ ] Right-click marker to delete
- [ ] Accessible (announce marker placement to screen readers)
- [ ] Tests added for marker placement, drag, and coordinate conversion

### References
- PRD.md Feature #5 (Advanced Measurement Suite)
- UI-DESIGN-SPEC.md Section 4.2
- docs/ACTIONABLE_RECOMMENDATIONS.md
- Related: Issue #4 (Marker Table)

---

## Summary

These 10 issues represent the highest-priority gaps identified in the codebase analysis:

**Good First Issues** (suitable for junior engineers):
- Issue #1: VFO Visual Marker (2-3 days)
- Issue #2: Storage Quota Display (1 day)
- Issue #3: CSV Export (2-3 days)
- Issue #5: Scanner Activity Log (1 day)
- Issue #6: Quick Actions Bar (1-2 days)

**Intermediate Issues**:
- Issue #4: Marker Table Integration (2 days)
- Issue #9: CSV Import (2 days)

**Advanced Issues** (may need senior guidance):
- Issue #7: IndexedDB Storage Layer (3-5 days)
- Issue #8: Recording List View (3 days)
- Issue #10: Spectrum Marker Placement (3-4 days)

**Total Estimated Effort**: ~20-30 developer days

**Dependencies**:
- Issue #8 depends on Issue #7
- Issue #9 should follow Issue #3
- Issue #10 should follow Issue #4

**Labels to Create** (if not existing):
- `good first issue` - For junior-friendly issues
- `enhancement` - New feature or improvement
- `ui` - User interface work
- `backend` - Backend/architecture work
- `architecture` - Architectural changes
- `high priority` - Important for 1.0
- `medium priority` - Nice to have for 1.0
- `low priority` - Future enhancement

---

**Next Steps**:
1. Create these issues in GitHub
2. Assign appropriate labels
3. Link related issues in descriptions
4. Add to project board/milestone (if applicable)
5. Junior engineers can start with "good first issue" labeled items
