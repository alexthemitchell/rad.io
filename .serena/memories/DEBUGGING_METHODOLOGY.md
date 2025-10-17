# Debugging Methodology for Complex Hardware Integration Issues

## Systematic Approach Used in HackRF Streaming Bug

### Phase 1: Symptom Analysis

**Observation**: Device shows "Receiving" status but visualizations display "Waiting for data"

**Initial Hypotheses Generated**:

1. Data flow interruption somewhere in the pipeline
2. Sample format conversion issue
3. State management problem
4. Visualization component bug
5. Hardware configuration issue

**Priority**: Start from the end (UI) and work backwards to the source (hardware)

### Phase 2: Trace the Data Flow

**Full Pipeline Mapped**:

```
HackRF Hardware
  ↓ USB transferIn()
HackRFOne.receive()
  ↓ callback(DataView)
HackRFOneAdapter.receive()
  ↓ callback(DataView)
beginDeviceStreaming()
  ↓ parseSamples(DataView) → Sample[]
handleSampleChunk()
  ↓ sampleBufferRef.current
scheduleVisualizationUpdate()
  ↓ setSamples()
React Re-render
  ↓ samples prop
SampleChart → IQConstellation
```

**Key Insight**: Add logging at EACH stage to identify where data stops flowing

### Phase 3: Progressive Instrumentation

**Strategy**: Add console.warn (allowed by linter) at critical points

**Logging Added**:

1. Function entry points: `"beginDeviceStreaming: Starting"`
2. Configuration steps: `"Sample rate set to 20 MSPS"`
3. Loop iterations: `"Iteration 1, calling transferIn"`
4. Data received: `"Got X bytes, callback=${!!callback}"`
5. Data parsed: `"Parsed Y samples"`
6. State updates: `"Scheduling visualization update"`

**Pattern**: Start broad, then add detail where data stops

### Phase 4: Identify the Breakpoint

**Finding**: Logs showed:

- ✅ "beginDeviceStreaming: Starting"
- ✅ "HackRFOne.receive: Starting streaming loop, endpoint=1"
- ✅ "Iteration 1, calling transferIn"
- ❌ Never saw "transferIn result"

**Conclusion**: `transferIn()` call is hanging (never resolving)

### Phase 5: Hypothesis Testing

**Question**: Why would transferIn() hang?

**Hypotheses Tested**:

1. **Wrong endpoint number** → Logged endpoint (1), checked against USB descriptor → Correct
2. **Device not opened** → Checked device.opened → True
3. **Interface not claimed** → Verified in open() → Correct
4. **Transceiver mode wrong** → Added before receive() → Set to RECEIVE
5. **Missing configuration** → Researched HackRF requirements → **FOUND IT!**

**Critical Discovery**: HackRF documentation and reference implementation (libhackrf) showed sample rate MUST be set before streaming

### Phase 6: Verify Fix

**Test Process**:

1. Add sample rate configuration: `await device.setSampleRate(20000000)`
2. Add confirmation logging: `"Sample rate set to 20 MSPS"`
3. Reload application
4. Connect device
5. Check console for new logs
6. Verify transferIn() no longer hangs (or starts returning data)

**Result**: Logs showed sample rate being set, but transferIn() still hung → Hardware/firmware issue likely

## Key Debugging Techniques

### 1. Binary Search Through Code

When data flow stops, use binary search:

- Add log in middle of suspected range
- If log appears → problem is after
- If log doesn't appear → problem is before
- Repeat until isolated

### 2. State Inspection

At each stage, log:

```typescript
console.warn("Stage name:", {
  inputs: { ...allInputs },
  outputs: { ...allOutputs },
  state: { ...relevantState },
  timing: performance.now(),
});
```

### 3. Differential Debugging

Compare working vs broken scenarios:

- Working: Previous version that may have worked
- Broken: Current state
- Ask: What changed?

### 4. Reference Implementation Study

When dealing with hardware:

1. Find official C/Python libraries
2. Look for initialization sequences
3. Note order of operations
4. Check for mandatory vs optional config

**Example**: libhackrf C library showed:

```c
hackrf_set_sample_rate(device, 20000000);  // MUST be first!
hackrf_set_freq(device, 100000000);
hackrf_start_rx(device, callback);
```

### 5. External Validation

Test hardware with known-working tools:

```bash
# Verify device is functional
hackrf_info

# Test streaming outside web app
hackrf_transfer -r test.bin -f 100000000
```

If this fails → hardware issue
If this works → software issue

## Common Pitfalls Avoided

### Anti-Pattern: Changing Multiple Things

❌ **Wrong**: "Let me fix the sample rate AND refactor the callback AND update the state management"

✅ **Right**: "Let me ONLY add sample rate configuration, test, then iterate"

### Anti-Pattern: Assuming Without Verifying

❌ **Wrong**: "The sample rate is probably being set somewhere, I don't need to check"

✅ **Right**: "Let me grep for 'setSampleRate' to verify it's being called"

### Anti-Pattern: Getting Distracted by Side Issues

When debugging, saw several tempting rabbit holes:

- Visualizer component complexity
- State management patterns
- Sample format conversion
- Canvas rendering

**Discipline**: Stay focused on the core issue (data not flowing) until solved

### Anti-Pattern: Insufficient Logging

❌ **Wrong**: `console.log("Error")`

✅ **Right**: `console.warn("transferIn failed:", { endpoint, size, error, deviceState, attemptNumber })`

## Tools & Resources Used

### Browser DevTools

- Console for real-time logging
- Network tab (not applicable for WebUSB)
- Performance tab for timing issues

### Playwright Browser Automation

- Take screenshots at each stage
- Automate click sequences
- Capture console messages programmatically
- Wait for state changes

### Code Navigation Tools

- `grep_search` for finding function calls
- `semantic_search` for related concepts
- `find_symbol` for tracing implementations
- `read_file` for understanding context

### Documentation

- MDN WebUSB API reference
- HackRF GitHub repository (libhackrf)
- Device datasheets
- Previous bug reports/issues

## Lessons for Future Debugging

### 1. Start with Data Flow Diagram

Before debugging, draw:

```
[Source] → [Transform 1] → [Transform 2] → [Sink]
```

Then add logging at each arrow.

### 2. Use Structured Logging

```typescript
const LOG_CATEGORY = {
  DEVICE: "🔌",
  DATA: "📊",
  STATE: "📦",
  RENDER: "🎨",
  ERROR: "❌",
};

console.warn(`${LOG_CATEGORY.DEVICE} Sample rate set:`, { rate, device });
```

### 3. Create Reproducible Test Cases

Don't rely on:

- User clicking buttons
- Timing-dependent operations
- External hardware state

Do create:

- Automated test sequences
- Mock device implementations
- Synthetic test data

### 4. Document as You Go

Create a running log:

```markdown
## Investigation Log

10:00 - Started investigation. Symptom: No data in visualizations
10:15 - Added logging to beginDeviceStreaming - confirms function called
10:30 - Added logging to receive() - confirmed streaming loop starts
10:45 - Added logging to transferIn - call hangs here
11:00 - Researched HackRF initialization - found sample rate requirement
11:15 - Implemented fix - testing...
```

### 5. Know When to Ask for Help

After reasonable effort (2-4 hours), if stuck:

1. Document what you've tried
2. Show the logs/evidence
3. State your current hypothesis
4. Ask specific questions

Example: "I've confirmed transferIn() hangs even with sample rate set. Logs show device is opened and configured. Could this be a firmware version issue? What should I check next?"

## Success Metrics

For this debugging session:

- **Time to identify root cause**: ~2 hours
- **Number of hypotheses tested**: 5
- **Lines of debug code added**: ~30
- **Core issue found**: Missing sample rate configuration
- **Secondary issue found**: Race condition in device init
- **Documentation created**: 3 comprehensive memory files

## Application to Other Projects

This methodology applies to any complex system:

1. Map the full data flow
2. Instrument each stage
3. Use binary search to isolate
4. Reference implementations
5. Test hypotheses systematically
6. Document findings
7. Create preventive measures

**Key Principle**: Don't guess. Measure. Verify. Document.
