# Antenna Theory and Practice

## Overview

The antenna is your window to the radio spectrum. Understanding antenna fundamentals helps optimize reception quality across different frequencies.

## Basic Principles

### How Antennas Work

**Transmitting**: Converts electrical energy to electromagnetic waves
**Receiving**: Converts electromagnetic waves to electrical energy

**Reciprocity**: An antenna's transmit and receive characteristics are identical.

### Key Antenna Parameters

#### Resonant Frequency

Frequency at which antenna is naturally tuned (lowest SWR).

#### Bandwidth

Range of frequencies over which antenna performs acceptably.

- Narrow: High-Q, efficient at resonance
- Wide: Lower efficiency, works across broad range

#### Gain

Directional focusing of radiated energy, measured in dBi (relative to isotropic) or dBd (relative to dipole).

- **Isotropic**: Theoretical point source, 0 dBi reference
- **Dipole**: Real antenna, 2.15 dBi gain
- **Vertical**: 0-3 dBi typical
- **Yagi**: 6-15 dBi typical

#### Radiation Pattern

3D shape showing antenna's directional characteristics.

- **Omnidirectional**: Equal all directions (horizontal plane)
- **Directional**: Focused in specific direction(s)

#### Polarization

Orientation of electric field.

- **Vertical**: Perpendicular to ground (VHF/UHF common)
- **Horizontal**: Parallel to ground (HF common)
- **Circular**: Rotating (satellites)

**Match polarization for best signal**: Vertical ↔ Vertical, Horizontal ↔ Horizontal

#### SWR (Standing Wave Ratio)

Measure of impedance match.

- **1:1**: Perfect match
- **<2:1**: Good
- **>3:1**: Poor, likely issues

## Common Antenna Types

### Dipole

**Description**: Half-wavelength wire, center-fed

**Length**: λ/2 = 142.65/f(MHz) meters

**Radiation Pattern**: Broadside to wire, nulls off ends

**Polarization**: Depends on orientation

- Horizontal: parallel to ground
- Vertical: perpendicular to ground

**Impedance**: ~72Ω at resonance

**Gain**: 2.15 dBi reference

**Best for**:

- HF all-around use
- Fixed frequency operation
- Simple, cheap, effective

**Mounting**:

- Horizontal: as high as possible
- Inverted-V: center high, ends sloping down

**Example** (20m band, 14.2 MHz):

- Total length: 142.65 / 14.2 = 10.05m
- Each leg: 5.02m

---

### Vertical / Ground Plane

**Description**: Quarter-wave vertical element with ground plane radials

**Length**: λ/4 = 71.3/f(MHz) meters

**Radiation Pattern**: Omnidirectional (horizontal plane), low angle

**Polarization**: Vertical

**Impedance**: ~36Ω (ideal ground plane)

**Gain**: 0-3 dBi

**Best for**:

- VHF/UHF mobile
- 360° coverage
- DX on HF (low angle)
- Limited space

**Ground plane**:

- 4 radials minimum (more is better)
- Each λ/4 long
- 45° downward angle optimal

---

### Loop

**Small Loop (Magnetic)**:

- Diameter << λ
- Low efficiency but quiet (less noise pickup)
- Directional (nulls perpendicular to plane)
- Best for: RFI reduction, direction finding

**Full-Wave Loop**:

- Perimeter = 1λ
- Good efficiency
- Lower angle than dipole
- Best for: HF all-around, NVIS

---

### Yagi (Beam)

**Description**: Directional with driven element, reflector, directors

**Gain**: 6-15 dBi typical

**Radiation Pattern**: Highly directional, narrow beamwidth

**Elements**:

- Reflector: slightly longer than driven element (behind)
- Driven element: fed element (middle)
- Directors: slightly shorter (front)

**Best for**:

- Long distance (DX)
- Weak signal work
- Rejecting interference from sides/back
- Satellites (tracking required)

**Considerations**:

- Must aim at station
- Narrow bandwidth
- Wind load
- Rotation system needed

---

### Discone

**Description**: Wideband vertical, disc over cone

**Bandwidth**: Multi-octave (e.g., 100-1000 MHz)

**Gain**: Negative (~-3 dBi)

**Radiation Pattern**: Omnidirectional

**Best for**:

- Scanning wide frequency ranges
- Base station monitoring
- When simplicity > efficiency

---

### Colinear

**Description**: Multiple vertical elements in phase

**Gain**: 3-6 dBi

**Radiation Pattern**: Omnidirectional, low angle

**Best for**:

- VHF/UHF base stations
- Improved range over basic vertical

---

### Active / Amplified Antennas

**Description**: Built-in low-noise amplifier

**Pros**:

- Compact
- Better weak signal performance
- Less cable loss impact

**Cons**:

- Requires power
- Can overload in strong signal areas
- More expensive
- Noise figure varies

**Best for**:

- HF portable
- Limited space
- Weak signal locations

---

## Frequency-Specific Recommendations

### VLF/LF (10-300 kHz)

**Challenge**: Enormous wavelengths (km scale)

**Solutions**:

- Large wire loops (many turns)
- Active loop antennas
- Long wire with matching network

**Commercial**: MiniWhip, PA0RDT active antenna

---

### MF (AM Broadcast, 530-1700 kHz)

**Options**:

- Long wire (10-30m)
- Large loop
- Ferrite bar antenna (portable)

**Grounding important** for performance

---

### HF (3-30 MHz)

**Most Popular**:

1. **Dipole**: Best all-around, needs space
2. **EFHW (End-Fed Half-Wave)**: One support point, easy setup
3. **Vertical**: Small footprint, omnidirectional
4. **Loop**: Quiet, good for high-noise environments

**Height matters**: Higher = better DX, lower = better NVIS

**Tuner often needed** for multi-band operation

---

### VHF (30-300 MHz)

**Common**:

- **1/4 wave vertical**: Mobile, base stations
- **1/2 wave dipole**: Simple, effective
- **J-Pole**: Easy to build
- **Yagi**: Directional work

**Line-of-sight**: Height and clear path critical

---

### UHF (300-1000 MHz)

**Similar to VHF** but:

- Smaller antennas
- Even more line-of-sight dependent
- Building penetration difficult

**Popular**:

- Collinear (base)
- Vertical (mobile)
- Yagi (satellites)

---

### L-Band and Above (>1 GHz)

**Requirements**:

- Very directional (dish, helix)
- Low-noise preamp critical
- Cable losses significant
- Precision pointing needed

**Applications**: Satellites, radar

---

## Practical Considerations

### Antenna Height

**HF**:

- Height = 1/2 wavelength: Good for DX (low angle)
- Height = 1/4 wavelength: Good for NVIS (high angle)

**VHF/UHF**:

- As high as possible (line-of-sight)
- 6-10m typical for base stations
- Avoid obstacles

### Feed Line (Coax Cable)

**Impedance**: 50Ω for most radio work

**Loss Increases With**:

- Frequency (worse at UHF than HF)
- Cable length
- Poor quality cable

**Common Types**:

- **RG-58**: Thin, flexible, lossy (HF only)
- **RG-8X**: Good compromise
- **RG-213**: Low loss, thick
- **LMR-400**: Excellent, professional
- **Hardline**: Lowest loss, expensive

**Rule**: Keep coax as short as possible, especially UHF+

### SWR and Matching

**High SWR causes**:

- Power loss (reflected)
- Transmitter damage (if transmitting)
- Reduced efficiency

**Solutions**:

- Adjust antenna length (tuning)
- Use antenna tuner (ATU)
- Check connections

**For receiving only**: High SWR less critical (just efficiency loss)

### Baluns and Transformers

**Balun**: Balanced-to-unbalanced

- Connects balanced antenna (dipole) to unbalanced feed line (coax)
- Prevents common-mode currents
- Reduces RFI

**Types**:

- **1:1**: Impedance unchanged, just balancing
- **4:1**: 200Ω balanced to 50Ω unbalanced

### RFI and Noise Reduction

**Common noise sources**:

- Switch-mode power supplies
- LED lights
- Computer monitors
- Solar panel inverters
- Power lines

**Reduction strategies**:

- Move antenna away from noise sources
- Use loop antenna (nulls noise)
- Active noise cancelling
- RF chokes on cables
- Filters

### Weather Protection

**All outdoor connections need**:

- Waterproof tape or self-amalgamating tape
- Coax seal
- UV-resistant materials

**Wire antennas**:

- Use stranded wire (flexes in wind)
- Proper strain relief
- Allow for thermal expansion

## Building Your Own

### Simple Wire Dipole

**Materials**:

- Wire (14-18 AWG stranded, copper)
- Center insulator
- End insulators
- Coax feed line
- Balun (optional but recommended)

**Steps**:

1. Calculate length: 142.65 / f(MHz) meters
2. Cut two equal pieces (half each)
3. Attach to center insulator
4. Add end insulators
5. Connect coax (center to one leg, shield to other)
6. Raise as high as possible
7. Tune by adjusting length

### Simple Ground Plane

**Materials**:

- Vertical element (λ/4)
- 4 radials (λ/4 each)
- SO-239 connector
- PVC or fiberglass support

**Steps**:

1. Calculate length: 71.3 / f(MHz) meters
2. Attach vertical to center pin
3. Attach radials to ground/shield
4. Angle radials downward (~45°)
5. Mount vertically
6. Connect coax

## Antenna Analyzers and Testing

### Measuring SWR

**Equipment**:

- SWR meter or antenna analyzer
- Transmitter (if using SWR meter)

**Process**:

1. Connect in line with antenna
2. Transmit low power (SWR meter) or scan (analyzer)
3. Read SWR across band
4. Adjust antenna for minimum SWR

### Field Strength Measurement

**Simple test**: Receive known beacon

- Note signal strength
- Compare over time
- A/B test antennas

## Safety

### Installation Safety

- **Power lines**: NEVER work near power lines
- **Height**: Use proper supports, climb safely
- **Lightning**: Ground properly, disconnect during storms
- **RF exposure**: Stay away from transmitting antennas

### Lightning Protection

- Ground rod at antenna base
- Disconnect during storms
- Surge protection on feed lines
- Proper grounding of station equipment

## Antenna Selection Guide

| **Use Case**            | **Recommended Antenna**    | **Why**                  |
| ----------------------- | -------------------------- | ------------------------ |
| HF all-band receive     | Longwire, discone, active  | Wide coverage            |
| HF single-band          | Dipole, vertical           | Best performance         |
| VHF/UHF base            | Colinear, vertical         | Good range               |
| VHF/UHF mobile          | 1/4 wave vertical          | Compact, omnidirectional |
| Satellite               | Yagi, QFH                  | Directional or circular  |
| Apartment/limited space | Active loop, magnetic loop | Compact, effective       |
| Direction finding       | Loop, Yagi                 | Directional patterns     |
| Low noise               | Small loop                 | Rejects electrical noise |

## Resources

- **ARRL Antenna Book**: Comprehensive reference
- **Online calculators**: 66pacific.com, m0ukd.com
- **NEC antenna modeling**: Free simulation software
- **Antenna forums**: eham.net, QRZ.com

## Common Misconceptions

**Myth**: More wire is always better
**Reality**: Resonant length matters more than total length

**Myth**: Expensive antenna always better
**Reality**: Simple dipole can outperform expensive antenna if properly installed

**Myth**: Must have low SWR to receive
**Reality**: SWR mainly affects transmit; receive less critical

**Myth**: Ground plane radials must be exact
**Reality**: Close is fine; more radials = better

**Myth**: Higher antenna always better
**Reality**: Depends on intended use (DX vs NVIS)
