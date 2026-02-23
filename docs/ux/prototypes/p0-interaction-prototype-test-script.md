# P0 Interaction Prototype Test Script

## Session Setup

- Session length target: 30 to 40 minutes.
- Roles: facilitator, participant, observer.
- Capture: timestamps, quote snippets, observed errors, confidence rating.

## Observer Prompts

- "What do you think will happen when you press that?"
- "How confident are you that the system is in a healthy state?"
- "What would you do next if this action fails?"
- "Was any feedback unclear or delayed?"

## Tasks

### Task 1: Connect Source

Steps:

1. Select a source.
2. Start connection.
3. Confirm connected state.

Expected outcome:

- Participant identifies current connection state and next action.

### Task 2: Start Streaming

Steps:

1. Activate `Start`.
2. Confirm transition to streaming.

Expected outcome:

- Streaming status is clearly discoverable without searching secondary panels.

### Task 3: Tune Via Input

Steps:

1. Focus frequency input.
2. Enter `146.520` and commit.

Expected outcome:

- Commit behavior is predictable and confirmation is visible.

### Task 4: Tune Via Visual/Keyboard Equivalent

Steps:

1. Retune using spectrum click or drag gesture.
2. Repeat using keyboard step commands.

Expected outcome:

- Participant sees both methods as consistent and reversible.

### Task 5: Enable Audio

Steps:

1. Attempt playback in blocked-audio state.
2. Use explicit user-gesture action to enable audio.

Expected outcome:

- Participant understands why audio is blocked and how to resolve it.

### Task 6: Mute And Unmute

Steps:

1. Mute output.
2. Unmute output.

Expected outcome:

- State label and behavior changes are immediate and unambiguous.

### Task 7: Trigger Planned Failure

Steps:

1. Simulate disconnect or runtime stream failure.
2. Observe presented recovery actions.

Expected outcome:

- Participant can explain next recovery action in one attempt.

### Task 8: Recover And Return To Stable Receiving

Steps:

1. Use `Reconnect` or `Retry`.
2. Restore stable stream.
3. Verify tune/audio state continuity.

Expected outcome:

- Recovery works without page reload and with clear status updates.

### Task 9: Open Shortcuts Overlay And Execute One Shortcut

Steps:

1. Open shortcut help.
2. Use one tuning shortcut.

Expected outcome:

- Shortcut discoverability is sufficient for first use.

## Severity Scale

- High: blocks completion, causes wrong state, or creates unsafe confusion.
- Medium: slows completion or requires repeated retries.
- Low: minor friction with clear workaround.
