# ATSC Electronic Program Guide (EPG) Implementation

## Overview

This implementation provides a complete Electronic Program Guide (EPG) system for ATSC digital television, extracting program information from PSIP (Program and System Information Protocol) tables and presenting it in a user-friendly grid format.

## Architecture

### Components

1. **ATSCProgramGuide** (`src/components/EPG/ATSCProgramGuide.tsx`)
   - Main container component
   - Handles view switching (grid vs. search)
   - Manages search and filtering state

2. **ProgramGrid** (`src/components/EPG/ProgramGrid.tsx`)
   - Time-based grid layout
   - Time navigation controls
   - Current time marker

3. **ChannelRow** (`src/components/EPG/ChannelRow.tsx`)
   - Displays programs for a single channel
   - Filters programs by visible time window

4. **ProgramCell** (`src/components/EPG/ProgramCell.tsx`)
   - Individual program display
   - Time-based positioning
   - Currently airing indicator

5. **ProgramDetailModal** (`src/components/EPG/ProgramDetailModal.tsx`)
   - Detailed program information
   - Action buttons (Watch, Remind, Record)

### Data Layer

1. **epgStorage** (`src/utils/epgStorage.ts`)
   - localStorage-based persistence
   - 24-hour data retention
   - Search and filtering functions
   - Genre extraction from PSIP descriptors

2. **psipTextDecoder** (`src/utils/psipTextDecoder.ts`)
   - Decodes PSIP MultipleStringStructure
   - Supports UTF-8 and UTF-16 encoding
   - GPS time conversion
   - Duration formatting

3. **useEPG** (`src/hooks/useEPG.ts`)
   - React hook for EPG data management
   - Automatic data loading
   - Search/filter state management

## Integration with ATSC Player

The EPG is integrated into the ATSCPlayer page with a tab-based interface:

1. **Player Tab** - Traditional video player with channel list
2. **Program Guide Tab** - EPG grid view

When a program is selected in the EPG, users can:

- Tune to the channel (for live programs)
- Set reminders (for upcoming programs)
- Schedule recordings (for upcoming programs)

## Data Population

### Current State

The EPG storage is ready to accept data from PSIP tables. The TransportStreamParser already supports:

- **EIT** (Event Information Table) - Program schedules
- **ETT** (Extended Text Table) - Detailed descriptions
- **VCT** (Virtual Channel Table) - Channel information

### Populating EPG Data

To populate the EPG with real data, call `EPGStorage.storeEPGData()` when PSIP tables are received:

```typescript
import { EPGStorage } from '../utils/epgStorage';
import type { EventInformationTable, ExtendedTextTable, VirtualChannel } from '../parsers/TransportStreamParser';

// When EIT is parsed
const eit: EventInformationTable = parser.getEIT(sourceId);
const vct: VirtualChannelTable = parser.getVCT();
const channel: VirtualChannel = vct.channels.find(ch => ch.sourceid === sourceId);

// Store EPG data
if (eit && channel) {
  // Optionally get ETT for extended descriptions
  const ett: ExtendedTextTable | null = parser.getETT(eventId);
  
  EPGStorage.storeEPGData(eit, ett, channel);
}
```

### Integration Points

The ideal places to add EPG data population:

1. **useATSCPlayer hook** (`src/hooks/useATSCPlayer.ts`)
   - When tuning to a channel
   - When receiving PSIP tables during playback

2. **useATSCScanner hook** (`src/hooks/useATSCScanner.ts`)
   - During channel scanning
   - When PSIP data is detected

3. **ATSC8VSBDemodulator** (`src/plugins/demodulators/ATSC8VSBDemodulator.ts`)
   - When processing transport stream packets
   - As PSIP tables are parsed

Example integration in useATSCPlayer:

```typescript
// In useATSCPlayer.ts
import { EPGStorage } from '../utils/epgStorage';

// After parsing transport stream
const processTransportStream = (data: Uint8Array) => {
  const packets = parser.parseStream(data);
  
  // Check for new EIT data
  const vct = parser.getVCT();
  if (vct) {
    vct.channels.forEach(channel => {
      const eit = parser.getEIT(channel.sourceid);
      if (eit) {
        // Try to get ETT for each event
        eit.events.forEach(event => {
          const ett = parser.getETT(event.eventid);
          EPGStorage.storeEPGData(eit, ett, channel);
        });
      }
    });
  }
};
```

## Features

### Search

- Full-text search across program titles and descriptions
- Case-insensitive matching
- Real-time results

### Filtering

- Genre-based filtering
- Automatic genre extraction from PSIP descriptors
- Combinable with search

### Time Navigation

- "Now" button to jump to current time
- Earlier/Later buttons for 3-hour increments
- Auto-scroll to current time on load
- Current time marker in grid

### Program Details

- Modal dialog with full program information
- Channel, time, duration, genre, rating
- HD indicator
- Status badges (Live, Upcoming, Ended)
- Context-aware action buttons

### Accessibility

- Full keyboard navigation
- ARIA labels and roles
- Focus management in modals
- Screen reader support

## Data Retention

EPG data is stored in localStorage with:

- 24-hour retention policy
- Automatic cleanup of old data
- Per-channel storage
- Timestamp tracking

## Genre Mapping

ATSC genre codes are mapped to readable strings:

| Code | Genre |
|------|-------|
| 0x01 | News |
| 0x02 | Sports |
| 0x03 | Talk Show |
| 0x04 | Drama |
| 0x05 | Comedy |
| 0x06 | Documentary |
| 0x07 | Music |
| 0x08 | Movies |
| 0x09 | Children |
| 0x0a | Educational |
| 0x0b | Reality |
| 0x0c | Game Show |

Additional genre codes can be added in `epgStorage.ts`.

## Future Enhancements

1. **Backend Integration**
   - Persistent reminder storage
   - Recording scheduler with file system API
   - Cloud sync for multi-device access

2. **Real-time Updates**
   - Live EPG updates from PSIP stream
   - Auto-refresh on channel tune
   - Background sync

3. **Advanced Features**
   - Parental controls integration
   - Favorites management
   - Series recording
   - Conflict resolution for recordings

4. **Performance**
   - Virtual scrolling for large datasets
   - IndexedDB for larger storage
   - Worker-based parsing

## Testing

Comprehensive test coverage includes:

- PSIP text decoding (UTF-8, UTF-16)
- EPG storage operations
- Search and filtering
- Component rendering
- Modal interactions
- Keyboard navigation

Run tests:

```bash
npm test -- --testPathPatterns="(EPG|epgStorage|psipTextDecoder)"
```

## References

- ATSC A/65: Program and System Information Protocol
- ATSC A/53: ATSC Digital Television Standard
- ISO/IEC 13818-1: MPEG-2 Systems
