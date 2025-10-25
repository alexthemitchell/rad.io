# Bookmarks and Devices Panel Implementation

## Purpose
Documents the implementation patterns for Bookmarks and Devices panels, demonstrating the dual-mode (panel/page) pattern and storage/device integration.

## Bookmarks Panel (src/panels/Bookmarks.tsx)

### Features Implemented
- **Full CRUD**: Add, edit, delete bookmarks with form validation
- **Search**: Live filtering across name, tags, notes, frequency (useMemo optimization)
- **Storage**: localStorage with key `rad.io:bookmarks`
- **Navigation**: One-click tune navigates to `/monitor?frequency=<hz>`
- **Accessibility**: Screen reader announcements via useLiveRegion

### Data Model
```typescript
interface Bookmark {
  id: string; // Generated: bm-<timestamp>-<random>
  frequency: number; // Hz
  name: string;
  tags: string[]; // Array of tag strings
  notes: string;
  createdAt: number; // timestamp
  lastUsed: number; // timestamp (updated on tune)
}
```

### Key Patterns
1. **ID Generation**: Use `substring()` not deprecated `substr()`: `Math.random().toString(36).substring(2, 11)`
2. **Navigation with void**: React Router navigate returns Promise, must use `void navigate(path)`
3. **Frequency Input**: Display in MHz but store in Hz: `(freqHz / 1e6).toFixed(3)`
4. **Tags**: Parse as CSV with trim and filter: `tags.split(',').map(t => t.trim()).filter(t => t.length > 0)`

### Performance Notes
- useMemo for filtered bookmarks prevents re-filtering on every render
- Target: <100ms search with 10k+ entries (current: in-memory filter, future: IndexedDB with indices)

## Devices Panel (src/panels/Devices.tsx)

### Features Implemented
- **Device Discovery**: WebUSB via useHackRFDevice hook, initialize() shows device picker
- **Connection State**: Auto-connect to paired devices (isCheckingPaired flag)
- **Device Info**: Display product name, serial number, USB ID (vendor:product)
- **Current Settings**: Show frequency and sample rate from device
- **Connection Health**: Stub for buffer health and connection stability

### Key Patterns
1. **Type Assertions**: Access USB device from adapter: `(device as unknown as { device?: USBDevice }).device`
2. **Null Coalescing**: USB properties are `string | null`, convert to `undefined`: `productName ?? undefined`
3. **Async onClick**: Wrap in arrow function: `onClick={(): void => { void asyncFn(); }}`
4. **Device State Loading**: useEffect with device dependency, async IIFE pattern

### Device Hook Integration
- useHackRFDevice returns: `{ device, initialize, cleanup, isCheckingPaired }`
- device is ISDRDevice or undefined
- initialize() triggers WebUSB device picker (user approval required first time)
- cleanup() properly closes device connection
- Auto-connect on mount if previously paired

## Dual-Mode Pattern
Both components accept `isPanel?: boolean` prop:
- `isPanel=true`: role="complementary", class="panel-container"
- `isPanel=false`: role="main", class="page-container"

Used in both App.tsx routes and future side panel rendering.

## Common Utility Functions
- `formatFrequency(hz)`: Smart unit display (GHz/MHz/kHz/Hz with appropriate decimals)
- `formatSampleRate(rate)`: Display in MSPS with 2 decimals
- `formatDate(timestamp)`: toLocaleDateString() for human-readable dates

## Accessibility Checklist
- ✅ Semantic HTML (section, dl, dt/dd, button)
- ✅ ARIA labels (aria-label, aria-labelledby, aria-required)
- ✅ Screen reader announcements on all state changes
- ✅ Keyboard navigation (implicit via native elements)
- ✅ Form validation with user feedback (alert for now, future: inline errors)

## Testing Requirements
- Mock useHackRFDevice in tests for Devices panel
- Mock localStorage for Bookmarks panel tests
- Mock useNavigate for navigation tests
- Currently: No dedicated tests, covered by App.test.tsx with component mocks

## Future Enhancements
- **Bookmarks**: IndexedDB migration for 10k+ entries, import/export, category filters
- **Devices**: Gain control, PPM correction, bias-T toggle, multi-device support
- **Both**: Dedicated test files with full coverage of CRUD and device operations
