<!-- markdownlint-disable MD036 -->

# Formula Reference

## Frequency and Wavelength

### Wavelength Calculation

```
λ = c / f
```

Where:

- λ = wavelength (meters)
- c = speed of light (299,792,458 m/s ≈ 3×10⁸ m/s)
- f = frequency (Hz)

**Example**:

- f = 100 MHz = 100,000,000 Hz
- λ = 3×10⁸ / 1×10⁸ = 3 meters

### Frequency from Wavelength

```
f = c / λ
```

### Frequency Ranges

```
VLF: 3-30 kHz      (wavelength: 100-10 km)
LF:  30-300 kHz    (wavelength: 10-1 km)
MF:  300-3000 kHz  (wavelength: 1000-100 m)
HF:  3-30 MHz      (wavelength: 100-10 m)
VHF: 30-300 MHz    (wavelength: 10-1 m)
UHF: 300-3000 MHz  (wavelength: 100-10 cm)
```

## Antenna Calculations

### Dipole Length

```
L = 468 / f(MHz)    (feet)
L = 142.65 / f(MHz) (meters)
```

**Example** (20m band, 14.2 MHz):

- L = 142.65 / 14.2 = 10.05 meters total
- Each leg = 5.02 meters

### Quarter-Wave Vertical

```
L = 234 / f(MHz)    (feet)
L = 71.325 / f(MHz) (meters)
```

### 5/8 Wave Vertical

```
L = 585 / f(MHz)    (feet)
L = 178.3 / f(MHz)  (meters)
```

## Sampling and Nyquist

### Nyquist Rate

```
fs ≥ 2 × fmax
```

Where:

- fs = sample rate
- fmax = highest frequency component

**Example**:

- To sample 10 MHz signal: fs ≥ 20 MS/s

### Bandwidth from Sample Rate

```
BW = fs / 2
```

**Example**:

- 2.048 MS/s sample rate = 1.024 MHz usable bandwidth

### FFT Frequency Resolution

```
Δf = fs / N
```

Where:

- Δf = frequency resolution (Hz/bin)
- fs = sample rate (S/s)
- N = FFT size (number of points)

**Example**:

- fs = 2,048,000 S/s
- N = 4096
- Δf = 2,048,000 / 4096 = 500 Hz/bin

## Power and Signal Strength

### Power in dBm

```
P(dBm) = 10 × log₁₀(P(mW) / 1 mW)
```

**Common Values**:

- 1 W = +30 dBm
- 100 mW = +20 dBm
- 10 mW = +10 dBm
- 1 mW = 0 dBm
- 0.1 mW = -10 dBm
- 1 µW = -30 dBm
- 1 nW = -60 dBm
- 1 pW = -90 dBm

### Power from dBm

```
P(mW) = 10^(P(dBm)/10)
```

### dBm to Watts

```
P(W) = 10^((P(dBm)-30)/10)
```

### Watts to dBm

```
P(dBm) = 10 × log₁₀(P(W) × 1000)
```

### Power Ratio in dB

```
dB = 10 × log₁₀(P₁ / P₂)
```

**Common Ratios**:

- 2× power = +3 dB
- 10× power = +10 dB
- 100× power = +20 dB
- ½ power = -3 dB
- 1/10 power = -10 dB

### Voltage Ratio in dB

```
dB = 20 × log₁₀(V₁ / V₂)
```

**Common Ratios**:

- 2× voltage = +6 dB
- 10× voltage = +20 dB
- ½ voltage = -6 dB

## Signal Quality

### Signal-to-Noise Ratio (SNR)

```
SNR(dB) = 10 × log₁₀(Psignal / Pnoise)
SNR(dB) = Psignal(dBm) - Pnoise(dBm)
```

### S-Units to dBm (HF)

```
S9 = -73 dBm
Each S-unit below S9 = 6 dB
Each dB over S9 written as "S9+X dB"
```

**Scale**:

- S9+40dB = -33 dBm
- S9+20dB = -53 dBm
- S9 = -73 dBm
- S8 = -79 dBm
- S7 = -85 dBm
- S1 = -121 dBm

### S-Units to dBm (VHF/UHF)

```
S9 = -93 dBm (20 dB weaker than HF)
```

### Noise Figure

```
NF(dB) = 10 × log₁₀(F)
```

Where F = noise factor

```
F = SNRin / SNRout
```

### Thermal Noise Power

```
Pn = k × T × B
```

Where:

- Pn = noise power (Watts)
- k = Boltzmann constant (1.38×10⁻²³ J/K)
- T = temperature (Kelvin)
- B = bandwidth (Hz)

**In dBm**:

```
Pn(dBm) = -174 + 10×log₁₀(B)
```

**Example** (1 kHz bandwidth):

- Pn = -174 + 10×log₁₀(1000) = -174 + 30 = -144 dBm

## Modulation

### AM Modulation Index

```
m = (Vmax - Vmin) / (Vmax + Vmin)
```

Where:

- m = modulation index (0 to 1)
- 100% modulation: m = 1

### FM Deviation Ratio

```
β = Δf / fm
```

Where:

- β = modulation index
- Δf = frequency deviation (Hz)
- fm = modulating frequency (Hz)

### Carson's Bandwidth Rule (FM)

```
BW ≈ 2 × (Δf + fm)
```

**Example** (NBFM):

- Δf = 5 kHz deviation
- fm = 3 kHz audio
- BW ≈ 2 × (5 + 3) = 16 kHz

**Example** (Broadcast FM):

- Δf = 75 kHz deviation
- fm = 15 kHz audio
- BW ≈ 2 × (75 + 15) = 180 kHz

## Digital Modulation

### Bit Rate vs Baud Rate

```
Bit rate = Baud rate × log₂(M)
```

Where:

- M = number of symbols

**Examples**:

- BPSK: 1 bit/symbol → Bit rate = Baud
- QPSK: 2 bits/symbol → Bit rate = 2 × Baud
- 8PSK: 3 bits/symbol → Bit rate = 3 × Baud

### Shannon-Hartley Theorem (Channel Capacity)

```
C = B × log₂(1 + SNR)
```

Where:

- C = channel capacity (bits/second)
- B = bandwidth (Hz)
- SNR = signal-to-noise ratio (not dB)

**Example**:

- B = 3000 Hz
- SNR = 1000 (30 dB)
- C = 3000 × log₂(1001) ≈ 30,000 bits/s

## Filter Design

### Cutoff Frequency (RC Low-Pass)

```
fc = 1 / (2π × R × C)
```

### Time Constant

```
τ = R × C
```

### Q Factor (Bandpass Filter)

```
Q = fc / BW
```

Where:

- fc = center frequency
- BW = -3dB bandwidth

**Higher Q = Narrower, more selective filter**

## Propagation

### Free Space Path Loss

```
FSPL(dB) = 20×log₁₀(d) + 20×log₁₀(f) + 32.45
```

Where:

- d = distance (km)
- f = frequency (MHz)

**Example** (100 km at 145 MHz):

- FSPL = 20×log₁₀(100) + 20×log₁₀(145) + 32.45
- FSPL = 40 + 43.2 + 32.45 = 115.65 dB

### Line-of-Sight Distance

```
d = 4.12 × (√h₁ + √h₂)
```

Where:

- d = distance (km)
- h₁, h₂ = antenna heights (meters)

**Example** (Both antennas at 10m):

- d = 4.12 × (√10 + √10) = 4.12 × 6.32 ≈ 26 km

### Fresnel Zone Radius

```
r = 17.3 × √(d₁ × d₂ / (f × d))
```

Where:

- r = radius (meters)
- d₁, d₂ = distances from antennas to point (km)
- f = frequency (GHz)
- d = total distance (km)

## Link Budget

### Received Power

```
Pr = Pt + Gt + Gr - Lt - Lr - Lp
```

Where (all in dB/dBm):

- Pr = received power
- Pt = transmit power
- Gt = transmit antenna gain
- Gr = receive antenna gain
- Lt = transmit losses
- Lr = receive losses
- Lp = path loss

**Example**:

- Pt = +30 dBm (1W)
- Gt = +6 dBi (directional)
- Gr = +2 dBi (vertical)
- Lt = -2 dB (cable)
- Lr = -1 dB (cable)
- Lp = -120 dB (path loss)
- Pr = 30 + 6 + 2 - 2 - 1 - 120 = -85 dBm

## FFT and Windowing

### Rectangular Window

```
w[n] = 1
```

### Hann (Hanning) Window

```
w[n] = 0.5 × (1 - cos(2π × n / (N-1)))
```

### Hamming Window

```
w[n] = 0.54 - 0.46 × cos(2π × n / (N-1))
```

### Blackman Window

```
w[n] = 0.42 - 0.5×cos(2π×n/(N-1)) + 0.08×cos(4π×n/(N-1))
```

### Kaiser Window

```
w[n] = I₀(πα√(1-(2n/(N-1)-1)²)) / I₀(πα)
```

Where:

- I₀ = modified Bessel function of first kind
- α = adjustable parameter

## Demodulation

### AM Envelope Detection

```
audio[n] = √(I[n]² + Q[n]²)
```

### FM Phase Discrimination

```
audio[n] = atan2(Q[n]×I[n-1] - I[n]×Q[n-1], I[n]×I[n-1] + Q[n]×Q[n-1])
```

### Instantaneous Frequency

```
fi = fc + (1/(2π)) × dφ/dt
```

## Complex Number Operations

### Magnitude

```
|z| = √(I² + Q²)
```

### Phase

```
φ = atan2(Q, I)
```

### Complex Multiplication

```
(I₁ + jQ₁) × (I₂ + jQ₂) = (I₁I₂ - Q₁Q₂) + j(I₁Q₂ + Q₁I₂)
```

### Complex Conjugate

```
z* = I - jQ
```

### Euler's Formula

```
e^(jθ) = cos(θ) + j×sin(θ)
```

## Frequency Conversions

### PPM to Hz

```
error(Hz) = (PPM / 1,000,000) × frequency(Hz)
```

**Example** (1 ppm error at 100 MHz):

- error = (1 / 1,000,000) × 100,000,000 = 100 Hz

### Hz to PPM

```
PPM = (error(Hz) / frequency(Hz)) × 1,000,000
```

## Time and Distance

### Time for Signal to Travel

```
t = d / c
```

Where:

- t = time (seconds)
- d = distance (meters)
- c = speed of light (3×10⁸ m/s)

**Example** (1 km):

- t = 1000 / 3×10⁸ = 3.33 µs

### Distance from Time Delay

```
d = c × t / 2
```

(Divide by 2 for round-trip like radar)

## AGC Time Constants

### Attack/Decay Time

```
α = 1 - e^(-1/(τ × fs))
```

Where:

- α = filter coefficient
- τ = time constant (seconds)
- fs = sample rate (Hz)

**Example** (10ms attack at 48kHz):

- α = 1 - e^(-1/(0.01 × 48000))
- α = 1 - e^(-1/480) ≈ 0.00208

## Doppler Shift

### Frequency Shift

```
Δf = (v / c) × f₀
```

Where:

- Δf = frequency shift
- v = relative velocity (m/s, positive = approaching)
- c = speed of light
- f₀ = transmitted frequency

**Example** (Satellite at 145 MHz, 7 km/s):

- Δf = (7000 / 3×10⁸) × 145×10⁶ = 3383 Hz ≈ 3.4 kHz

## Quick Reference Tables

### dBm to Voltage (50Ω system)

| dBm | Voltage (RMS) |
| --- | ------------- |
| +30 | 7.07 V        |
| +20 | 2.24 V        |
| +10 | 707 mV        |
| 0   | 224 mV        |
| -10 | 70.7 mV       |
| -20 | 22.4 mV       |
| -30 | 7.07 mV       |

### Common Frequency Multipliers

| Multiplier | dB     |
| ---------- | ------ |
| ×2         | +3 dB  |
| ×10        | +10 dB |
| ×100       | +20 dB |
| ×1000      | +30 dB |
| ÷2         | -3 dB  |
| ÷10        | -10 dB |

### Percentage to dB

| %     | dB    |
| ----- | ----- |
| 200%  | +6.0  |
| 150%  | +3.5  |
| 141%  | +3.0  |
| 100%  | 0     |
| 70.7% | -3.0  |
| 50%   | -6.0  |
| 10%   | -20.0 |
| 1%    | -40.0 |
