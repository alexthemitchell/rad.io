# SDR Basics

## What is Software Defined Radio?

Software Defined Radio (SDR) is a radio communication system where components traditionally implemented in hardware (mixers, filters, amplifiers, modulators/demodulators, detectors) are instead implemented in software on a computer or embedded system.

### Key Advantages

- **Flexibility**: Change radio parameters through software updates
- **Cost-Effective**: One device can operate across multiple frequency bands and modes
- **Upgradability**: Add new features and protocols without hardware changes
- **Experimentation**: Easy to test and develop new signal processing techniques
- **Education**: Visualize and understand radio signals in real-time

## Core Concepts

### Frequency

The rate at which a radio wave oscillates, measured in Hertz (Hz). Common ranges:

- **kHz** (kilohertz): 1,000 Hz - Used for AM broadcast, maritime
- **MHz** (megahertz): 1,000,000 Hz - Used for FM broadcast, amateur radio, aviation
- **GHz** (gigahertz): 1,000,000,000 Hz - Used for satellite, WiFi, radar

### Bandwidth

The range of frequencies occupied by a signal. Different modes require different bandwidths:

- **CW (Morse Code)**: ~100 Hz
- **SSB (Single Sideband)**: ~2.7 kHz
- **AM Broadcasting**: ~10 kHz
- **FM Broadcasting**: ~200 kHz
- **Digital TV**: Several MHz

### Sample Rate

The number of times per second the SDR samples the incoming signal. Must be at least twice the highest frequency of interest (Nyquist theorem).

Example: To receive a 20 MHz wide signal, you need a sample rate of at least 40 MS/s (mega-samples per second).

### Center Frequency

The middle frequency of the range you're observing. The SDR samples frequencies around this center point based on the sample rate.

If center frequency = 100 MHz and sample rate = 2 MHz, you can see signals from 99-101 MHz.

## Signal Representation

### Time Domain

Shows signal amplitude over time. Useful for:

- Observing modulation patterns
- Detecting interference
- Measuring signal timing

### Frequency Domain (Spectrum)

Shows signal power at different frequencies. Useful for:

- Finding active signals
- Identifying signal types
- Measuring bandwidth
- Detecting interference sources

### Waterfall Display

A time-history of the spectrum, showing how frequency content changes over time. Color represents signal strength:

- **Blue/Purple**: Weak or no signal (noise floor)
- **Green/Yellow**: Moderate signal strength
- **Red/White**: Strong signal

## Basic Signal Parameters

### Signal Strength

Measured in dBm (decibel-milliwatts) or as S-units:

- **S9**: Strong signal (-73 dBm for HF)
- **S9+20dB**: Very strong signal
- **S1-S3**: Weak signal
- **Below S1**: Too weak to decode reliably

### Signal-to-Noise Ratio (SNR)

The ratio of signal power to noise power. Higher is better:

- **>20 dB**: Excellent quality
- **10-20 dB**: Good quality
- **0-10 dB**: Marginal quality
- **<0 dB**: Usually unreadable

### Dynamic Range

The ratio between the strongest and weakest signals the SDR can handle simultaneously. Measured in dB. Higher values mean better performance in crowded spectrum.

## Common Controls

### RF Gain

Controls the amplification of incoming signals before digitization:

- **High gain**: Better for weak signals, but risk of overload with strong signals
- **Low gain**: Better for strong signals or crowded bands
- **AGC (Automatic Gain Control)**: Automatically adjusts gain

### Squelch

Mutes audio output when signal strength falls below a threshold. Prevents listening to noise between transmissions.

### Filter Bandwidth

Determines how wide a frequency range passes through. Narrower filters:

- Reject more interference
- Improve weak signal reception
- May cut off parts of the desired signal if too narrow

## Getting Started

1. **Choose your frequency**: Use frequency allocation charts to find interesting signals
2. **Set appropriate mode**: Match the modulation to the signal type
3. **Adjust bandwidth**: Start wide, then narrow to isolate your signal
4. **Tune RF gain**: Avoid overload while maintaining good sensitivity
5. **Fine-tune frequency**: Center the signal in your passband

## Safety and Legal Considerations

### Receive Only

Most SDR users operate in receive-only mode, which is generally legal worldwide for most frequencies.

### Transmit Restrictions

Transmitting requires:

- Appropriate license for the frequency and mode
- Type-approved equipment
- Power limits compliance
- Spurious emission limits compliance

### Privacy and Ethics

- Never record or share private communications
- Respect encryption and privacy
- Follow local laws regarding monitoring
- Use responsibly and ethically

## Next Steps

- Explore [Frequency Allocations](./frequency-allocations.md) to find signals of interest
- Learn about [Modulation Types](./modulation-types.md) to decode different signals
- Review [Common Use Cases](./common-use-cases.md) for practical applications
- Study [Signal Analysis](./signal-analysis.md) techniques
