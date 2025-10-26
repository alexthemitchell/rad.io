# HackRF Device Initialization: Comprehensive Setup Guide (October 2025)

## Critical Requirements Summary

**Primary Requirement**: HackRF devices **MUST** have sample rate configured before streaming data. WebUSB `transferIn()` hangs indefinitely without it.

**Recommended Configuration Order**:

1. Sample rate (≥8 MHz recommended, 20 MHz default)
2. Center frequency (1 MHz - 6 GHz)
3. Bandwidth (≥1.75 MHz, matched to sample rate)
4. Gains (LNA: 0-40 dB in 8 dB steps)
5. Amplifier enable (optional)

## Initialization Sequence (WebUSB/rad.io)

```typescript
// 1. Open device
await device.open();
await device.selectConfiguration(1);
await device.claimInterface(0);

// 2. Configure BEFORE streaming (CRITICAL)
await device.setSampleRate(20_000_000); // 20 MSPS
await device.setFrequency(100_000_000); // 100 MHz
await device.setBandwidth(20_000_000); // 20 MHz (optional)
await device.setLNAGain(16); // 16 dB (optional)
await device.setAmpEnable(false); // disabled (optional)

// 3. Start streaming
await device.receive(callback); // Sets transceiver mode to RECEIVE
```

## libhackrf C Reference (Canonical Order)

```c
hackrf_init();                          // Initialize library
hackrf_open(&device);                   // Open device
hackrf_set_sample_rate(device, rate);   // Set sample rate first
hackrf_set_freq(device, freq_hz);       // Set center frequency
hackrf_set_baseband_filter_bandwidth(device, bw_hz); // Optional
hackrf_set_lna_gain(device, gain_db);   // Optional
hackrf_set_amp_enable(device, enable);  // Optional
hackrf_start_rx(device, callback);      // Start streaming
```

**Source**: https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c

## Sample Rate Best Practices

**Minimum Recommended**: 8 MHz (not hardware minimum)

- Below 8 MHz causes aliasing due to MAX2837 analog filter limitations (1.75 MHz min bandwidth)
- MAX5864 ADC/DAC not optimized for lower rates

**Supported Range**: 1.75 MHz - 28 MHz (HackRF One), up to 40 MHz internally (HackRF Pro)

**Default in rad.io**: 20 MHz (20,000,000 Hz)

**Why sample rate first**: Device needs to know bandwidth before configuring other parameters. Some settings depend on sample rate.

## Common Hardware Failure Modes

### 1. Device Not Responding (transferIn hangs)

- **Cause**: Sample rate not set
- **Solution**: Always call `setSampleRate()` before `receive()`

### 2. Aliasing/Poor Signal Quality

- **Cause**: Sample rate too low (<8 MHz)
- **Solution**: Use ≥8 MHz, perform software decimation if lower rate needed

### 3. USB Bandwidth Exceeded

- **Cause**: Sample rate too high for USB link
- **Solution**: HackRF One max 20 MSPS over USB 2.0

### 4. Device Needs Physical Reset

- **Symptoms**: Commands fail, device unresponsive
- **Solution**: Unplug/replug USB or press reset button

## Diagnostic Commands

Verify device health before using web application:

```bash
# Check device info and firmware version
hackrf_info

# Test streaming (receive 1M samples at 10 MSPS)
hackrf_transfer -r /tmp/test.bin -f 100000000 -s 10000000 -n 1000000

# Spectrum sweep test
hackrf_sweep -f 88:108

# Check clock configuration
hackrf_clock -a
```

**Firmware Update**:

```bash
# Download latest from https://github.com/greatscottgadgets/hackrf/releases
hackrf_spiflash -w hackrf_one_usb.bin
```

**Recommended Firmware**: 2018.01.1 or later

## Recovery Steps Priority

1. **Software reset** via API (`device.reset()` or `device.fastRecovery()`)
2. **Unplug/replug USB** cable (wait 5 seconds)
3. **Press reset button** on HackRF board
4. **Try different USB port** (prefer USB 3.0)
5. **Verify with CLI tools** (`hackrf_info`, `hackrf_transfer`)

## Code Locations

- **Device class**: `src/hackrf/HackRFOne.ts`
- **Adapter**: `src/hackrf/HackRFOneAdapter.ts`
- **Page lifecycle**: `src/pages/Visualizer.tsx` (beginDeviceStreaming)

## References

- HackRF documentation: https://hackrf.readthedocs.io/en/latest/
- libhackrf API: https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.h
- Sample rate guide: https://hackrf.readthedocs.io/en/latest/sampling_rate.html
- Memory: HACKRF_PROTECTIVE_MEASURES_IMPLEMENTATION (timeout protection)
- Memory: HACKRF_ERROR_HANDLING_ENHANCEMENT_2025 (recovery APIs)
- Doc: docs/reference/hackrf-troubleshooting.md
