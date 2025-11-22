# Multi-VFO User Guide

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Using Multiple VFOs](#using-multiple-vfos)
4. [Resource Management](#resource-management)
5. [Performance Considerations](#performance-considerations)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Usage](#advanced-usage)
9. [Accessibility](#accessibility)

## Overview

### What is Multi-VFO?

Multi-VFO (Variable Frequency Oscillator) enables you to simultaneously demodulate and monitor multiple signals within a single wideband SDR capture. Instead of tuning to one frequency at a time, you can monitor several signals at once, each with its own demodulation mode and audio settings.

### Key Benefits

- **Simultaneous Monitoring**: Listen to multiple frequencies at once (e.g., aviation tower, ground, and ATIS)
- **Efficient Resource Usage**: Single hardware capture feeds multiple demodulators
- **Flexible Configuration**: Each VFO has independent frequency, mode, and audio settings
- **Time Savings**: No need to sequentially tune between frequencies

### Common Use Cases

1. **Aviation Communications**: Monitor tower, ground, approach, and ATIS simultaneously
2. **Amateur Radio**: Monitor multiple repeaters or nets on the same band
3. **Broadcast Band Analysis**: Compare different FM stations or analyze spectrum usage
4. **Emergency Services**: Track multiple dispatch channels
5. **Signal Analysis**: A/B test different demodulation modes on the same signal

## Getting Started

### System Requirements

The multi-VFO feature works best on systems with:

- **Minimum**: 4-core CPU, 4 GB RAM (supports up to 4 VFOs)
- **Recommended**: 6+ core CPU, 8+ GB RAM (supports up to 8 VFOs)
- **High-end**: 8+ core CPU, 16+ GB RAM (supports up to 12 VFOs)

Mobile devices are limited to 3 VFOs due to CPU and battery constraints.

### Maximum VFO Limits

The default maximum is **4 simultaneous VFOs**, which provides a good balance between functionality and performance on mid-range hardware.

**Platform-specific recommendations**:

| Platform | Max VFOs | Rationale |
|----------|----------|-----------|
| Desktop (high-end) | 12 | 8+ cores, 16+ GB RAM |
| Desktop (mid-range) | 8 | 4-6 cores, 8 GB RAM |
| Laptop | 6 | 4 cores, thermal limits |
| Mobile | 3 | Battery, CPU constraints |
| **Default** | **4** | Conservative, universal |

The system enforces an absolute maximum of **16 VFOs** to prevent resource exhaustion.

### Creating Your First VFO

1. **Start SDR Reception**: Ensure your SDR device is connected and receiving
2. **Open the VFO Manager**: Located in the monitoring view
3. **Add a VFO**:
   - Hold `Alt` and click on the waterfall at your desired frequency, OR
   - Click "Add VFO" button in the VFO Manager
4. **Configure the VFO**:
   - Select demodulation mode (AM, FM, SSB, etc.)
   - Adjust audio gain if needed
   - Enable/disable audio output
5. **Start Listening**: The VFO begins demodulating immediately

## Using Multiple VFOs

### VFO Manager Panel

The VFO Manager displays all active VFOs with the following information:

- **Frequency**: Center frequency of the VFO
- **Mode**: Demodulation type (AM, WBFM, NBFM, USB, LSB, CW, ATSC)
- **Status**: Current state (Idle, Active, Paused, Error)
- **RSSI**: Signal strength in dBFS
- **Audio Toggle**: Enable/disable audio output
- **Remove Button**: Delete the VFO

### VFO Controls

Each VFO card in the manager provides:

- **Label**: Custom name for easy identification
- **Frequency Adjustment**: Fine-tune center frequency
- **Mode Selection**: Change demodulation algorithm
- **Audio Enable**: Toggle audio on/off
- **Audio Gain**: Adjust volume (0.0 to 1.0)
- **Priority**: Set relative importance (0-10, default 5)

### Audio Mixing

When multiple VFOs have audio enabled:

- Audio streams are **mixed** (summed together)
- Automatic **gain normalization** prevents clipping
- Up to **8 concurrent audio streams** recommended
- Individual VFO gain controls for balance

**Tip**: Use audio enable/disable to switch between channels without removing VFOs.

### Keyboard Navigation

The multi-VFO interface is fully keyboard-accessible:

- `Tab` / `Shift+Tab`: Navigate between VFOs
- `Enter` / `Space`: Toggle audio or activate buttons
- `Escape`: Close VFO creation modal
- `Alt+Click`: Create VFO at clicked frequency (on waterfall)

## Resource Management

### CPU Usage

Multi-VFO demodulation consumes CPU resources. The system monitors DSP (Digital Signal Processing) time and issues warnings when limits are approached.

**Performance Budget**:

- **Target**: < 70% CPU usage to maintain 60 FPS UI responsiveness
- **DSP Budget**: ~8 ms per sample batch (16.67 ms frame budget @ 60 FPS)
- **Warning Threshold**: 8 ms DSP time
- **Critical Threshold**: 12 ms DSP time

### Warning System

The system displays warnings when resource limits are approached:

#### ⚠️ High CPU Usage

```
⚠️ High CPU usage: DSP processing time (8.2ms) approaching limit.
Consider reducing VFO count or pausing low-priority VFOs.
```

**What to do**:
- Disable audio on some VFOs (reduces load)
- Remove complex demodulators (ATSC > FM > AM)
- Pause or remove low-priority VFOs

#### 🚨 Critical CPU Usage

```
🚨 Critical CPU usage: DSP processing time (12.5ms) exceeds safe limit.
Performance degradation likely. Reduce VFO count immediately.
```

**What to do**:
- Remove VFOs immediately
- System may auto-pause lowest priority VFOs
- Consider upgrading hardware or reducing sample rate

#### ⚠️ Too Many Audio Streams

```
⚠️ Too many audio streams: 9 concurrent streams exceeds recommended limit of 8.
Disable audio on some VFOs.
```

**What to do**:
- Disable audio on less important VFOs
- Use audio toggle to switch between channels

### Memory Usage

Each VFO consumes approximately **400 KB** of memory on average:

- VFO state: ~1 KB
- Demodulator instance: 50-500 KB (mode-dependent)
- Audio buffers: ~200 KB (if audio enabled)
- Channelizer buffers: ~100 KB

**Memory warning threshold**: 50 MB total VFO memory (~100+ VFOs)

### Demodulation Complexity

Different modes have different CPU costs (relative to AM = 1.0):

| Mode | Complexity | Typical CPU Time |
|------|-----------|------------------|
| CW | 0.8× | 0.2 ms |
| AM | 1.0× | 0.3 ms |
| USB/LSB | 1.2× | 0.4 ms |
| NBFM | 1.5× | 0.5 ms |
| WBFM | 2.0× | 0.8 ms |
| ATSC-8VSB | 5.0× | 4.0 ms |

**Tip**: Mix simpler modes (AM, CW) with complex ones (WBFM, ATSC) to stay within budget.

## Performance Considerations

### Optimizing VFO Count

The system can dynamically adjust recommended VFO limits based on active demodulators:

**Example**: With base limit of 4
- 1× ATSC (5.0) + 0 remaining → 0 more VFOs allowed
- 2× WBFM (4.0 total) → 0 more VFOs allowed
- 3× AM (3.0 total) → 1 more VFO allowed
- 2× AM (2.0) + 1× CW (0.8) = 2.8 → 1 more VFO allowed

### Minimum Frequency Spacing

VFOs should maintain minimum separation to avoid filter crosstalk:

| Mode | Min Spacing | Reason |
|------|-------------|--------|
| AM | 10 kHz | Channel bandwidth |
| NBFM | 12.5 kHz | Standard FM spacing |
| WBFM | 200 kHz | Broadcast FM spacing |
| USB/LSB | 3 kHz | SSB bandwidth |
| CW | 500 Hz | Narrow filter |
| ATSC-8VSB | 6 MHz | DTV channel width |

**Warning**: The system allows overlapping VFOs but issues console warnings. Overlapping filters may cause audio interference.

### Hardware Bandwidth Constraint

All VFO center frequencies must be within the current hardware capture bandwidth:

```
Valid Range = [hardwareCenterHz - (sampleRate/2), hardwareCenterHz + (sampleRate/2)]
```

**Example**:
- Hardware: 100 MHz center, 20 MS/s sample rate
- Valid VFO range: 90 MHz to 110 MHz
- Invalid: 85 MHz (outside range), 115 MHz (outside range)

### Channelization Strategies

The system automatically selects the most efficient DSP strategy:

- **1-2 VFOs**: Per-VFO mixing (simple frequency shift + filter)
- **3+ VFOs**: Polyphase Filter Bank (PFB) channelizer (amortizes cost)

This hybrid approach provides optimal performance across different VFO counts.

## Best Practices

### 1. Start Small

Begin with 2-3 VFOs to understand the system, then add more as needed.

### 2. Use Priorities

Set higher priorities (7-10) for critical VFOs. The system auto-pauses low-priority VFOs under load.

### 3. Disable Unused Audio

If you only need RDS data or signal metrics, disable audio to reduce CPU load.

### 4. Label Your VFOs

Use meaningful labels like "Tower", "Ground", "ATIS" instead of default names.

### 5. Monitor Resource Warnings

Pay attention to CPU and audio warnings. Adjust VFO count before performance degrades.

### 6. Match Modes to Signals

Use the correct demodulation mode:
- Aviation: AM
- FM broadcast: WBFM
- Repeaters: NBFM
- SSB/HAM: USB/LSB
- Digital TV: ATSC-8VSB

### 7. Save Presets (Future Feature)

Once configured, VFO presets will allow quick restoration of common setups.

## Troubleshooting

### Problem: VFO Creation Fails

**Symptoms**: Error message when trying to add VFO

**Possible Causes**:
1. **Max VFO count reached**: Remove unused VFOs or increase limit
2. **Frequency out of range**: Ensure frequency is within hardware bandwidth
3. **Invalid mode**: Select a supported demodulation mode

**Solutions**:
- Check error message for specific cause
- Verify hardware is receiving (sample rate, center frequency)
- Remove idle VFOs before adding new ones

### Problem: No Audio from VFO

**Symptoms**: VFO active but no sound

**Possible Causes**:
1. **Audio disabled**: Check VFO audio toggle
2. **Squelch too high**: Adjust squelch threshold
3. **Weak signal**: Check RSSI, adjust antenna
4. **Wrong demodulation mode**: Verify mode matches signal type

**Solutions**:
- Enable audio in VFO manager
- Check audio gain setting (should be > 0.1)
- Verify signal is present in waterfall/spectrum
- Try different demodulation mode

### Problem: Choppy Audio or Frame Drops

**Symptoms**: Stuttering audio, laggy UI

**Possible Causes**:
1. **Too many VFOs**: Exceeding CPU budget
2. **Complex demodulators**: Multiple ATSC or WBFM VFOs
3. **High sample rate**: Hardware configured for maximum bandwidth
4. **Other applications**: CPU competition

**Solutions**:
- Remove or pause low-priority VFOs
- Disable audio on some VFOs
- Reduce hardware sample rate if possible
- Close other CPU-intensive applications
- Check CPU usage warnings

### Problem: VFO Audio Interfering

**Symptoms**: Crosstalk between adjacent VFOs

**Possible Causes**:
1. **VFOs too close**: Below minimum spacing
2. **Filter overlap**: Bandwidth too wide for spacing
3. **Strong adjacent signals**: Overloading filters

**Solutions**:
- Increase spacing between VFO center frequencies
- Use narrower bandwidth filters
- Attenuate strong signals (RF gain, filters)
- Check console for spacing warnings

### Problem: High Memory Usage

**Symptoms**: Browser tab crashes, system slow

**Possible Causes**:
1. **Too many VFOs**: Each consumes ~400 KB
2. **Memory leak**: Rare, but possible
3. **Other tabs**: Browser memory limits

**Solutions**:
- Reduce VFO count
- Reload page (clears state)
- Close other browser tabs
- Use browser task manager to verify

## Advanced Usage

### Dynamic VFO Priority

Set VFO priorities to control resource allocation under load:

- **High Priority (8-10)**: Critical channels (emergency, tower)
- **Medium Priority (4-7)**: Regular monitoring
- **Low Priority (1-3)**: Nice-to-have, first to pause

When CPU limits are reached, lowest priority VFOs are automatically paused.

### Stereo Panning (Future Feature)

Distribute VFO audio across stereo field:

- `-1.0`: Full left
- `0.0`: Center (default)
- `+1.0`: Full right

**Use case**: Pan tower to left, ground to right for spatial separation.

### Custom Bandwidth

Adjust VFO bandwidth to optimize for:

- **Narrow**: Reduce noise, adjacent channel rejection
- **Wide**: Capture full modulation, better quality

**Example**: AM aviation typically 8 kHz, but can narrow to 5 kHz in crowded band.

### Integration with Markers

VFO frequency markers appear on the waterfall/spectrum, showing:

- VFO center frequency
- Demodulation mode badge
- Quick access to VFO controls

## Accessibility

The multi-VFO interface follows WCAG 2.1 Level AA guidelines:

### Keyboard Navigation

- **Tab order**: Logical flow through VFO controls
- **Focus indicators**: Clear visual feedback
- **Keyboard shortcuts**: Alt+Click for VFO creation

### Screen Reader Support

- **ARIA labels**: Descriptive element labels
- **Live regions**: Status updates announced
- **Semantic HTML**: Proper heading hierarchy

### Visual Design

- **Color contrast**: Meets WCAG AA standards
- **Focus indicators**: High contrast outlines
- **Responsive layout**: Works at various zoom levels

### Testing

The multi-VFO feature has been tested with:

- **Keyboard only**: Full functionality without mouse
- **Screen readers**: NVDA, JAWS, VoiceOver compatibility
- **High contrast**: Works in Windows high contrast mode
- **Zoom**: Usable at 200% zoom

## Additional Resources

### Documentation

- [Multi-VFO Architecture](./multi-vfo-architecture.md) - Technical specification
- [Multi-VFO DSP Implementation](./multi-vfo-dsp-implementation.md) - Algorithm details
- [Demodulation Algorithms](./demodulation-algorithms.md) - Mode descriptions
- [Performance Optimization](./performance-optimization.md) - Tuning guide

### Support

- [Community Forum](../../COMMUNITY.md) - Ask questions, share setups
- [GitHub Issues](https://github.com/alexthemitchell/rad.io/issues) - Bug reports
- [Contributing Guide](../../CONTRIBUTING.md) - Contribute improvements

## FAQ

### Q: Can I use multi-VFO with IQ recordings?

**A**: Yes! Multi-VFO works with both live SDR devices and pre-recorded IQ files. This is great for post-processing analysis.

### Q: Does multi-VFO work with all SDR devices?

**A**: Yes, as long as the device supports wideband capture. Multi-VFO operates on the IQ sample stream regardless of hardware.

### Q: Can I record audio from multiple VFOs?

**A**: Currently, audio recording captures the mixed output. Individual VFO recording is planned for a future release.

### Q: How do I increase the max VFO limit?

**A**: The system automatically sets limits based on detected platform. On high-end systems, the limit can reach 12. Manual adjustment may be added in future releases.

### Q: What happens if I exceed resource limits?

**A**: The system issues warnings and may auto-pause low-priority VFOs. The UI remains responsive, but audio quality may degrade.

### Q: Can VFOs use different sample rates?

**A**: No, all VFOs share the hardware sample rate. However, each VFO is independently decimated and filtered to its bandwidth.

### Q: Why is ATSC so much more expensive than AM?

**A**: ATSC-8VSB demodulation involves complex algorithms (synchronization, equalization, FEC, etc.) while AM is a simple envelope detector.

## Changelog

### Phase 5 (Current)

- ✅ Configurable max VFO count (default: 4)
- ✅ Resource usage warnings (DSP time, memory, audio)
- ✅ Comprehensive user documentation
- ✅ Regression tests for limits
- ✅ Accessibility verification

### Phase 4

- Multi-VFO UI components (VfoManager, VfoCard)
- Alt+Click VFO creation
- Audio toggle controls

### Phase 3

- DSP pipeline integration
- Multi-channel audio mixing

### Phase 2

- VFO state management (Zustand)
- Validation and constraint enforcement

### Phase 1

- Architecture specification
- Data model design

---

**Version**: 1.0  
**Last Updated**: 2025-11-22  
**Feedback**: [Open an issue](https://github.com/alexthemitchell/rad.io/issues/new) with suggestions or corrections.
