# HackRF Troubleshooting Guide

## Overview

This guide documents common error states, recovery patterns, and troubleshooting steps for HackRF devices in the rad.io application.

## Quick Diagnostics

### Device Diagnostics Panel

The application includes a built-in diagnostics panel that displays real-time device status:

1. **Access**: Click the "🔍 Diagnostics" button in the Device Control Bar
2. **Status Indicators**:
   - ✓ Green: Operating normally
   - ⚠ Yellow: Warning, attention needed
   - ✗ Red: Error, action required
   - ℹ Blue: Informational

### Diagnostic Information Displayed

- **Device Connection**: USB connection status
- **Streaming Status**: Active reception state
- **Frequency**: Current center frequency configuration
- **Error Messages**: Specific error details with context

## Common Error States

### 1. Device Not Responding (Timeout)

**Symptoms**:

- Status shows "Receiving" but no data appears
- Console shows "USB transfer timeout" messages
- After 3 consecutive timeouts, automatic recovery is attempted

**Causes**:

- USB communication failure
- Device firmware hung
- Insufficient USB power
- Driver conflict

**Automatic Recovery**:
The system automatically attempts recovery after 3 consecutive timeouts:

1. Sends USB reset command
2. Restores device configuration (sample rate, frequency, bandwidth, gains)
3. Restarts transceiver mode
4. Resumes streaming

**Manual Recovery Steps**:

1. **Software Reset** (First Try):
   - Click "🔄 Reset Device" button in diagnostics panel
   - Wait for confirmation message
   - Try starting reception again

2. **Physical Reset** (If software reset fails):
   - Unplug USB cable and wait 5 seconds
   - Replug USB cable
   - Reconnect device in application

3. **Hardware Reset** (Persistent issues):
   - Press the physical RESET button on HackRF board
   - Wait for LED to blink
   - Reconnect device in application

4. **USB Port Change**:
   - Try a different USB port (preferably USB 3.0)
   - Avoid USB hubs when possible
   - Use shielded USB cables

5. **Verify with CLI Tools**:

   ```bash
   # Check device detection
   hackrf_info

   # Test data streaming
   hackrf_transfer -r /dev/null -f 100000000 -n 1000000
   ```

### 2. Sample Rate Not Configured

**Symptoms**:

- Error: "Sample rate not configured"
- Cannot start reception
- Device validation fails

**Cause**:
HackRF **requires** sample rate configuration before streaming. Without it, USB `transferIn()` hangs indefinitely.

**Solution**:
This is automatically handled by the application, but if you encounter this error:

1. Ensure device is properly initialized
2. Sample rate is set during device setup
3. If error persists, try disconnecting and reconnecting

**Technical Details**:

- Sample rate range: 1.75 MHz - 28 MHz
- Default: 20 MSPS (20,000,000 Hz)
- Must be set before calling `receive()`

### 3. Device Not Open

**Symptoms**:

- Error: "Device is not open"
- Cannot configure device settings
- Cannot start streaming

**Causes**:

- Device was closed unexpectedly
- WebUSB permission revoked
- Browser security restriction

**Solution**:

1. Disconnect device in application
2. Click "Connect Device" button
3. Select HackRF from WebUSB device picker
4. Grant necessary permissions

### 4. Configuration Failures

**Symptoms**:

- "Failed to set frequency" error
- "Failed to set sample rate" error
- Settings not taking effect

**Causes**:

- Invalid parameter values
- Device in wrong state
- USB communication error

**Solution**:

1. Verify parameter ranges:
   - Frequency: 1 MHz - 6 GHz
   - Sample Rate: 1.75 MHz - 28 MHz
   - LNA Gain: 0-40 dB (8 dB steps)
   - Bandwidth: Device will round to nearest supported value

2. Check device state:
   - Device must be open
   - Device must not be closing
   - Previous configuration must complete

3. Try software reset if configuration fails repeatedly

### 5. Firmware Compatibility

**Symptoms**:

- Unexpected behavior
- Intermittent errors
- Device works with CLI but not application

**Cause**:
Outdated or incompatible firmware

**Solution**:

1. Check current firmware version:

   ```bash
   hackrf_info
   ```

2. Update firmware if needed:

   ```bash
   # Download latest firmware from https://github.com/greatscottgadgets/hackrf/releases
   hackrf_spiflash -w hackrf_one_usb.bin
   ```

3. Recommended firmware version: 2018.01.1 or later

### 6. Power Issues

**Symptoms**:

- Device disconnects randomly
- Unstable operation
- Resets during use

**Causes**:

- Insufficient USB power
- Weak USB port
- Multiple devices on same hub

**Solution**:

1. Connect directly to computer USB port (no hub)
2. Use USB 3.0 port for more power
3. Try powered USB hub if available
4. Remove other USB devices
5. Check USB cable quality

### 7. WebUSB Permission Issues

**Symptoms**:

- Cannot connect to device
- Device not appearing in picker
- "User cancelled" error

**Browser Requirements**:

- Chrome/Edge 61+ or Chromium-based browsers
- HTTPS connection (or localhost)
- WebUSB enabled

**Solution**:

1. Check browser compatibility
2. Ensure page is served over HTTPS
3. Check browser permissions:
   - Chrome: `chrome://settings/content/usbDevices`
   - Edge: `edge://settings/content/usbDevices`
4. Try incognito/private mode
5. Clear browser cache and reload

## Error Recovery Workflow

```
┌─────────────────┐
│  Error Occurs   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Diagnostics│
│     Panel        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Yes    ┌──────────────┐
│ Timeout Error?  ├────────────▶│ Wait for Auto│
└────────┬────────┘             │  Recovery    │
         │ No                   └──────┬───────┘
         ▼                             │
┌─────────────────┐                   │
│ Config Error?   │     Yes    ┌──────▼───────┐
├─────────────────┤────────────▶│ Try Software │
│ Connection?     │             │    Reset     │
└────────┬────────┘             └──────┬───────┘
         │ No                          │
         ▼                             │
┌─────────────────┐                   │
│  Other Error?   │                   │
└────────┬────────┘                   │
         │                             │
         ▼                             ▼
┌─────────────────┐            ┌──────────────┐
│ Physical Reset  │◀───Fail────│  Success?    │
│  Unplug/Replug  │            └──────┬───────┘
└────────┬────────┘                   │ Success
         │                             ▼
         ▼                      ┌──────────────┐
┌─────────────────┐             │   Resume     │
│ Verify with CLI │             │  Operation   │
│     Tools       │             └──────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Report Issue if │
│  Still Failing  │
└─────────────────┘
```

## Diagnostic Logging

### Enable Development Logging

The application includes comprehensive logging for debugging. Logging is automatically enabled in development mode.

**To enable in production**:

1. Open browser console (F12)
2. Type: `localStorage.setItem('debug', 'hackrf:*')`
3. Reload page

**Key Log Messages**:

```
HackRFOne.receive: Starting streaming loop
HackRFOne.receive: USB transfer timeout
HackRFOne.receive: Max timeouts reached, initiating automatic recovery
HackRFOne.fastRecovery: Starting automatic recovery
HackRFOne.fastRecovery: Device recovered and reconfigured successfully
HackRFOne.reset: Initiating software reset
```

### Reading Logs

1. **Normal Operation**:

   ```
   HackRFOne.receive: Starting streaming loop
   HackRFOne.receive: Requesting USB transfer (iteration 1)
   HackRFOne.receive: USB transfer completed (status: ok, bytes: 4096)
   HackRFOne.receive: Data received, invoking callback
   ```

2. **Timeout with Recovery**:

   ```
   HackRFOne.receive: USB transfer timeout (consecutiveCount: 1)
   HackRFOne.receive: USB transfer timeout (consecutiveCount: 2)
   HackRFOne.receive: USB transfer timeout (consecutiveCount: 3)
   HackRFOne.receive: Max timeouts reached, initiating automatic recovery
   HackRFOne.fastRecovery: Starting automatic recovery
   HackRFOne.fastRecovery: Device recovered successfully
   HackRFOne.receive: Automatic recovery successful, resuming stream
   ```

3. **Failed Recovery**:
   ```
   HackRFOne.receive: Max timeouts reached, initiating automatic recovery
   HackRFOne.fastRecovery: Starting automatic recovery
   HackRFOne.receive: Automatic recovery failed
   Error: Device not responding after automatic recovery attempt
   ```

## Technical Implementation Details

### Device Health Validation

Before streaming begins, the system validates:

1. **Device State**: Must be open and not closing
2. **Sample Rate**: Must be configured (critical requirement)
3. **Configuration**: Device must be in valid state

### Timeout Protection

USB transfers have built-in timeout protection:

- **Timeout Duration**: 5 seconds per transfer
- **Max Consecutive Timeouts**: 3 before triggering recovery
- **Recovery Actions**: Automatic reset and reconfiguration

### Fast Recovery Process

When automatic recovery is triggered:

1. Send USB reset command
2. Wait 150ms for device stabilization
3. Restore last known configuration:
   - Sample rate
   - Frequency
   - Bandwidth
   - LNA gain
   - Amplifier state
4. Set transceiver mode to RECEIVE
5. Resume streaming

### Configuration State Tracking

The device maintains state for recovery:

- Last sample rate
- Last frequency
- Last bandwidth
- Last LNA gain
- Last amplifier enable state

This allows seamless reconfiguration after reset.

## Best Practices

### For Users

1. **Always use good quality, shielded USB cables**
2. **Connect to USB 3.0 ports when available**
3. **Keep firmware updated**
4. **Test device with CLI tools before web application**
5. **Use software reset before physical intervention**
6. **Monitor diagnostics panel for early warnings**

### For Developers

1. **Always set sample rate before calling receive()**
2. **Check device health before configuration changes**
3. **Handle timeout errors gracefully**
4. **Log errors with context for debugging**
5. **Provide clear user feedback for errors**
6. **Test error recovery paths**

## Reference Materials

### Official Documentation

- [HackRF Documentation](https://hackrf.readthedocs.io/en/latest/)
- [libhackrf C Reference](https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c)
- [WebUSB API Specification](https://wicg.github.io/webusb/)

### Internal Documentation

- Memory: `HACKRF_DEVICE_INITIALIZATION_BUG_FIX` - Details on sample rate requirement
- Memory: `HACKRF_PROTECTIVE_MEASURES_IMPLEMENTATION` - Timeout and recovery implementation
- Memory: `WEBUSB_SDR_INTEGRATION_PLAYBOOK` - WebUSB integration patterns
- ADR-0011: Error Handling and Resilience Strategy

### Hardware Resources

- HackRF One Hardware: https://greatscottgadgets.com/hackrf/
- Firmware Updates: https://github.com/greatscottgadgets/hackrf/releases
- Community Support: https://github.com/greatscottgadgets/hackrf/issues

## Reporting Issues

If you encounter persistent issues:

1. **Collect Information**:
   - Browser version and type
   - Operating system
   - HackRF firmware version (from `hackrf_info`)
   - Console logs (including errors)
   - Diagnostics panel status
   - Steps to reproduce

2. **Test with CLI Tools**:
   - Run `hackrf_info`
   - Try `hackrf_transfer`
   - Document results

3. **File Issue**:
   - Include all collected information
   - Describe expected vs actual behavior
   - Note any error messages
   - Mention recovery attempts made

## Appendix: Error Codes

### USB Transfer Errors

- `timeout`: No response from device within 5 seconds
- `stall`: Device endpoint stalled (protocol error)
- `babble`: Device sent more data than expected
- `AbortError`: Transfer cancelled (expected during shutdown)

### Configuration Errors

- `Device is not open`: Device not in open state
- `Device is closing`: Shutdown in progress
- `Sample rate not configured`: Critical pre-streaming requirement not met
- `Invalid parameter`: Configuration value out of acceptable range

### Recovery Errors

- `Failed to reset device`: USB reset command failed
- `Device not responding after automatic recovery`: Recovery unsuccessful, manual intervention needed
- `Reset failed`: General reset operation failure

## Version History

- **v1.0** (2025-10-26): Initial troubleshooting guide
  - Documented common error states
  - Added recovery workflows
  - Included diagnostic information
  - Added best practices
