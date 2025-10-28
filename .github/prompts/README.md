# Agent Prompts

This directory contains specialized prompts to assist AI agents with specific development and testing tasks for the rad.io project.

## Available Prompts

### `test-real-hardware-e2e.md`

**Purpose**: Guide an agent through manual end-to-end testing with a real HackRF device connected via USB.

**When to use**:

- Before major releases to verify WebUSB integration
- After changes to device connection logic (`useUSBDevice`, `useHackRFDevice`, `DeviceContext`)
- When debugging hardware-specific issues reported by users
- To validate auto-reconnect and pairing behavior

**Prerequisites**:

- Physical HackRF One device connected via USB
- Dev server running (`npm start`)
- Chrome or Edge browser with WebUSB support

**Key tasks**:

- Device pairing verification (requires manual user interaction)
- Auto-reconnect testing after browser restart
- Start/Stop reception validation
- Device replug handling
- Error scenario testing

**Note**: Uses Playwright MCP browser tools for semi-automation, but WebUSB device picker requires manual user selection (cannot be fully automated).

## How to Use These Prompts

### For Human Developers

1. Read the prompt file to understand the testing procedure
2. Follow the step-by-step instructions
3. Use the MCP browser tools or manual browser interaction
4. Document results and any issues found

### For AI Agents

1. Agent should read the prompt file completely before starting
2. Follow the workflow systematically
3. Use MCP tools where applicable
4. Understand manual interaction limitations (especially WebUSB pairing)
5. Report results with screenshots and detailed observations

### Example: Invoking Hardware Testing

```text
Please test the real HackRF hardware using the prompt in .github/prompts/test-real-hardware-e2e.md.
I have a HackRF One connected and the dev server is running.
```

The agent will:

1. Read the prompt and understand requirements
2. Use MCP browser tools to navigate and capture state
3. Pause for manual WebUSB device selection
4. Continue with automated verification
5. Report results with screenshots

## Adding New Prompts

When creating new prompts, follow this structure:

1. **Context**: What is being tested/accomplished?
2. **Prerequisites**: Required setup before starting
3. **Your Task**: Clear statement of what to do
4. **Workflow**: Step-by-step instructions with code examples
5. **Verification**: How to confirm success
6. **Troubleshooting**: Common issues and solutions
7. **Reporting**: What to document and how
8. **Related Files**: Links to relevant code/docs

## Related Documentation

- Manual test checklist: `e2e/monitor-real-manual.md`
- E2E testing guide: `docs/e2e-tests.md`
- WebUSB limitations: Memory `PLAYWRIGHT_WEBUSB_LIMITATION_2025`
- Auto-connect behavior: Memory `WEBUSB_AUTO_CONNECT`
