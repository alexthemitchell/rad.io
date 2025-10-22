# Device Control Bar Architecture

## Purpose

This memory documents the implementation of the shared `DeviceControlBar` component, which provides consistent device management UI across all pages in the rad.io application.

## Problem Solved

Previously, device connection and control UI was duplicated across pages (Visualizer, LiveMonitor, Analysis), making it difficult to start radio operations from pages other than the main one. Users had to navigate to specific pages to connect devices or start reception.

## Solution Architecture

### Shared Component Pattern

Created a reusable `DeviceControlBar` component that:

- Provides device connection controls
- Manages start/stop reception buttons
- Displays device status indicators
- Includes collapsible device diagnostics

### Key Design Decisions

1. **Presentation Component Pattern**: DeviceControlBar is a pure presentation component that receives all state and handlers as props. This allows each page to manage its own device lifecycle while sharing the same UI.

2. **Device Singleton via Hook**: The `useHackRFDevice()` hook provides a singleton device instance accessible from any page. Multiple pages can call this hook and receive the same device instance, maintaining consistency across navigation.

3. **Page-Level Control**: Each page manages:
   - Its own listening state
   - Its own sample processing callbacks
   - Its own error handling
   - Frequency and bandwidth settings

4. **Expandable Diagnostics**: Device diagnostics are hidden by default but can be expanded on-demand, reducing visual clutter while maintaining troubleshooting capabilities.

## File Structure

```
src/
├── components/
│   ├── DeviceControlBar.tsx          # New shared control bar
│   ├── DeviceDiagnostics.tsx         # Existing diagnostics (unchanged)
│   └── __tests__/
│       └── DeviceControlBar.test.tsx # Comprehensive test suite
├── pages/
│   ├── Visualizer.tsx                # Updated to use DeviceControlBar
│   ├── LiveMonitor.tsx               # Updated to use DeviceControlBar
│   └── Analysis.tsx                  # Updated to use DeviceControlBar
└── styles/
    └── main.css                      # Added DeviceControlBar styles
```

## Component API

### DeviceControlBar Props

```typescript
interface DeviceControlBarProps {
  device?: ISDRDevice; // Current device instance
  listening: boolean; // Is device actively receiving?
  isInitializing: boolean; // Is connection in progress?
  isCheckingPaired?: boolean; // Checking for paired devices?
  deviceError?: Error | null; // Any device errors
  frequency?: number; // Current frequency (for diagnostics)
  onConnect: () => Promise<void>; // Connect device handler
  onStartReception: () => Promise<void>; // Start reception handler
  onStopReception: () => Promise<void>; // Stop reception handler
  onResetDevice?: () => Promise<void>; // Device reset handler
  isResetting?: boolean; // Is reset in progress?
}
```

### Visual States

The component displays different buttons based on state:

1. **No Device**: Shows "Connect Device" button
2. **Device Connected, Not Listening**: Shows "Start Reception" button with "Connected" badge
3. **Device Listening**: Shows "Stop Reception" button with "Receiving" badge
4. **Device Error**: Shows "Device Error" badge in addition to controls

### Expandable Diagnostics

- Toggled via "Show/Hide Diagnostics" button
- Only visible when device is connected
- Displays:
  - Device connection status
  - Streaming status
  - Frequency configuration
  - Error messages with troubleshooting
  - Device reset option (when applicable)

## Integration Pattern

Each page follows this pattern:

```typescript
function PageComponent(): React.JSX.Element {
  // Get shared device instance
  const { device, initialize, isCheckingPaired } = useHackRFDevice();

  // Page-specific state
  const [listening, setListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [frequency, setFrequency] = useState(100.3e6);
  const [deviceError, setDeviceError] = useState<Error | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Page-specific handlers
  const handleConnect = useCallback(async () => {
    setIsInitializing(true);
    try {
      await initialize();
      setDeviceError(null);
    } catch (err) {
      setDeviceError(err);
    } finally {
      setIsInitializing(false);
    }
  }, [initialize]);

  const startListening = useCallback(async () => {
    // Page-specific sample processing logic
    await device.receive((data) => {
      const samples = device.parseSamples(data);
      // Process samples for this page's visualizations
    });
  }, [device]);

  // ... other handlers

  return (
    <main>
      <DeviceControlBar
        device={device}
        listening={listening}
        isInitializing={isInitializing}
        isCheckingPaired={isCheckingPaired}
        deviceError={deviceError}
        frequency={frequency}
        onConnect={handleConnect}
        onStartReception={startListening}
        onStopReception={stopListening}
        onResetDevice={handleResetDevice}
        isResetting={isResetting}
      />
      {/* Page-specific content */}
    </main>
  );
}
```

## Styling

Added new CSS classes in `main.css`:

- `.device-control-bar`: Container for the control bar
- `.device-control-actions`: Flex container for buttons and status
- `.device-status-badge`: Container for status indicators
- `.status-indicator`: Status badge with color coding
  - `.status-active`: Green (receiving)
  - `.status-idle`: Yellow (connected)
  - `.status-error`: Red (error state)
- `.device-diagnostics-panel`: Container for expandable diagnostics

## Benefits

1. **Consistency**: Same UI and behavior across all pages
2. **Accessibility**: Can start radio from any page (Analysis, Scanner, etc.)
3. **Maintainability**: Single source of truth for device control UI
4. **Reduced Duplication**: ~150 lines of JSX removed from each page
5. **Better UX**: Diagnostics accessible but not cluttering the main view

## Testing

Created comprehensive test suite covering:

- Button rendering based on state
- Button click handlers
- Diagnostics toggle functionality
- Status badge display
- Error state display
- Disabled states during initialization

All 10 tests pass successfully.

## Future Enhancements

Potential improvements:

1. Add device disconnect button (currently cleanup is implicit)
2. Add device selection dropdown for multi-device support
3. Remember diagnostics expanded state per-user preference
4. Add keyboard shortcuts for common actions
5. Add tooltips with more detailed state information

## Related Memories

- `PAGE_ORGANIZATION_ARCHITECTURE`: Multi-page state management patterns
- `ARCHITECTURE`: Overall component architecture and design patterns
- `WEBUSB_SDR_INTEGRATION_PLAYBOOK`: Device connection and lifecycle

## Key Takeaway

For applications with shared hardware resources:

- Use **singleton hooks** for the resource itself (device)
- Use **presentation components** for shared UI (DeviceControlBar)
- Let **pages manage** their own processing logic and callbacks
- Keep state management **local to pages** for flexibility
