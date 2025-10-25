# Shared Device Context Pattern (React Context for SDR Devices)

## Purpose
Centralized device management to prevent race conditions when multiple components access the same USB device.

## Problem Solved
Previously, `useHackRFDevice()` was called by multiple components (TopAppBar, Scanner, Visualizer, etc.), causing parallel `device.open()` attempts and `InvalidStateError` races. `DeviceContext` consolidates lifecycle and exposes a single primary device.

## Solution Architecture

Files:
- `src/contexts/DeviceContext.tsx` – React Context provider and hooks
- `src/contexts/index.ts` – barrel export

Key points:
- `DeviceProvider` wraps the app (see `src/App.tsx`)
- Maintains `Map<DeviceId, DeviceEntry>` for multi-device future
- Handles `initialize` (requestDevice), `closeDevice`, `closeAllDevices`
- `useDevice()` is the drop-in replacement for `useHackRFDevice()`

## Migration Pattern
Before:
- `import { useHackRFDevice } from "../hooks/useHackRFDevice";`

After:
- `import { useDevice } from "../contexts/DeviceContext";`

Updated components:
- `src/components/TopAppBar.tsx`
- `src/pages/Scanner.tsx`
- `src/pages/Visualizer.tsx`
- `src/pages/LiveMonitor.tsx`
- `src/pages/Analysis.tsx`
- `src/panels/Devices.tsx`

## Testing Pattern (Important)
When unit testing pages/panels that import `useDevice`, mock `DeviceContext` at the test top and import the component under test after mocks (using `require(...)`).

Use `device: undefined` by default to avoid null traps like `device !== undefined && device.isOpen()`:

```ts
jest.mock("../../contexts/DeviceContext", () => ({
  DeviceProvider: ({ children }: any) => <>{children}</>,
  useDevice: jest.fn(() => ({
    device: undefined,
    initialize: jest.fn(),
    cleanup: jest.fn(),
    isCheckingPaired: false,
  })),
  useDeviceContext: jest.fn(() => ({
    devices: new Map(),
    primaryDevice: undefined,
    isCheckingPaired: false,
    requestDevice: jest.fn(),
    closeDevice: jest.fn(),
    closeAllDevices: jest.fn(),
  })),
}));

// After mocks:
const Visualizer = require("../Visualizer").default;
```

Override per-test when needed, e.g., to assert click flows:

```ts
const { useDevice } = require("../../contexts/DeviceContext");
useDevice.mockReturnValue({
  device: { isReceiving: jest.fn(() => false), isOpen: jest.fn(() => true) },
  initialize: jest.fn(),
  cleanup: jest.fn(),
  isCheckingPaired: false,
});
```

## Related
- `src/hooks/useUSBDevice.ts` (provider dependency)
- `src/hooks/useHackRFDevice.ts` (legacy compatibility)
- ADR-0018 (state management)
