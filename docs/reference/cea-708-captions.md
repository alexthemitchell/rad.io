# CEA-708 Digital Closed Captions

## Overview

CEA-708 is the digital closed captioning standard for ATSC digital television in North America. It supersedes the analog CEA-608 standard and provides enhanced features including multiple caption services, advanced text styling, and flexible positioning.

## Technical Specification

### Transport Stream Integration

CEA-708 caption data is embedded in ATSC transport streams within:

- **User Data** sections of video elementary streams (H.264/AVC, MPEG-2)
- Typically found in SEI (Supplemental Enhancement Information) messages for H.264
- MPEG-2 user data for MPEG-2 video streams

### Data Structure

#### DTVCC Channel Packet

- **Service Block Header**: Identifies the caption service (1-6)
- **Block Data**: Contains caption commands and text

#### Caption Commands

- **Window Definition**: Create and configure caption windows
- **Text Commands**: Display characters with attributes
- **Positioning**: Row/column positioning within windows
- **Styling**: Font, color, edge attributes
- **Timing**: Display and clear commands

### Caption Services

CEA-708 supports up to 6 simultaneous caption services:

- **Service 1**: Primary language (typically English)
- **Service 2**: Secondary language (e.g., Spanish)
- **Service 3-6**: Additional services (alternate languages, descriptions)

### Window Management

Up to 8 windows can be defined:

- Independent positioning and sizing
- Z-order (layering) support
- Window priority for overlapping content
- Anchor point positioning (percentage-based)

### Text Styling Attributes

#### Font Styles

- Default, monospaced serif, proportional serif, monospaced sans-serif, proportional sans-serif
- Small caps, italic, bold, underline

#### Colors

- Foreground (text) color
- Background color
- Edge color (outline, shadow, etc.)
- Opacity levels (solid, flash, translucent, transparent)

#### Edge Attributes

- None, raised, depressed, uniform, drop shadow

### Character Set

CEA-708 uses a Unicode-based character set supporting:

- Basic Latin characters
- Latin-1 Supplement
- Special symbols and diacritics
- Music notes, bullets, and other graphical characters

## Implementation Considerations

### Extraction from Transport Stream

1. **Locate Video PID**: Use PMT to find video elementary stream
2. **Parse Video PES Packets**: Extract PES payload
3. **Find User Data**:
   - H.264: Look for SEI NAL units (type 6) with ATSC user data
   - MPEG-2: Look for user data start codes (0x000001B2)
4. **Extract DTVCC Packets**: Parse caption data structure

### Rendering Pipeline

1. **Service Selection**: User chooses which service to display
2. **Window Management**: Track active windows and their properties
3. **Text Buffer**: Maintain text content for each window
4. **Style Application**: Apply fonts, colors, and positioning
5. **HTML/Canvas Rendering**: Convert to visual output

### Synchronization

- Use PTS (Presentation Time Stamp) from video stream
- Caption commands include implicit timing
- Display windows when commanded, clear when instructed

### User Preferences

- Service/language selection
- Font size override
- Color/contrast adjustments for accessibility
- Position adjustment
- Background opacity

## References

- ANSI/CTA-708-E: Digital Television (DTV) Closed Captioning
- ATSC A/53 Part 4: MPEG-2 Video System Characteristics
- CEA-608: Line 21 Data Services (analog legacy)
- SMPTE 334: Vertical Ancillary Data Mapping of Caption Data

## Implementation Status

- [x] Caption packet extraction from video PES
- [x] DTVCC packet parsing
- [x] Service block decoder
- [x] Window manager
- [x] Text renderer with styling
- [x] User preferences UI
- [x] Export functionality
