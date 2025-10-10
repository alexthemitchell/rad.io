This project is a small browser-based SDR (Software Defined Radio) visualizer built with React + TypeScript.

Key architecture & entry points

- App: `src/App.tsx` mounts the Visualizer page. The app entry is `src/index.tsx` (webpack entry: `src/index.tsx`).
- Visualizer page: `src/pages/Visualizer.tsx` — shows how devices are initialized and used. It calls `useHackRFDevice()` and then calls methods on the device (e.g. `setFrequency`, `setAmpEnable`, `receive`).
- Device model: `src/models/HackRFOne.ts` — wraps a WebUSB `USBDevice`. It exposes async lifecycle methods: `open()`, `close()`, `setFrequency()`, `setAmpEnable()`, `setLNAGain()`, and `receive()`.
- USB discovery: `src/hooks/useUSBDevice.ts` — simple hook that calls `navigator.usb.requestDevice({ filters })` and returns the `USBDevice`.
- Device hook: `src/hooks/useHackRFDevice.ts` — composes `useUSBDevice` to filter on vendorId 0x1d50 and constructs/opens a `HackRFOne` instance.

Important project conventions & patterns

- Browser + WebUSB: The code assumes it'll run in a secure context (webpack devServer configured with `server: "https"`). All device communication is via the WebUSB API (`navigator.usb`, `USBDevice` methods). Look for `usbDevice.open()`, `claimInterface`, `controlTransferIn/Out`, and `transferIn`.
- Hook-first UI: Device lifecycle and user interactions live in React hooks (see `useHackRFDevice`, `useUSBDevice`). Follow this pattern when adding new hardware integrations.
- Typescript strict mode: `tsconfig.json` has `strict: true` and `noImplicitAny`. Maintain explicit types for exported functions/classes.
- Small, single-page app: Visual output components live under `src/components/` (charts, controls). Keep UI logic separate from device/control logic in `src/models` and `src/hooks`.

Concrete code examples & gotchas

- Requesting device: use the existing filter pattern shown in `useHackRFDevice.ts`:
  - vendorId: 0x1d50 for HackRF devices.
- Opening the device: `new HackRFOne(usbDevice); await hackRF.open();` — the constructor reads the device configuration and interface number.
- Control transfers: `HackRFOne.controlTransferIn` and `controlTransferOut` build USB control transfer parameter objects with `requestType: 'vendor'` and `recipient: 'device'`. Inspect `RequestCommand` enum in `src/models/HackRFOne.ts` for supported commands.
- watch for small implementation issues: e.g. `controlTransferIn` currently references `length` in a debug statement but doesn't accept or pass it consistently; `receive()` calls `this.usbDevice.transferIn()` without arguments. If you modify these methods, preserve semantics: the code expects vendor control transfers for commands (SET_FREQ, AMP_ENABLE, etc.) and a long-running `receive()` loop reading bulk/interrupt transfers.

Developer workflows

- Build: `npm run build` (runs `webpack`).
- Dev server: `npm start` (runs `webpack serve`) — webpack is configured to serve from `./dist` over HTTPS with HMR enabled. The app expects a secure context for WebUSB.
- Linting: `npm run lint` (runs `eslint src`).

Patterns for changes and tests

- Keep device logic in `src/models` and expose small, well-typed async functions. UI components should rely on hooks (`src/hooks/*`) to obtain device instances.
- When adding features that use WebUSB or streaming data, add small smoke tests where possible. There is a sample test file under `src/hooks/__test__/testSamples.ts` — use it as a reference for data shapes.

Integration & external dependencies

- Uses browser-only APIs (WebUSB). Do not add node-only native modules that won't run in the browser runtime.
- Dependencies visible in `package.json`: React 19, visx libs for charting, `webfft` and `fftshift` for FFT work.

When in doubt

- Prefer following the existing hook -> model -> component separation.
- Keep changes minimal and well-typed. Run the dev server in HTTPS to test USB flows.

If you need clarification, ask what part of the device flow (discovery, control transfers, streaming) you should explore next.
