# CEA-708 Closed Caption Implementation

## Overview

Comprehensive CEA-708 digital closed caption decoder and renderer for ATSC broadcasts in rad.io project. Follows existing decoder patterns (AC3Decoder, ATSCVideoDecoder) and integrates seamlessly with ATSC Player.

## Components

### CEA708Decoder (`src/decoders/CEA708Decoder.ts`)

Core decoder supporting up to 6 caption services with full CEA-708 DTVCC packet parsing.

**Key Features:**
- H.264 SEI and MPEG-2 user data extraction
- Service block parsing with command processing
- Window management (up to 8 windows per service)
- Pen attributes (fonts, colors, positioning, styling)
- Text export (plain text and SRT format)
- Comprehensive metrics and error handling

**Usage:**
```typescript
const decoder = new CEA708Decoder(
  (caption: DecodedCaption) => {
    // Caption output callback
    renderer.render(caption);
  },
  (error: Error) => {
    // Error callback
    console.error(error);
  }
);

decoder.initialize({ preferredService: 1 });
decoder.processVideoPayload(videoData, pts);
```

### CaptionRenderer (`src/decoders/CaptionRenderer.ts`)

HTML/CSS-based renderer with full styling support.

**Key Features:**
- Font family support (serif, sans-serif, monospace, casual, cursive)
- Color customization (foreground, background, edge)
- Edge effects (drop shadow, raised, depressed, uniform)
- Opacity control
- Position and alignment

**Usage:**
```typescript
const renderer = new CaptionRenderer({
  container: document.getElementById('captions'),
  config: {
    fontSize: 20,
    edgeStyle: 'drop_shadow',
    windowOpacity: 0.8,
  }
});

renderer.render(decodedCaption);
```

### CaptionPreferences (`src/components/CaptionPreferences.tsx`)

React component for user caption preferences with:
- Service/language selection
- Font size control (12-36px)
- Color pickers with presets
- Edge style selection
- Opacity slider

## Integration with ATSC Player

### Hook Integration (`src/hooks/useATSCPlayer.ts`)

Caption processing integrated into video pipeline:

1. **Initialization**: Caption decoder/renderer created when video decoder initializes
2. **Processing**: Video payloads processed for both video and captions
3. **PTS Extraction**: Timestamps extracted from transport stream packets
4. **Toggling**: Caption rendering controlled by `closedCaptionsEnabled` state
5. **Cleanup**: Proper disposal on playback stop

**Key Code Points:**
- `initializeCaptionDecoder()`: Sets up decoder and renderer
- Video payload loop: Processes same payloads for captions
- `toggleClosedCaptions()`: Enables/disables and clears display
- Cleanup section: Destroys decoder and renderer

### Data Flow

```
Transport Stream → Parser → Video Packets (PID filtered)
                              ↓
                         Video Payload (Uint8Array)
                              ↓
                    ┌─────────┴──────────┐
                    ↓                    ↓
            Video Decoder          CEA708 Decoder
                    ↓                    ↓
             Video Renderer      Caption Renderer
                    ↓                    ↓
              Canvas Display      HTML Overlay
```

## Caption Data Structure

### DTVCC Packet Format
```
[0x03] [packet_size] [service_blocks...]
```

### Service Block Format
```
[header: service_num|block_size] [commands and text...]
```

### Commands Supported
- **C0 Commands**: ETX, BS, FF, CR, HCR
- **C1 Commands**: CW0-7, CLW, DSW, HDW, TGW, DLW, DLC, RST, SPA, SPC, SPL, SWA, DF0-7
- **Text**: G0 (ASCII) and G1 (extended) character sets

## Testing

- **CEA708Decoder**: 32 unit tests covering packet parsing, service management, command processing, export
- **CaptionRenderer**: 27 unit tests for rendering, styling, configuration
- **CaptionPreferences**: 13 unit tests for UI interactions and state management
- **Integration**: useATSCPlayer tests verify hook integration

## Code Quality Notes

- TypeScript strict mode, explicit types
- No implicit any, proper null handling
- ESLint passing with `no-param-reassign` exceptions for DOM/object mutations
- Comprehensive error handling and logging
- Memory management (proper cleanup on close/destroy)

## Performance Considerations

- Caption processing happens in same loop as video processing
- No additional latency introduced
- Efficient packet parsing with early returns
- Styled text cached in caption overlay (not re-rendered every frame)

## Future Enhancements

- Multi-language support with automatic detection
- Caption recording/replay
- Advanced styling presets
- Caption search/navigation
- CEA-608 legacy format support
- ATSC 3.0 caption support

## Files

- `src/decoders/CEA708Decoder.ts` - Main decoder (800+ lines)
- `src/decoders/CaptionRenderer.ts` - HTML renderer (300+ lines)
- `src/components/CaptionPreferences.tsx` - UI component (350+ lines)
- `src/decoders/__tests__/CEA708Decoder.test.ts` - Decoder tests
- `src/decoders/__tests__/CaptionRenderer.test.ts` - Renderer tests
- `src/components/__tests__/CaptionPreferences.test.tsx` - UI tests
- `docs/reference/cea-708-captions.md` - Technical documentation
