# Keyboard-Only Flows

## Purpose

Define deterministic keyboard-only execution paths for core MVP user journeys.

## Flow 1: Connect Source

1. Press `Tab` until source select is focused.
2. Press `Enter` to open options.
3. Use `ArrowDown` or `ArrowUp` to choose source.
4. Press `Enter` to commit.
5. Press `Tab` to `Start` button.
6. Press `Enter` to start pairing/connection.

Expected focus after major action:

- After source commit: focus returns to source trigger.
- After `Start`: focus remains on `Start` button while status updates in live region.

## Flow 2: Start Stream And Verify Running State

1. From connected state, press `Tab` to primary stream control.
2. Press `Enter` on `Start`.
3. Wait for `streaming` announcement.
4. Press `Tab` to frequency input for next task.

Expected focus after major action:

- After stream starts: focus remains stable and does not jump to canvas.

## Flow 3: Tune Via Frequency Input

1. Press `Tab` to frequency input.
2. Type a value (example `146.520`).
3. Press `Enter` to commit.
4. If invalid, correct value and press `Enter` again.

Expected focus after major action:

- On valid commit: focus stays on frequency input.
- On invalid commit: focus stays on frequency input and error is announced.

## Flow 4: Tune Via Keyboard Steps (Visual Equivalent)

1. Ensure focus is not inside text input.
2. Press `ArrowRight` for one positive tune step.
3. Press `ArrowLeft` for one negative tune step.
4. Press `Shift + ArrowRight` for large positive step.
5. Press `Alt + ArrowLeft` for fine negative step.

Expected focus after major action:

- Focus remains on previously focused control or canvas region label.

## Flow 5: Mute And Unmute Audio

1. Press `Tab` to mute toggle/button.
2. Press `Space` (or `Enter`) to mute.
3. Confirm `muted` announcement.
4. Press `Space` (or `Enter`) again to unmute.

Expected focus after major action:

- Focus remains on mute control for reversible action.

## Flow 6: Recover From Disconnect/Error

1. Trigger or simulate disconnect.
2. Use `Tab` to reach error banner primary action.
3. Press `Enter` on `Reconnect` or `Retry`.
4. If still failing, `Tab` to `Export Diagnostics` and press `Enter`.

Expected focus after major action:

- Focus remains within banner actions until state resolves.
- On successful recovery, focus returns to primary control bar.

## Flow 7: Audio Enablement After Autoplay Block

1. Start stream with audio not yet authorized.
2. Use `Tab` to `Enable Audio` action.
3. Press `Enter` to perform required user gesture path.
4. Confirm `running` or `muted` audio state announcement.

Expected focus after major action:

- Focus remains on action control; no modal dead-end.
