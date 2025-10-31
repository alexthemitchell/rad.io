<!-- markdownlint-disable MD036 -->
# Frequency Allocations

## Overview

Radio spectrum is allocated by international and national regulatory bodies. This guide provides common frequency allocations for popular SDR monitoring activities.

**Note**: Allocations vary by country and region. Always verify local regulations before use.

## VLF (Very Low Frequency): 3-30 kHz

**Use**: Long-range navigation, time signals, submarine communication

- **19.6 kHz**: GBR (Anthorn, UK) - MSK submarine communication
- **20.27 kHz**: ICV (Tavolara, Italy) - Navy communication
- **24.0 kHz**: DHO38 (Germany) - Navy time signal

**Reception**: Requires large antenna or active loop antenna. Atmospheric noise dominated.

## LF (Low Frequency): 30-300 kHz

**Use**: Navigation beacons (NDB), time signals, AM broadcasting

- **60 kHz**: WWVB (USA) - Time signal
- **77.5 kHz**: DCF77 (Germany) - Time signal
- **135.7-137.8 kHz**: Amateur radio band (allocation varies)
- **153-279 kHz**: LF AM broadcasting (Europe, Africa, Asia)

## MF (Medium Frequency): 300-3000 kHz

### AM Broadcast Band: 530-1710 kHz (Americas), 531-1602 kHz (Europe)

**Stations every 9 kHz (Europe) or 10 kHz (Americas)**

Popular frequencies:

- **540 kHz**: Common frequency for low-power stations
- **810 kHz**: WGY (New York), high-power clear channel
- **1500 kHz**: KSTP (Minneapolis-St. Paul)

### Marine Band

- **2182 kHz**: International distress frequency (AM)
- **2000-3000 kHz**: Various marine voice channels (USB)

### Amateur Radio (HF)

- **1800-2000 kHz**: 160m band - Long distance night propagation
  - **1838 kHz**: CW calling frequency
  - **1843 kHz**: Digital modes (FT8)

## HF (High Frequency): 3-30 MHz

The most popular SDR monitoring range due to long-distance propagation.

### Broadcast Bands

#### 90m Band: 3200-3400 kHz

- Tropical broadcasting (Africa, Asia, South America)
- Best at night

#### 75m Band: 3900-4000 kHz

- International broadcasting
- Asian/Pacific services

#### 60m Band: 4750-5060 kHz

- International broadcasting
- Active during evening/night

#### 49m Band: 5900-6200 kHz

- Major international broadcasting band
- Good 24-hour propagation
- **5950 kHz**: Common broadcast frequency

#### 41m Band: 7200-7450 kHz

- International broadcasting
- Excellent evening propagation

#### 31m Band: 9400-9900 kHz

- Very active international broadcasting
- Good daytime and evening propagation
- **9550 kHz**: Active frequency

#### 25m Band: 11600-12100 kHz

- International broadcasting
- Best during daytime

#### 22m Band: 13570-13870 kHz

- International broadcasting
- Daytime propagation

#### 19m Band: 15100-15800 kHz

- Major international broadcasting band
- Peak during daytime
- **15265 kHz**: Radio France International

#### 16m Band: 17480-17900 kHz

- International broadcasting
- Daytime propagation

#### 13m Band: 21450-21850 kHz

- International broadcasting
- Daytime, depends on solar cycle

#### 11m Band: 25600-26100 kHz

- International broadcasting
- Best during high solar activity

### Amateur Radio Bands

#### 80m: 3500-4000 kHz

- **3573 kHz**: FT8 digital mode
- **3560 kHz**: CW calling frequency (USA)
- Night-time propagation, regional to continental

#### 60m: 5330-5405 kHz (varies by region)

- Limited power in many countries
- Good for regional contacts

#### 40m: 7000-7300 kHz

- **7074 kHz**: FT8 digital mode (primary)
- **7030 kHz**: CW calling frequency
- Excellent night propagation, day propagation also good

#### 30m: 10100-10150 kHz

- **10136 kHz**: FT8, FT4, WSPR
- CW and digital modes only (no voice)
- Good worldwide propagation

#### 20m: 14000-14350 kHz

- **14074 kHz**: FT8 digital mode (very active)
- **14230 kHz**: SSTV (Slow Scan TV)
- **14300 kHz**: Digital voice modes
- Best DX band, worldwide propagation during day

#### 17m: 18068-18168 kHz

- **18100 kHz**: FT8
- Daytime propagation
- Less crowded than 20m

#### 15m: 21000-21450 kHz

- **21074 kHz**: FT8
- **21340 kHz**: SSTV
- Excellent during high solar activity

#### 12m: 24890-24990 kHz

- **24915 kHz**: FT8
- Daytime propagation
- Good during solar maximum

#### 10m: 28000-29700 kHz

- **28074 kHz**: FT8
- **28120 kHz**: Digital modes
- **28400-28600 kHz**: Satellite downlinks
- Sporadic E propagation, solar cycle dependent

### Utility Stations

#### Aviation

- **2850-22000 kHz**: Various HF aviation channels (USB)
- **8891 kHz**: Very active aeronautical channel
- **11387 kHz**: HFDL (High Frequency Data Link)
- **13306 kHz**: Volmet (weather broadcasts)

#### Maritime

- **4125, 6215, 8291, 12290, 16420 kHz**: Maritime SSB channels
- **8417 kHz**: Coast Guard communications

#### Military

- Wide variety across HF spectrum (USB, encrypted)
- **6712 kHz**: "Lincolnshire Poacher" (numbers station)
- **11175 kHz**: Active military channel

#### Time and Frequency Signals

- **2500 kHz**: WWV (USA)
- **5000 kHz**: WWV (USA), RWM (Russia)
- **10000 kHz**: WWV (USA)
- **15000 kHz**: WWV (USA)
- **20000 kHz**: WWV (USA)

## VHF (Very High Frequency): 30-300 MHz

Line-of-sight propagation, local to regional coverage.

### FM Broadcast: 87.5-108 MHz

- **Stereo FM**: 200 kHz bandwidth
- **RDS Data**: Radio text and station info
- Use WFM (wideband FM) mode

### Aviation: 118-137 MHz

- **121.5 MHz**: Emergency frequency
- **123.45 MHz**: Unofficial air-to-air (USA)
- **127.0 MHz**: ATIS (weather/airport info)
- Use AM mode, 8.33 kHz or 25 kHz channels

### Marine VHF: 156-162 MHz

- **156.8 MHz**: Channel 16 - Calling and distress
- **161.975 MHz**: AIS (Automatic Identification System)
- **162.025 MHz**: AIS
- Use NFM mode (except AIS uses FSK)

### Amateur Radio

#### 6m: 50-54 MHz

- **50.313 MHz**: FT8 digital mode
- Sporadic E propagation possible
- Use USB for voice

#### 2m: 144-148 MHz

- **145.500 MHz**: Calling frequency (varies by region)
- **144.390 MHz**: APRS (Automatic Position Reporting)
- **146-148 MHz**: FM repeaters (varies by region)
- **144.174 MHz**: FT8
- Use FM for repeaters, USB for SSB/digital

### Weather Satellites: 137 MHz

- **137.1000 MHz**: NOAA 18 (APT)
- **137.6250 MHz**: NOAA 15 (APT)
- **137.9125 MHz**: NOAA 19 (APT)
- Use WFM mode, record IQ for processing

### Pagers: 137-138 MHz, 152-153 MHz (varies by region)

- POCSAG/FLEX protocols
- Narrowband FM

## UHF (Ultra High Frequency): 300-3000 MHz

### Amateur Radio

#### 70cm: 420-450 MHz (varies by region)

- **432.065 MHz**: FT8 digital mode
- **446 MHz**: PMR446 (Europe) - License-free radios
- Use FM for repeaters, USB for SSB/digital

### Aviation

- **1090 MHz**: ADS-B (Aircraft position/data)
- Requires dedicated receiver or upconverter
- Decode with dump1090 software

### Satellites

#### Weather Satellites: 1.7 GHz

- **1698 MHz**: NOAA HRPT (High Rate Picture Transmission)
- **1707 MHz**: MetOp HRPT
- Requires dish antenna

#### Communication Satellites: Various L-band, C-band

- **1530-1545 MHz**: Inmarsat downlink
- Requires specialized antennas

### GNSS (GPS, GLONASS, Galileo)

- **1575.42 MHz**: GPS L1
- **1227.60 MHz**: GPS L2
- Weak signals, requires low-noise preamp

## Propagation Tips

### Day vs Night

- **HF Low Bands (80m, 40m)**: Better at night, absorbed by D-layer during day
- **HF High Bands (20m, 15m, 10m)**: Better during day, ionosphere needs solar ionization
- **VHF/UHF**: Generally line-of-sight, some tropospheric ducting

### Solar Cycle

- **Solar Maximum**: Excellent HF propagation, especially 10m-15m bands open
- **Solar Minimum**: Focus on 40m-20m, higher bands often dead

### Seasonal Variations

- **Summer**: More thunderstorm noise on HF, sporadic E on VHF
- **Winter**: Lower noise floor on HF, better long-distance contacts

## Best Starting Points for SDR Exploration

1. **FM Broadcast (88-108 MHz)**: Easy strong signals to verify SDR operation
2. **Amateur 20m FT8 (14.074 MHz)**: Almost always active, good propagation indicator
3. **Aviation (118-137 MHz)**: Active throughout the day, easy to decode
4. **Weather Satellites (137 MHz)**: Scheduled passes, visual results
5. **Broadcast 49m/31m (5.9-6.2, 9.4-9.9 MHz)**: Strong signals, variety of languages
6. **ADS-B (1090 MHz)**: Track aircraft in real-time

## Resources

- **[Signal Identification Guide](http://www.sigidwiki.com/)**: Database of signal types
- **WebSDR Network**: Remote SDR receivers worldwide
- **Frequency Database Apps**: Check local allocations
