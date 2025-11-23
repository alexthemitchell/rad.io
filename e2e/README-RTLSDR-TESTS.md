# RTL-SDR Device Testing

This directory contains end-to-end tests for RTL-SDR devices using real hardware.

## Prerequisites

1. **RTL-SDR Device**: Connect an RTL2832U-based SDR dongle via USB
2. **WebUSB Access**: The device must be accessible via WebUSB
   - On Linux, you may need udev rules
   - On Chrome/Chromium, ensure the site is served over HTTPS

## Running Tests

### All RTL-SDR Tests
```bash
E2E_REAL_RTLSDR=1 npm run test:e2e -- --grep @rtlsdr
```

### Specific Test
```bash
E2E_REAL_RTLSDR=1 npm run test:e2e -- --grep "should tune to FM radio"
```

### With UI Mode
```bash
E2E_REAL_RTLSDR=1 npm run test:e2e:ui -- --grep @rtlsdr
```

## Test Coverage

The RTL-SDR test suite verifies:

1. **Device Detection**: Confirms RTL-SDR is recognized
2. **Streaming**: Start/stop reception with real samples
3. **Frequency Tuning**: Tune to FM radio band (88-108 MHz)
4. **Sample Rate**: Change sample rate during operation
5. **Gain Control**: Adjust LNA gain
6. **Stability**: Continuous rendering without errors
7. **Reconnection**: Multiple start/stop cycles
8. **Tuner Detection**: Identify tuner type (R820T, E4000, etc.)

## Supported Devices

The driver supports any RTL2832U-based device, including:

- Generic RTL-SDR dongles
- RTL-SDR Blog V3/V4
- NooElec NESDR series
- Any device with tuner chips:
  - R820T/R820T2 (most common)
  - E4000
  - FC0012/FC0013
  - FC2580
  - R828D

## USB Filters

The driver is registered with these USB filters:

- VID: `0x0bda`, PID: `0x2838` (Generic RTL-SDR)
- VID: `0x0bda`, PID: `0x2832` (RTL-SDR EzCap)

## Troubleshooting

### Device Not Detected

If the device isn't detected:

1. **Check USB connection**: `lsusb | grep Realtek`
2. **Browser permissions**: Device must be accessed via HTTPS
3. **udev rules** (Linux):
   ```bash
   # Create /etc/udev/rules.d/20-rtlsdr.rules
   SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2838", MODE="0666"
   SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2832", MODE="0666"
   
   # Reload rules
   sudo udevadm control --reload-rules
   sudo udevadm trigger
   ```

### Streaming Errors

- **Buffer underruns**: Try lower sample rates (< 2.4 MS/s)
- **USB errors**: Ensure USB 2.0 or better connection
- **Kernel driver conflict**: Blacklist dvb_usb_rtl28xxu kernel module

### Poor Performance

- Use USB 2.0 port (not USB 1.1)
- Reduce sample rate to 1.024 or 2.048 MS/s
- Close other USB-intensive applications
- Check for USB power issues

## Architecture

The RTL-SDR driver consists of:

1. **RTLSDRDevice** (`src/models/RTLSDRDevice.ts`): Low-level WebUSB communication
2. **RTLSDRDeviceAdapter** (`src/drivers/rtlsdr/RTLSDRDeviceAdapter.ts`): ISDRDevice interface implementation
3. **Driver Registration** (`src/drivers/registerBuiltinDrivers.ts`): Auto-registration on startup

## References

- [librtlsdr](https://github.com/librtlsdr/librtlsdr)
- [RTL-SDR Blog](https://www.rtl-sdr.com/)
- [Osmocom RTL-SDR Wiki](https://osmocom.org/projects/rtl-sdr/wiki)
