# Glossary

## A

**ADC (Analog-to-Digital Converter)**: Converts continuous analog signals to discrete digital values.

**ADS-B (Automatic Dependent Surveillance-Broadcast)**: Aircraft broadcast their position, altitude, and other data on 1090 MHz.

**AFC (Automatic Frequency Control)**: System that automatically keeps receiver tuned to signal frequency.

**AGC (Automatic Gain Control)**: Automatically adjusts receiver gain to maintain constant output level.

**AIS (Automatic Identification System)**: Ships broadcast position and identification data on VHF marine frequencies.

**Aliasing**: False frequencies appearing when sample rate is too low (below Nyquist rate).

**AM (Amplitude Modulation)**: Information encoded by varying carrier amplitude.

**APRS (Automatic Packet Reporting System)**: Amateur radio system for position reporting and data, typically on 144.390 MHz.

**APT (Automatic Picture Transmission)**: Analog image transmission from weather satellites (NOAA).

**Attenuation**: Reduction in signal strength.

**Audio Passband**: Frequency range passed to audio output (typically 20 Hz - 20 kHz).

## B

**Bandwidth**: Range of frequencies occupied by a signal or passed by a filter.

**Baseband**: Signal at original low frequencies before modulation.

**BFO (Beat Frequency Oscillator)**: Local oscillator mixed with received signal to produce audible frequency (for SSB, CW).

**Biquad**: Two-pole, two-zero IIR filter building block.

**Bit Error Rate (BER)**: Ratio of incorrectly received bits to total bits transmitted.

**Blocking**: Strong signal preventing reception of weaker signals nearby.

**BPSK (Binary Phase Shift Keying)**: Digital modulation using two phase states.

## C

**Capture Effect**: In FM, stronger signal suppresses weaker co-channel signal.

**Carrier**: Unmodulated radio frequency signal that is modulated to carry information.

**Center Frequency**: Middle frequency of the range being observed or processed.

**CTCSS (Continuous Tone-Coded Squelch System)**: Sub-audible tone used to filter repeater access.

**CW (Continuous Wave)**: Morse code transmission by keying carrier on/off.

## D

**dB (Decibel)**: Logarithmic unit for expressing ratios (power, voltage, etc).

**dBm**: Decibels relative to 1 milliwatt.

**dBFS (Decibels Full Scale)**: Decibels relative to maximum digital level.

**DC Offset**: Unwanted constant (zero frequency) component in signal.

**Decimation**: Reducing sample rate by low-pass filtering then downsampling.

**Deemphasis**: High-frequency attenuation applied to FM audio after demodulation (reverse of preemphasis).

**Demodulation**: Extracting information from modulated carrier.

**DFT (Discrete Fourier Transform)**: Converts time-domain samples to frequency domain.

**Digital Mode**: Communication using digital encoding (PSK31, FT8, RTTY, etc).

**Direct Sampling**: SDR architecture sampling RF directly without mixer (up to ~30 MHz).

**Discriminator**: FM demodulator circuit.

**DRM (Digital Radio Mondiale)**: Digital broadcasting for AM bands.

**DSB (Double Sideband)**: Both sidebands present, carrier suppressed or reduced.

**DSP (Digital Signal Processing)**: Manipulation of digitized signals using algorithms.

**Dynamic Range**: Ratio between strongest and weakest signals handled simultaneously.

**DX**: Long distance communication.

## E

**EFHW (End-Fed Half Wave)**: Antenna type fed at one end.

**Envelope Detector**: Simple AM demodulator extracting amplitude variations.

**EVM (Error Vector Magnitude)**: Measure of digital modulation quality.

## F

**FFT (Fast Fourier Transform)**: Efficient algorithm for computing DFT.

**Filter**: Circuit or algorithm that passes some frequencies and blocks others.

**FIR (Finite Impulse Response)**: Filter type with no feedback, guaranteed stable.

**FM (Frequency Modulation)**: Information encoded by varying carrier frequency.

**Frequency Drift**: Gradual change in transmitter or receiver frequency over time.

**FSK (Frequency Shift Keying)**: Digital modulation switching between frequencies.

**FT8**: Popular weak-signal digital mode using 8-FSK modulation, 15-second cycles.

## G

**Gain**: Amplification factor, often expressed in dB.

**GMSK (Gaussian Minimum Shift Keying)**: Smoothed FSK used in GSM, AIS.

**GPS Disciplined Oscillator (GPSDO)**: High-stability frequency reference locked to GPS.

**Group Delay**: Frequency-dependent delay through filter or system.

## H

**Harmonic**: Integer multiple of fundamental frequency.

**HDSDR**: Popular Windows SDR software.

**Heterodyne**: Mixing two frequencies to produce sum and difference frequencies.

**HF (High Frequency)**: Radio spectrum 3-30 MHz.

**HFDF (High Frequency Data Link)**: Aircraft data communication over HF.

**Hilbert Transform**: Converts real signal to complex (I/Q) representation.

**HRPT (High Resolution Picture Transmission)**: High-quality satellite imagery at ~1.7 GHz.

## I

**I/Q (In-phase/Quadrature)**: Complex signal representation using two components 90° apart.

**IF (Intermediate Frequency)**: Frequency to which RF is converted for processing.

**IIR (Infinite Impulse Response)**: Filter type with feedback, efficient but can be unstable.

**Image Frequency**: Unwanted frequency also converted to IF by mixer.

**IMD (Intermodulation Distortion)**: False signals from non-linear mixing of strong signals.

**Impulse Noise**: Short-duration interference spikes.

**Interpolation**: Increasing sample rate by inserting samples and filtering.

**IP3 (Third-Order Intercept Point)**: Measure of non-linearity and dynamic range.

**ISS (International Space Station)**: Orbiting station with amateur radio capabilities.

## K

**kHz (kilohertz)**: 1,000 Hz.

**kS/s**: Thousand samples per second.

## L

**L-Band**: Frequencies 1-2 GHz (satellite downlinks).

**LSB (Lower Sideband)**: Frequencies below carrier in SSB, convention for HF <10 MHz.

**LNA (Low Noise Amplifier)**: Amplifier optimizing for weak signals near antenna.

**LO (Local Oscillator)**: Signal source used for frequency conversion.

**LPF (Low-Pass Filter)**: Passes low frequencies, blocks high frequencies.

## M

**MHz (megahertz)**: 1,000,000 Hz.

**Mixer**: Device combining two signals (multiplication in time domain).

**Modulation**: Process of encoding information onto carrier wave.

**MS/s (megasamples per second)**: Million samples per second.

**Multipath**: Signal arriving via multiple paths causing fading/distortion.

## N

**Narrowband**: Signal or filter with relatively small bandwidth.

**NFM (Narrowband FM)**: FM with ~12.5 kHz bandwidth for two-way radio.

**Noise Blanker**: Circuit removing impulse noise.

**Noise Figure**: Measure of noise added by amplifier/receiver, in dB.

**Noise Floor**: Minimum detectable signal level due to system noise.

**NOAA**: US weather satellites transmitting APT images at 137 MHz.

**Notch Filter**: Blocks narrow frequency range.

**NR (Noise Reduction)**: DSP algorithm reducing noise while preserving signal.

**Nyquist Rate**: Minimum sample rate (2× highest frequency) to avoid aliasing.

## O

**Offset**: Constant value added to signal (DC offset, frequency offset).

**Oscillator**: Circuit generating periodic signal.

**Overload**: Excessive signal level causing distortion or blocking.

**Oversampling**: Sampling at rate higher than minimum required.

## P

**Passband**: Frequency range passed by filter or receiver.

**Phase**: Position in cycle of periodic waveform, measured in degrees or radians.

**Phase Noise**: Short-term frequency instability of oscillator.

**PLL (Phase-Locked Loop)**: Circuit synchronizing oscillator to reference signal.

**PM (Phase Modulation)**: Information encoded by varying carrier phase.

**POCSAG**: Pager protocol.

**Power Spectral Density**: Power distribution across frequency.

**PPM (Parts Per Million)**: Frequency error expressed as ratio. 1 ppm at 100 MHz = 100 Hz.

**Preemphasis**: High-frequency boost applied before FM modulation.

**PSK (Phase Shift Keying)**: Digital modulation varying carrier phase.

**PSK31**: Popular amateur digital mode, 31.25 baud, keyboard chat.

## Q

**Q Factor**: Quality factor of filter (selectivity). Higher Q = narrower bandwidth.

**QFH (Quadrifilar Helix)**: Circularly-polarized antenna for satellite reception.

**QPSK (Quadrature Phase Shift Keying)**: Digital modulation using four phase states.

**QRM**: Man-made interference.

**QRN**: Natural noise (atmospheric, cosmic).

**Quadrature**: 90° phase relationship.

## R

**RDS (Radio Data System)**: Digital data embedded in FM broadcast (station name, traffic).

**RF (Radio Frequency)**: Frequencies suitable for radio transmission.

**RF Gain**: Amplification of radio frequency signal before mixing/digitization.

**RIT (Receiver Incremental Tuning)**: Fine frequency adjustment.

**RTTY (Radioteletype)**: FSK digital mode using Baudot or ASCII.

## S

**Sample Rate**: Number of samples per second (in S/s, kS/s, MS/s).

**SDR (Software Defined Radio)**: Radio with processing done in software.

**Selectivity**: Receiver's ability to reject nearby unwanted signals.

**Sensitivity**: Minimum detectable signal level.

**SideBoards**: Frequencies above (USB) or below (LSB) carrier containing modulation.

**SIGINT (Signals Intelligence)**: Monitoring and analyzing radio signals.

**Signal-to-Noise Ratio (SNR)**: Ratio of signal power to noise power, in dB.

**Sideband**: Frequencies above (upper) or below (lower) carrier.

**SINAD**: Signal+noise+distortion to noise+distortion ratio.

**Spectrum**: Distribution of signal power across frequencies.

**Spurious**: Unwanted signal or emission.

**Squelch**: Mutes audio when signal below threshold.

**SSB (Single Sideband)**: One sideband with suppressed carrier, efficient AM.

**SSTV (Slow Scan Television)**: Analog image transmission over radio.

**S-unit**: Signal strength measurement (S9 = -73 dBm for HF).

## T

**TCXO (Temperature Compensated Crystal Oscillator)**: Stable frequency reference.

**TDoA (Time Difference of Arrival)**: Location technique using time delays.

**Time Domain**: Signal represented as amplitude over time.

**Transceiver**: Combined transmitter and receiver.

**Tuning**: Adjusting frequency to receive desired signal.

## U

**UHF (Ultra High Frequency)**: Radio spectrum 300 MHz - 3 GHz.

**Upconverter**: Converts low frequencies to higher frequencies for reception.

**USB (Upper Sideband)**: Frequencies above carrier in SSB, convention for HF >10 MHz.

## V

**VCO (Voltage Controlled Oscillator)**: Oscillator with frequency controlled by voltage.

**VFO (Variable Frequency Oscillator)**: Tunable oscillator.

**VHF (Very High Frequency)**: Radio spectrum 30-300 MHz.

**VLF (Very Low Frequency)**: Radio spectrum 3-30 kHz.

**Volmet**: Aviation weather broadcasts.

## W

**Waterfall Display**: Time-history spectrum display with color indicating signal strength.

**WFM (Wideband FM)**: FM with ~200 kHz bandwidth for broadcast radio.

**Window Function**: Tapering function applied before FFT to reduce spectral leakage.

**WSPR (Weak Signal Propagation Reporter)**: Beacon mode for propagation studies, -31 dB sensitivity.

**WWV/WWVB**: US time and frequency standard stations (2.5, 5, 10, 15, 20 MHz and 60 kHz).

## Z

**Zero-IF**: SDR architecture with RF directly converted to baseband (no IF stage).

**Zero Beating**: Adjusting BFO so carrier produces zero beat (no audio tone).

**Zero Stuffing**: Inserting zeros between samples (used in interpolation).

---

## Common Abbreviations

- **AGL**: Above Ground Level
- **BW**: Bandwidth
- **CF**: Center Frequency
- **CH**: Channel
- **EME**: Earth-Moon-Earth (moonbounce)
- **ISB**: Independent Sideband
- **ITU**: International Telecommunication Union
- **LF**: Low Frequency
- **MF**: Medium Frequency
- **QSO**: Radio contact
- **RX**: Receive/Receiver
- **TX**: Transmit/Transmitter
- **XCVR**: Transceiver

---

## Units Reference

### Frequency

- **Hz**: Hertz (cycles per second)
- **kHz**: 1,000 Hz
- **MHz**: 1,000,000 Hz
- **GHz**: 1,000,000,000 Hz

### Power

- **W**: Watt
- **mW**: Milliwatt (0.001 W)
- **dBm**: Decibels relative to 1 milliwatt
- **dBW**: Decibels relative to 1 watt

### Data Rate

- **bps**: Bits per second
- **baud**: Symbols per second
- **kbps**: 1,000 bps
- **Mbps**: 1,000,000 bps

### Sample Rate

- **S/s**: Samples per second
- **kS/s**: 1,000 samples per second
- **MS/s**: 1,000,000 samples per second
- **GS/s**: 1,000,000,000 samples per second
