# rad.io MVP Exit Manual Test Plan

## Test Environment

- Browser: Chrome or Edge current stable.
- OS: Windows 11 (primary), macOS/Linux optional cross-check.
- Build under test: release candidate commit.
- Start command: `npm start`.
- Use deterministic source first (Mock), then hardware pass if available.

## Journey 1: First Signal (Mock)

1. Launch app and wait for UI idle state.
2. Select Mock source and start stream.
3. Verify spectrum and waterfall both begin updating.
4. Tune by entering a different frequency.
5. Verify signal location and frequency readout update.

Pass criteria:

- First spectrum appears within 2.0s.
- First waterfall appears within 2.5s.
- No console errors.

## Journey 2: Listen (WFM)

1. With source running, set mode to WFM.
2. Enable audio output.
3. Observe output for 2 minutes.
4. Toggle mute and unmute.

Pass criteria:

- Audible output is present after unmute.
- No audible crackle under normal load.
- Mute/unmute reflects immediately.

## Journey 3: AM Demod Path

1. Switch mode to AM.
2. Tune to AM fixture peak or synthetic carrier.
3. Adjust bandwidth control (if exposed).
4. Observe demod output behavior and UI state.

Pass criteria:

- AM path activates without exception.
- Audio output changes with bandwidth adjustments.
- UI remains responsive.

## Journey 4: Recovery From Disconnect

1. Start stream on hardware if available; otherwise force source stop mid-run.
2. Trigger disconnect condition (unplug device or simulated disconnect action).
3. Verify UI shows disconnected/recovery state.
4. Reconnect device/source.
5. Resume streaming.

Pass criteria:

- Disconnect is surfaced clearly with a recovery action.
- Reconnect succeeds without page reload.
- Prior tune/mode settings are restored or explicitly reset with notice.

## Journey 5: Audio Context Recovery

1. Reload app and avoid any user gesture that enables audio.
2. Start source and attempt audio playback.
3. Verify blocked audio state message/action appears.
4. Perform required user gesture and enable audio.

Pass criteria:

- User sees explicit action to enable audio.
- Audio starts after gesture.
- No reload required.

## Journey 6: Stability Run

1. Start Mock source with visuals and audio enabled.
2. Let app run for 10 minutes.
3. Every 2 minutes perform a tune change.
4. Capture console and any diagnostic counters at end.

Pass criteria:

- No uncaught exceptions.
- UI remains responsive.
- Underrun/drop metrics stay within MVP budgets.

## Recording Evidence

Record for each journey:

- Date/time and commit hash.
- Browser and OS.
- Pass/fail outcome.
- Screenshot(s) for key states.
- Notes for anomalies and follow-up issue IDs.
