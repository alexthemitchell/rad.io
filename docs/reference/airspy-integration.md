# Airspy Device Reference

## Overview

Airspy is a family of high-performance Software Defined Radio (SDR) receivers designed for demanding applications
requiring excellent dynamic range and low noise performance. This guide covers WebUSB integration for Airspy
devices in the rad.io visualizer.

## Supported Devices

### Airspy R2

**Specifications:**

- **Frequency Range**: 24 MHz - 1.8 GHz
- **Sample Rates**: 2.5 MS/s, 10 MS/s
- **Resolution**: 12-bit ADC (transmitted as 16-bit)
- **USB**: Vendor ID 0x1d50, Product ID 0x60a1
- **Interface**: Bulk transfer endpoint 0x81
- **Dynamic Range**: ~70 dB @ 10 MS/s

**Gain Controls:**

- **LNA** (Low Noise Amplifier): 0-45 dB in 3 dB steps (0-15)
- **Mixer**: 0-15 dB in 1 dB steps (0-15)
- **VGA** (IF gain): 0-15 dB in 1 dB steps (0-15)

### Airspy Mini

**Specifications:**

- **Frequency Range**: 24 MHz - 1.8 GHz
- **Sample Rates**: 3 MS/s, 6 MS/s _(see note below)_
- **Resolution**: 12-bit ADC
- **USB**: Vendor ID 0x1d50, Product ID 0x60a1 (same as R2)
- **Size**: Compact form factor

**Note**: Airspy Mini and R2 share the same USB IDs and can be distinguished by their capabilities and firmware.

> **Warning:** The current rad.io implementation only supports the sample rates of Airspy R2 (2.5 MS/s, 10 MS/s) due to the shared USB VID/PID (0x1d50:0x60a1) and lack of device variant detection. Attempting to use Airspy Mini's native sample rates (3 MS/s, 6 MS/s) will fail. This limitation will be addressed in a future update.

### Airspy HF+

**Specifications:**

- **Frequency Range**: 9 kHz - 31 MHz, 60 MHz - 260 MHz
- **Sample Rates**: Variable up to 768 kS/s
- **Resolution**: 16-bit ADC
- **USB**: Vendor ID 0x03eb, Product ID 0x800c
- **Optimized**: HF and VHF reception with excellent dynamic range

## WebUSB Configuration

### Connection Sequence

```typescript
// Request device
const device = await navigator.usb.requestDevice({
  filters: [
    {
      vendorId: 0x1d50,
      productId: 0x60a1, // Airspy R2/Mini
    },
  ],
});

// Open and configure
await device.open();
await device.selectConfiguration(1);
await device.claimInterface(0);
```

### Control Commands

Airspy uses vendor-specific control transfers:

| Command         | Value | Description                                 |
| --------------- | ----- | ------------------------------------------- |
| RECEIVER_MODE   | 1     | Start/stop receiver (0=OFF, 1=ON)           |
| SET_FREQ        | 2     | Set center frequency (32-bit Hz)            |
| SET_SAMPLE_RATE | 3     | Set sample rate index (0=10MS/s, 1=2.5MS/s) |
| SET_LNA_GAIN    | 5     | Set LNA gain (0-15)                         |
| SET_MIXER_GAIN  | 6     | Set mixer gain (0-15)                       |
| SET_VGA_GAIN    | 7     | Set VGA/IF gain (0-15)                      |
| SET_LNA_AGC     | 8     | Enable/disable LNA AGC                      |
| SET_MIXER_AGC   | 9     | Enable/disable mixer AGC                    |
| GET_SAMPLERATES | 27    | Query available sample rates                |

### Example: Set Frequency

```typescript
async function setFrequency(device: USBDevice, frequencyHz: number) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, frequencyHz, true); // little-endian

  await device.controlTransferOut(
    {
      requestType: "vendor",
      recipient: "device",
      request: 2, // SET_FREQ
      value: 0,
      index: 0,
    },
    buffer,
  );
}
```

### Example: Set Sample Rate

```typescript
async function setSampleRate(device: USBDevice, rateMs: number) {
  // Airspy R2: 0 = 10 MS/s, 1 = 2.5 MS/s
  const rateIndex = rateMs === 10 ? 0 : 1;

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, rateIndex, true);

  await device.controlTransferOut(
    {
      requestType: "vendor",
      recipient: "device",
      request: 3, // SET_SAMPLE_RATE
      value: 0,
      index: 0,
    },
    buffer,
  );
}
```

## Sample Data Format

### Int16 IQ Interleaved

Airspy transmits 12-bit samples as 16-bit signed integers (Int16):

```text
[I0_LSB, I0_MSB, Q0_LSB, Q0_MSB, I1_LSB, I1_MSB, Q1_LSB, Q1_MSB, ...]
```

**Parsing Example:**

```typescript
function parseSamples(data: DataView): IQSample[] {
  const sampleCount = data.byteLength / 4; // 2 bytes I + 2 bytes Q
  const samples: IQSample[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const I = data.getInt16(i * 4, true); // little-endian
    const Q = data.getInt16(i * 4 + 2, true);

    // Normalize to ±1.0
    samples.push({
      I: I / 32768.0,
      Q: Q / 32768.0,
    });
  }

  return samples;
}
```

## Gain Configuration

### Understanding Gain Stages

Airspy provides three independent gain stages for optimal signal reception:

1. **LNA (Low Noise Amplifier)**
   - First stage after antenna
   - Controls sensitivity
   - Range: 0-45 dB (3 dB steps)
   - Higher values increase sensitivity but may cause overload

2. **Mixer**
   - Downconverts RF to IF
   - Range: 0-15 dB (1 dB steps)
   - Balances gain distribution

3. **VGA (Variable Gain Amplifier / IF Gain)**
   - Final amplification stage
   - Range: 0-15 dB (1 dB steps)
   - Fine-tune signal level to ADC

### Recommended Gain Settings

**For Weak Signals (HF/VHF DX):**

- LNA: 12-15 (36-45 dB)
- Mixer: 10-12 dB
- VGA: 10-12 dB

**For Strong Local Signals:**

- LNA: 0-5 (0-15 dB)
- Mixer: 5-8 dB
- VGA: 5-8 dB

**For General Monitoring:**

- LNA: 7-10 (21-30 dB)
- Mixer: 8-10 dB
- VGA: 8-10 dB

### AGC (Automatic Gain Control)

Enable AGC for hands-free operation:

```typescript
// Enable LNA AGC
await device.controlTransferOut(
  {
    requestType: "vendor",
    recipient: "device",
    request: 8, // SET_LNA_AGC
    value: 0,
    index: 0,
  },
  new Uint8Array([1]),
);

// Enable Mixer AGC
await device.controlTransferOut(
  {
    requestType: "vendor",
    recipient: "device",
    request: 9, // SET_MIXER_AGC
    value: 0,
    index: 0,
  },
  new Uint8Array([1]),
);
```

**AGC Considerations:**

- AGC adapts gain automatically based on signal strength
- May "pump" on strong intermittent signals
- Disable for consistent measurements
- Useful for scanning and general monitoring

## Streaming Configuration

### Transfer Parameters

- **Endpoint**: 0x81 (Bulk IN)
- **Buffer Size**: 262,144 bytes (256 KB) recommended
- **Timeout**: 5000 ms
- **Sample Format**: Int16 interleaved IQ

### Starting Reception

```typescript
// Set receiver mode to ON
const buffer = new ArrayBuffer(1);
const view = new DataView(buffer);
view.setUint8(0, 1); // 1 = RECEIVER mode

await device.controlTransferOut(
  {
    requestType: "vendor",
    recipient: "device",
    request: 1, // RECEIVER_MODE
    value: 0,
    index: 0,
  },
  buffer,
);

// Start transfer loop
while (streaming) {
  const result = await device.transferIn(0x81, 262144);
  if (result.status === "ok" && result.data) {
    const samples = parseSamples(new DataView(result.data.buffer));
    processSamples(samples);
  }
}
```

## Troubleshooting

### Device Not Detected

**Symptoms:**

- Device not appearing in browser picker
- "Access denied" errors

**Solutions:**

1. Ensure HTTPS context (localhost exception available)
2. Check USB cable and port (USB 2.0/3.0)
3. Try different browser (Chrome/Edge recommended)
4. Verify device with vendor tools first (Airspy SDR#)

### No Data Received

**Symptoms:**

- `transferIn` returns empty buffers
- No samples in visualization

**Checklist:**

1. Verify receiver mode is ON (command 1)
2. Confirm sample rate is set (command 3)
3. Check frequency is within range (24 MHz - 1.8 GHz)
4. Ensure endpoint 0x81 is correct
5. Verify buffer size is adequate (256 KB)

### Poor Performance / Overruns

**Symptoms:**

- Dropped samples
- Gaps in waterfall
- High CPU usage

**Solutions:**

1. Reduce sample rate (10 MS/s → 2.5 MS/s)
2. Close other USB devices
3. Use USB 3.0 port
4. Reduce visualization frame rate
5. Enable GPU acceleration

### Gain Too High / Overload

**Symptoms:**

- Clipping in IQ constellation
- Broadband noise floor elevation
- Intermodulation products

**Solutions:**

1. Reduce LNA gain first
2. Lower mixer and VGA gains
3. Enable AGC for automatic adjustment
4. Use attenuator if available
5. Check for strong nearby transmitters

### Transfer Stalls

**Symptoms:**

- `transferIn` returns `status: "stall"`
- Streaming stops unexpectedly

**Solutions:**

1. Clear halt on endpoint: `device.clearHalt("in", 0x81)`
2. Stop and restart receiver mode
3. Reset device via close/open cycle
4. Check USB cable quality

## Performance Characteristics

### Sample Rate vs. Dynamic Range

- **10 MS/s**: ~70 dB dynamic range, full bandwidth
- **2.5 MS/s**: ~75 dB dynamic range, lower CPU usage

### Latency

- **USB Latency**: ~10-20 ms typical
- **Processing**: Depends on visualization complexity
- **Total**: ~30-50 ms end-to-end

### Bandwidth

- **10 MS/s**: ~9 MHz usable bandwidth (90%)
- **2.5 MS/s**: ~2.25 MHz usable bandwidth

### Power Consumption

- **Airspy R2**: ~500 mA @ 5V (2.5W)
- **Airspy Mini**: ~250 mA @ 5V (1.25W)
- Use powered USB hub for multiple devices

## Best Practices

### Initialization Sequence

1. Open device and claim interface
2. Set receiver mode OFF
3. Configure sample rate
4. Set center frequency
5. Configure gain stages
6. Enable AGC (optional)
7. Set receiver mode ON
8. Start transfer loop

### Cleanup Sequence

1. Stop transfer loop
2. Set receiver mode OFF
3. Release interface
4. Close device

### Memory Management

- Clear old buffers periodically (100 buffers max)
- Monitor `activeBuffers` count
- Use typed arrays efficiently
- Avoid memory allocations in hot path

### Error Handling

- Implement retry logic for `transferIn` errors
- Handle device disconnection gracefully
- Log errors for debugging
- Provide user feedback

## Code Examples

### Complete Device Class

See: `src/models/AirspyDevice.ts`

### Adapter Implementation

See: `src/models/AirspyDeviceAdapter.ts`

### React Hook Integration

```typescript
import { useEffect, useState } from "react";
import { AirspyDeviceAdapter } from "../models";

export function useAirspyDevice() {
  const [device, setDevice] = useState<AirspyDeviceAdapter | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const connect = async () => {
    try {
      const usbDevice = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x1d50, productId: 0x60a1 }],
      });

      const airspy = new AirspyDeviceAdapter(usbDevice);
      await airspy.open();
      setDevice(airspy);
    } catch (err) {
      setError(err as Error);
    }
  };

  useEffect(() => {
    return () => {
      device?.close();
    };
  }, [device]);

  return { device, error, connect };
}
```

## References

- [Airspy Official Documentation](https://airspy.com/)
- [USB Control Transfer Specification](https://www.usb.org/document-library/usb-20-specification)
- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB)
- [rad.io WebUSB Integration Playbook](../../.serena/memories/WEBUSB_SDR_INTEGRATION_PLAYBOOK.md)

## Related Documentation

- [SDR Basics](./sdr-basics.md)
- [Hardware Integration Guide](./hardware-integration.md)
- [HackRF Troubleshooting](./hackrf-troubleshooting.md)
