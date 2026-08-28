# HackRF And WebUSB Core

- Receive-only HackRF One identity is USB `1d50:6089`. Browser permission starts on the window from a user Connect action; the acquisition worker reuses authorized devices via `navigator.usb.getDevices()`. Some Chromium setups use the same transport on the main thread when worker WebUSB is unavailable.
- Startup discovers the vendor bulk-IN endpoint, forces transceiver/antenna bias/RF amplifier off, applies sample rate/filter/frequency/gains, then enters RX. Stop turns transceiver off, aborts/ends reads, releases the interface, and closes the device.
- Raw samples are signed interleaved i8 IQ divided by 128 into the analyzer's interleaved `Float32` contract.
- Sequential 16 KiB USB reads continue regardless of rendering. Exact FFT blocks are assembled; only the newest display-eligible block is retained and submissions are paced by sample-rate/frame-rate. Older display blocks are discarded, not queued.
- The sole output buffer transfers to DSP and returns through `input-released`; USB draining must continue while DSP owns it. Transfer stalls get bounded `clearHalt`; discontinuity resets decoder synchronization.
- Full-rate live RDS branches before display throttling and stays in the acquisition owner. Only target changes and coalesced low-rate metadata cross worker boundaries.
- No `libhackrf`, native helper, extension, firmware mutation, OS branch, or driver installer exists. Host USB policy remains authoritative; Linux denial must be reported, not bypassed. Production WebUSB requires HTTPS.
- Use `e2e/hackrf.spec.ts`, source/session/protocol unit tests, and the `sdr-hardware-verification` skill for changes in this area. Read `mem:rds/core` for the full-rate decode branch and `mem:frontend/core` for returned-buffer semantics.