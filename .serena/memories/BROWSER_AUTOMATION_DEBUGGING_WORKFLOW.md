# Browser Automation Debugging Workflow for SDR Applications

## Overview

When debugging complex browser-based SDR applications, browser automation (Playwright MCP) is invaluable for:

- Reproducing issues consistently
- Capturing real-time console diagnostics
- Verifying UI state transitions
- Testing WebUSB device interactions
- Avoiding manual testing iteration overhead

This guide documents effective patterns learned from debugging rad.io's DSP pipeline.

## Essential Workflow Steps

### 1. Initial Setup and Navigation

**Start dev server first** (HTTPS required for WebUSB):

```typescript
// Verify dev server running
await run_task("Start dev server");
await get_task_output(taskId); // Confirm server started on https://localhost:8080
```

**Launch browser and navigate**:

```typescript
await mcp_microsoft_pla_browser_navigate({ url: "https://localhost:8080" });
await mcp_microsoft_pla_browser_wait_for({ text: "rad.io", time: 5 });
```

### 2. Capture Initial State

**Take accessibility snapshot** (better than screenshot for state inspection):

```typescript
const snapshot = await mcp_microsoft_pla_browser_snapshot();
// Review snapshot for button states, aria-labels, status text
```

**Check for JavaScript errors**:

```typescript
const errors = await mcp_microsoft_pla_browser_console_messages({
  onlyErrors: true,
});
// Empty array = good; errors present = investigate before proceeding
```

### 3. Interact with UI Elements

**Find elements by accessibility attributes** (most reliable):

```typescript
// From snapshot, identify ref and element description
await mcp_microsoft_pla_browser_click({
  element: "Start Reception button",
  ref: 'paragraph [role=button] [name="Start Reception"]',
});
```

**Wait for expected state changes**:

```typescript
await mcp_microsoft_pla_browser_wait_for({
  text: "Stop Reception", // Button label should change
  time: 3,
});
```

### 4. Capture Diagnostic Console Output

**Monitor all console messages** (not just errors):

```typescript
const allMessages = await mcp_microsoft_pla_browser_console_messages({
  onlyErrors: false,
});
```

**Look for key diagnostic patterns**:

- Configuration confirmations: "Sample rate set to X MSPS"
- USB streaming status: "transferIn ok, X bytes"
- Data processing: "Parsed X samples"
- Visualization scheduling: "Visualization update scheduled"
- Error messages: Transfer timeouts, device errors

### 5. Verify Complex State Transitions

**Example: Audio playback activation**:

```typescript
// 1. Take snapshot before click
const beforeSnapshot = await mcp_microsoft_pla_browser_snapshot();

// 2. Click Play Audio button
await mcp_microsoft_pla_browser_click({
  element: "Play Audio button",
  ref: 'button [name="▶ Play Audio"]',
});

// 3. Wait for expected text change
await mcp_microsoft_pla_browser_wait_for({
  text: "⏸ Pause Audio",
  time: 2,
});

// 4. Verify status update
await mcp_microsoft_pla_browser_wait_for({
  text: "🎵 Playing FM audio",
  time: 2,
});

// 5. Check for new console messages
const audioMessages = await mcp_microsoft_pla_browser_console_messages({
  onlyErrors: false,
});
// Filter for audio-related logs
```

### 6. Screenshot for Visual Verification

**When to take screenshots**:

- Complex visualizations (IQ constellation, spectrogram)
- Layout issues
- Visual feedback verification
- User-facing documentation

```typescript
await mcp_microsoft_pla_browser_take_screenshot({
  filename: "visualizers-active.png",
  type: "png",
});
```

**Accessibility snapshot preferred for**:

- Button states (enabled/disabled)
- Text content verification
- ARIA attributes
- Interactive element discovery

### 7. Handle Known Failure Modes

**TimeoutError on click** (element disabled or not interactive):

```typescript
try {
  await mcp_microsoft_pla_browser_click({ element: "...", ref: "..." });
} catch (error) {
  if (error.message.includes("TimeoutError")) {
    // Element became disabled (expected if device stopped streaming)
    // Verify expected state change occurred
    const snapshot = await mcp_microsoft_pla_browser_snapshot();
    // Check snapshot for disabled state
  }
}
```

**Device-level issues** (USB transfer timeouts):

- Not code bugs, but environmental/hardware issues
- Confirm via console messages: "USB transfer timeout"
- Recovery: User must unplug/replug device
- Don't treat as automation failure

### 8. Cleanup and Iteration

**Close browser between test runs**:

```typescript
await mcp_microsoft_pla_browser_close();
```

**Reload page for clean state** (if browser stays open):

```typescript
await mcp_microsoft_pla_browser_navigate({ url: "https://localhost:8080" });
```

## Diagnostic Patterns

### Healthy Streaming Session

**Expected console sequence**:

```
1. "Sample rate set to 2.048 MSPS"
2. "transferIn ok, 4096 bytes" (repeating)
3. "Parsed 2048 samples" (repeating)
4. "Visualization update scheduled" (throttled, ~30 FPS)
5. (If audio clicked) "Audio playback started"
```

**Expected UI states**:

- "Connected" → "Receiving" status
- "Start Reception" → "Stop Reception" button
- Visualizers change from "Waiting for signal data" to active charts
- Audio controls enabled when listening

### Problematic Patterns

**No data despite "Receiving"**:

- Console shows: "transferIn ok" but no "Parsed X samples"
- Root cause: Sample rate not configured before streaming
- Fix: Verify `setSampleRate()` called before `receive()`

**Audio controls enabled but no sound**:

- Console shows: Streaming active, no errors
- Root cause: Sample rate mismatch with AudioStreamProcessor
- Fix: Synchronize rates across all configuration points

**USB transfer timeouts**:

- Console shows: "USB transfer timeout (attempt X/3)"
- Root cause: Device-level issue (firmware, hardware, USB bus)
- Not a code bug: Recovery guidance provided to user

## Code Change Verification Workflow

After making code changes to fix issues:

1. **Rebuild application**:

   ```typescript
   await run_task("Build");
   await get_task_output(taskId); // Confirm success
   ```

2. **Reload browser** (or restart if server restarted):

   ```typescript
   await mcp_microsoft_pla_browser_navigate({ url: "https://localhost:8080" });
   ```

3. **Reproduce exact user scenario**:
   - Same click sequence
   - Same timing
   - Same verification points

4. **Compare console output** before/after:
   - Confirm new configuration values
   - Verify error messages resolved
   - Check for new diagnostic info

5. **Verify state transitions** work end-to-end:
   - UI updates correctly
   - No errors in console
   - Expected functionality active

## WebUSB-Specific Considerations

**Browser security context**:

- WebUSB requires HTTPS (not HTTP)
- Dev server must use SSL certificates
- User gesture required for device selection (automation can't bypass)

**Device selection prompt** (automation limitation):

- Browser shows native OS dialog for device pairing
- Automation cannot interact with OS-level dialogs
- **Workaround**: User must manually select device before automation
- Document in setup instructions: "Pair device before running automation"

**Physical device required**:

- WebUSB automation can't use mock devices
- USB device must be connected and functioning
- Device firmware must be compatible
- Some test scenarios require manual device interaction

## Effective Console Log Analysis

**High-signal patterns to search for**:

- "set to" → Configuration confirmations
- "ok" → Successful operations
- "error" or "Error" → Problems
- "timeout" → Timing issues
- "bytes" → Data transfer info
- "samples" → Data processing info

**Filtering technique** (in code):

```typescript
const messages = await mcp_microsoft_pla_browser_console_messages({
  onlyErrors: false,
});
const relevantMessages = messages.filter(
  (msg) =>
    msg.includes("Sample rate") ||
    msg.includes("transferIn") ||
    msg.includes("Parsed") ||
    msg.includes("Visualization"),
);
```

## Integration with Development Workflow

**Combine automation with code analysis**:

1. Use automation to reproduce issue and capture diagnostics
2. Use `read_file` and `semantic_search` to understand code paths
3. Identify root cause from console output + code review
4. Implement fix with `replace_string_in_file`
5. Rebuild and verify with automation
6. Run quality gates (type-check, lint, tests)

**Don't over-automate**:

- Simple console inspections: Use `get_terminal_output` on dev server
- Type errors: Use `get_errors` tool
- Component behavior: Use `runTests` for unit tests
- Full integration scenarios: Use browser automation

## Troubleshooting Automation Issues

**Browser automation hangs**:

- Check dev server is actually running (not crashed)
- Verify URL is accessible (https://localhost:8080)
- Wait for page load with sufficient timeout
- Check for JavaScript errors blocking page load

**Element not found errors**:

- Take snapshot to verify element exists
- Check element is not disabled (can't click disabled elements)
- Verify ref matches current DOM structure
- Wait for dynamic content to load

**Console messages missing**:

- Some messages logged before automation attached
- Take snapshot at multiple points in interaction
- Use `onlyErrors: false` to see all message types
- Check for console.clear() calls in code

## Best Practices Summary

1. **Start with snapshot** to understand current UI state
2. **Check console errors** before interacting
3. **Use accessibility attributes** for reliable element selection
4. **Wait for expected changes** after interactions
5. **Capture console output** for diagnostic analysis
6. **Take screenshots** for visual verification
7. **Handle timeouts gracefully** (may indicate expected state changes)
8. **Document device requirements** (physical hardware needed)
9. **Clean up** browser sessions between test runs
10. **Combine with other tools** (code search, tests, static analysis)

## Related Files

- `.github/workflows/copilot-setup-steps.md`: General debugging approach
- `.github/copilot-instructions.md`: Project-specific browser testing notes
- `src/pages/Visualizer.tsx`: Main component under test
- Browser automation tools: Playwright MCP (`mcp_microsoft_pla_*`)
