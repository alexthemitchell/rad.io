# Architecture Validation Spike Plan

**Goal:** Validate that the proposed `Worker → RingBuffer → AudioWorklet` architecture can sustain audio without dropouts while under load.

**Constraint:** No physical hardware (HackRF) is currently attached to the agent environment. We will use a **Mock Source** (simulated sine wave generator) to stress the pipeline.

## 1. The Experiment
We will build a minimal "tracer bullet" app with:
1.  **Main Thread:** UI Controls (Start/Stop/Load).
2.  **Worker Thread:** Generates IQ samples (simulating USB input) + Does FFT math (simulating DSP load).
3.  **AudioWorklet:** Consumes samples from a `SharedArrayBuffer` ring buffer and outputs audio.

## 2. Measurement Targets
| Metric | Budget | Test Method |
| :--- | :--- | :--- |
| **Audio Latency** | < 50ms | Inject click in Worker, measure time to AudioWorklet output (timestamp diff). |
| **Drop Rate** | < 0.1% | Run for 60s, count ring buffer under-runs. |
| **CPU Load** | No jank | Add "busy wait" loop to Worker to simulate DSP load (10ms per block). |

## 3. Execution Plan
1.  Initialize a temporary `spike/` folder in the repo.
2.  Create `index.html` (UI), `worker.js` (Source/DSP), `processor.js` (Audio).
3.  Run a local server.
4.  Capture console logs for jitter/drops.

## 4. Success Condition
- [ ] Audio plays clearly (sine wave).
- [ ] No "crackling" (underruns) reported in logs over 60s run.
- [ ] Simulated load does not kill audio.
