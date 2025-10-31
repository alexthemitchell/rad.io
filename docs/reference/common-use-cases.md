<!-- markdownlint-disable MD036 -->

# Common Use Cases

## Overview

SDR technology enables a wide variety of applications. This guide covers the most popular use cases with practical setup information.

## 1. Radio Monitoring and Listening

### Broadcast Radio Reception

**Shortwave Broadcasting**

- **What**: Listen to international radio stations worldwide
- **Frequencies**: 3-30 MHz (see frequency allocations)
- **Mode**: AM, DRM (digital)
- **Best times**: Evening/night for long distance
- **Getting started**: Tune to 49m, 41m, 31m bands
- **Notable**: BBC World Service, Radio France International, Voice of America

**FM Radio**

- **What**: High-quality music and local stations
- **Frequencies**: 87.5-108 MHz
- **Mode**: WFM (wideband FM)
- **Features**: Stereo, RDS station info
- **Getting started**: Easiest signals to receive, great for testing SDR

**AM Radio**

- **What**: News, talk radio, sports
- **Frequencies**: 530-1710 kHz
- **Mode**: AM
- **Best times**: Night for distant stations
- **Tip**: Strong signals help verify SDR function

### Amateur Radio Monitoring

**Voice Contacts**

- **HF Bands**: 80m, 40m, 20m, 17m, 15m, 12m, 10m
- **Modes**: SSB (USB above 10 MHz, LSB below), AM, FM
- **Listen for**: Contests, DX (long distance), nets, emergency drills
- **Best times**: Varies by band and propagation

**Digital Modes**

- **FT8**: Weak signal digital communication
  - Frequencies: 3.573, 7.074, 14.074, 21.074 MHz
  - Software: WSJT-X
  - Active 24/7 worldwide
  - Great propagation indicator
- **PSK31**: Keyboard chat
  - Common around 14.070 MHz
  - Software: fldigi
- **SSTV**: Slow scan television (images)
  - Usually around 14.230 MHz
  - Software: QSSTV, MMSSTV
  - ISS sometimes transmits SSTV

**Morse Code (CW)**

- **Frequencies**: Lower part of each amateur band
- **Use**: Long distance weak signal work
- **Challenge**: Requires learning Morse code
- **Reward**: Best signal-to-noise ratio of any mode

### VHF/UHF Repeaters

**What**: Amateur radio voice repeaters provide wide area coverage

**Frequencies**:

- 2m band: 144-148 MHz (FM)
- 70cm band: 420-450 MHz (FM)

**Finding repeaters**: RepeaterBook, local club websites

**Listening**:

- Simplex calling frequencies
- CTCSS/PL tones filter access
- Regular nets and conversations

---

## 2. Aviation Monitoring

### Air Traffic Control

**What**: Listen to pilots and controllers in real-time

**Frequencies**: 118-137 MHz AM

- **121.5 MHz**: Emergency frequency (monitor carefully)
- **123.45 MHz**: Unofficial air-to-air (USA)
- **Tower frequencies**: 118-119 MHz typically
- **Approach/Departure**: 119-128 MHz typically
- **ATIS (weather)**: Often around 127 MHz

**Setup**:

- Mode: AM
- Bandwidth: 8 kHz
- Antenna: Vertical or dipole works well
- Location: Near airport for best results

**Tips**:

- Find local airport frequencies online (AirNav, airport websites)
- Busiest times: Morning and evening rush hours
- Listen for callsigns, altitudes, headings

**Software**: SDR# with airport frequency database

### Aircraft Tracking (ADS-B)

**What**: Track aircraft positions in real-time

**Frequency**: 1090 MHz

**Requirements**:

- SDR with 1090 MHz capability (RTL-SDR with upconverter, or ADS-B specific dongle)
- Small antenna or specialized ADS-B antenna
- Line of sight to aircraft

**Software**:

- dump1090 (decoder)
- Virtual Radar Server (visualization)
- tar1090 (web interface)
- Integration with FlightAware, FlightRadar24

**Data received**:

- Aircraft position (latitude/longitude)
- Altitude
- Speed and heading
- Flight number
- Aircraft type

**Use cases**:

- Track local air traffic
- Feed aggregators (FlightAware)
- Weather forecasting (track weather planes)

### HF Aeronautical

**What**: Long-distance aviation communication

**Frequencies**: 2-22 MHz USB

- **8891 kHz**: Very active
- **13306 kHz**: Volmet weather broadcasts

**Mode**: USB
**Best for**: Monitoring transoceanic flights

---

## 3. Marine Monitoring

### VHF Marine

**What**: Ship-to-ship and ship-to-shore communication

**Frequencies**: 156-162 MHz

- **156.800 MHz**: Channel 16 - Calling and distress (monitor only)
- **157.100 MHz**: Weather broadcasts (USA)

**Mode**: NFM
**Bandwidth**: 12.5 kHz

**Use cases**:

- Coast guard operations
- Port operations
- Weather reports
- Emergency monitoring

### AIS (Automatic Identification System)

**What**: Vessel tracking system

**Frequencies**:

- 161.975 MHz (AIS 1)
- 162.025 MHz (AIS 2)

**Modulation**: GMSK 9600 baud

**Software**:

- AIS Dispatcher
- OpenCPN
- ShipPlotter

**Data received**:

- Vessel position
- Speed and heading
- Ship name and type
- Destination

**Use cases**:

- Track maritime traffic
- Port monitoring
- Marine weather patterns

### HF Marine SSB

**Frequencies**: Various 2-22 MHz
**Mode**: USB
**Use**: Long-distance maritime communication

---

## 4. Weather Monitoring

### Weather Satellites (APT)

**What**: Receive images from polar orbiting satellites

**Satellites and frequencies**:

- **NOAA 15**: 137.6125 MHz
- **NOAA 18**: 137.9125 MHz
- **NOAA 19**: 137.1000 MHz

**Mode**: WFM
**Bandwidth**: ~40 kHz

**Software**:

- WXtoImg (classic, Windows)
- SatDump (modern, cross-platform)
- NOAA APT Decoder

**Setup**:

1. Track satellite passes (Orbitron, Gpredict)
2. Use V-dipole or QFH antenna
3. Record IQ data or audio during pass
4. Decode to image

**Results**: Visible and infrared Earth images

**Best for**: Weather monitoring, education, impressive visuals

### HRPT (High Resolution)

**What**: High-resolution satellite imagery

**Frequencies**: ~1.7 GHz
**Requirements**:

- Upconverter or L-band capable SDR
- Dish antenna
- LNA (low noise amplifier)

**Higher complexity but much better images**

### Geostationary Satellites (GOES, Meteosat)

**Frequencies**: L-band (1.69 GHz)
**Data**: Continuous weather imagery
**Requirements**: Dish antenna, specialized receiver

---

## 5. Satellite Communication

### Amateur Radio Satellites

**What**: FM and SSB transponders in space

**Frequencies**:

- Uplink: 2m or 70cm
- Downlink: 2m or 70cm (opposite band)

**Mode**: USB, FM depending on satellite

**Use cases**:

- Listen to QSOs through satellites
- Hear CW beacons
- Track passes

**Popular satellites**: SO-50, AO-91, ISS

**Software**: Gpredict for tracking

### ISS (International Space Station)

**Frequencies**:

- **145.800 MHz**: Voice downlink
- **145.825 MHz**: Packet radio/APRS
- **437.550 MHz**: SSTV when active

**Listen for**:

- Astronaut voice contacts (scheduled)
- School contacts
- APRS digipeater
- SSTV events (images from space)

---

## 6. Signal Intelligence (SIGINT)

### Numbers Stations

**What**: Mysterious shortwave broadcasts, likely espionage

**Frequencies**: Scattered across HF spectrum
**Mode**: AM, USB
**Characteristics**: Synthesized voice reading numbers or phonetics

**Notable**:

- The Buzzer (UVB-76): 4625 kHz
- Lincolnshire Poacher: 6712 kHz (inactive)

**Use cases**:

- Historical interest
- Signal analysis practice

### Utility Monitoring

**What**: Non-amateur HF communication

**Types**:

- Military communication (encrypted)
- Diplomatic services
- Time signals (WWV, CHU)
- Over-the-horizon radar
- Data links (HFDL)

**Use cases**:

- Propagation studies
- Learning signal types
- Technical interest

---

## 7. Space Signal Monitoring

### Meteor Scatter

**What**: VHF signals reflected off meteor trails

**Frequencies**: 6m amateur band (50 MHz)
**Duration**: Brief bursts (milliseconds to seconds)
**Best during**: Meteor showers

### Satellite Telemetry

**What**: Data downlinks from satellites

**Examples**:

- CubeSat beacons
- Amateur satellites
- Weather satellite telemetry

**Frequencies**: VHF/UHF various

### Deep Space Missions

**What**: Listen to spacecraft (Voyager, Mars missions)

**Frequencies**: S-band, X-band (2-8 GHz)
**Requirements**: Large dish, specialized equipment
**Difficulty**: Expert level

---

## 8. APRS and Tracking

### Automatic Position Reporting System

**What**: Real-time position and data reports

**Frequency**: 144.390 MHz (North America)
**Mode**: 1200 baud AFSK
**Protocol**: AX.25 packet radio

**Software**:

- direwolf (decoder)
- Xastir (client)
- APRS.fi (web tracking)

**See on map**:

- Mobile stations (cars, hikers)
- Weather stations
- Digipeaters
- Messages

**Use cases**:

- Track friends during events
- Monitor weather sensors
- Emergency communication tracking

---

## 9. Pager Monitoring

**What**: Numeric and alphanumeric pager messages

**Frequencies**:

- 137-138 MHz (varies by region)
- 152-153 MHz
- 929-932 MHz

**Protocols**: POCSAG, FLEX

**Software**: PDW (Pager Decoder), multimon-ng

**Use cases**:

- Monitor emergency services (where legal)
- Understand legacy infrastructure
- Traffic monitoring

**Note**: Privacy and legal considerations apply

---

## 10. Radio Astronomy

### Solar Monitoring

**What**: Detect solar radio emissions

**Frequencies**: VHF and above
**Use**: Solar flare detection, space weather

### Jupiter

**What**: Detect radio emissions from Jupiter

**Frequencies**: ~20 MHz
**Challenges**: Requires large antenna, specific geometry

### Meteor Detection

**What**: Detect meteor reflections

**Method**: Monitor TV or FM transmitters, detect reflections

**Software**: Spectrum Lab, SpectrumLab

---

## 11. RF Analysis and Education

### Spectrum Monitoring

**What**: Analyze local RF environment

**Use cases**:

- Find interference sources
- Study propagation
- Optimize antenna placement
- EMI troubleshooting

### Learning DSP

**What**: Understand signal processing

**Activities**:

- Write custom demodulators
- Experiment with filters
- Analyze modulation schemes
- Study waterfall patterns

### Protocol Reverse Engineering

**What**: Decode proprietary protocols

**Examples**:

- Wireless sensors
- Remote controls
- Wireless thermometers
- Tire pressure sensors

**Tools**: Universal Radio Hacker (URH)

---

## 12. Emergency Communication Monitoring

### Weather Alerts

**What**: NOAA Weather Radio

**Frequencies**: 162.400-162.550 MHz (USA)
**Mode**: NFM
**Encoding**: SAME (Specific Area Message Encoding)

**Software**: Decoders can alert for local warnings

### Emergency Services

**What**: Monitor public safety (where legal)

**Types**:

- Police, fire, EMS
- Coast Guard
- Search and rescue

**Note**: Many areas have moved to encrypted digital systems (P25, DMR)

**Legal**: Varies by jurisdiction, research local laws

---

## Setup Recommendations by Use Case

| Use Case           | Frequency Range      | Recommended Antenna     | Difficulty |
| ------------------ | -------------------- | ----------------------- | ---------- |
| FM Broadcast       | 88-108 MHz           | Dipole, telescopic      | Easy       |
| AM Broadcast       | 530-1710 kHz         | Long wire               | Easy       |
| HF Shortwave       | 3-30 MHz             | Dipole, long wire, loop | Medium     |
| Aviation VHF       | 118-137 MHz          | Vertical, dipole        | Easy       |
| Weather Satellites | 137 MHz              | V-dipole, QFH           | Medium     |
| ADS-B              | 1090 MHz             | Collinear, specialized  | Easy       |
| Marine VHF         | 156-162 MHz          | Vertical                | Easy       |
| Amateur 2m/70cm    | 144-148, 420-450 MHz | Vertical, J-pole        | Easy       |
| HF Amateur         | 3.5-30 MHz           | Dipole, EFHW            | Medium     |
| AIS                | 161-162 MHz          | Vertical                | Medium     |

---

## Getting Started Guide

**Step 1**: Choose a use case that interests you
**Step 2**: Verify your SDR covers the frequencies needed
**Step 3**: Set up appropriate antenna
**Step 4**: Install necessary software
**Step 5**: Find active frequencies for your location
**Step 6**: Start listening and learning!

## Legal and Ethical Considerations

- **Receiving is generally legal** in most countries
- **Never retransmit** what you hear
- **Respect privacy**: Don't share private communications
- **Emergency frequencies**: Monitor but don't interfere
- **Encryption**: Don't attempt to break encrypted signals
- **Local laws**: Research specific regulations in your area

## Resources

- **[Radio Reference](https://www.radioreference.com/)**: Frequency database
- **[SigIDWiki](http://sigidwiki.com/)**: Signal identification
- **[RepeaterBook](https://www.repeaterbook.com/)**: Amateur radio repeaters
- **[HFCC](https://www.hfcc.org/)**: Shortwave broadcast schedules
- **[N2YO](https://www.n2yo.com/)**: Satellite tracking
