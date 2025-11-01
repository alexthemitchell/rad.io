# P25 Transmission Logging and Priority System

## Overview

The P25 decoder now includes comprehensive transmission logging and talkgroup prioritization features. This enhancement allows users to:

1. **Log Transmission History**: Automatically record all P25 Phase 2 transmissions to IndexedDB for historical analysis
2. **Prioritize Talkgroups**: Assign priority levels (1-10) to talkgroups for preferential monitoring
3. **Search and Filter Logs**: Query transmission logs by talkgroup, source, time range, and signal quality
4. **Export Data**: Export transmission logs to CSV for external analysis

## Features

### Transmission Logging

All P25 Phase 2 transmissions can be automatically logged to a persistent IndexedDB database. Each transmission record includes:

- **Timestamp**: When the transmission occurred
- **Talkgroup ID**: The P25 talkgroup identifier
- **Source ID**: The radio unit identifier
- **Duration**: Length of transmission in milliseconds
- **Signal Quality**: Quality score (0-100)
- **Slot**: TDMA slot (1 or 2)
- **Encryption Status**: Whether the transmission was encrypted
- **Error Rate**: Detected error rate (0-1)

### Talkgroup Prioritization

The TalkgroupScanner component now supports priority levels:

- **Priority Range**: 1 (lowest) to 10 (highest)
- **Visual Controls**: Slider controls in both add and edit modes
- **Display**: Priority shown in talkgroup list

Priority levels can be used to implement preferential scanning logic where high-priority talkgroups are monitored more frequently or immediately when active.

### Transmission Log Viewer

The TransmissionLogViewer component provides:

- **Filtering**: By talkgroup ID, source ID, time range, and minimum signal quality
- **Sorting**: By timestamp, talkgroup, duration, or signal quality (ascending/descending)
- **Pagination**: Navigate through large log sets (50 records per page)
- **Export**: Download logs as CSV for external analysis
- **Accessible**: Full keyboard navigation and screen reader support

## Usage

### Basic Transmission Logging

```typescript
import { decodeP25Phase2WithLogging, getP25TransmissionLogger } from "./utils";

// Get the logger instance
const logger = getP25TransmissionLogger();
await logger.init();

// Decode samples with automatic logging
const transmissionStartTime = Date.now();
const decoded = await decodeP25Phase2WithLogging(samples, config, {
  logger,
  transmissionStartTime: transmissionStartTime,
});
```

### Manual Transmission Logging

```typescript
import { getP25TransmissionLogger } from "./utils/p25TransmissionLog";

const logger = getP25TransmissionLogger();
await logger.init();

// Log a transmission
await logger.logTransmission({
  timestamp: Date.now(),
  talkgroupId: 101,
  sourceId: 2001,
  duration: 5000,
  signalQuality: 85,
  slot: 1,
  isEncrypted: false,
  errorRate: 0.05,
});
```

### Querying Logs

```typescript
import { getP25TransmissionLogger } from "./utils/p25TransmissionLog";

const logger = getP25TransmissionLogger();
await logger.init();

// Get all transmissions for a specific talkgroup
const transmissions = await logger.queryTransmissions({
  talkgroupId: 101,
  limit: 100,
});

// Get transmissions within a time range
const recentTransmissions = await logger.queryTransmissions({
  startTime: Date.now() - 3600000, // Last hour
  endTime: Date.now(),
});

// Get high-quality transmissions
const qualityTransmissions = await logger.queryTransmissions({
  minQuality: 80,
});
```

### Using the TalkgroupScanner with Priorities

```typescript
import TalkgroupScanner from './components/TalkgroupScanner';

function MyComponent() {
  const [talkgroups, setTalkgroups] = useState([
    {
      id: "101",
      name: "Fire Dispatch",
      category: "Fire",
      priority: 8,
      enabled: true
    }
  ]);

  const handleUpdatePriority = (id: string, priority: number) => {
    setTalkgroups(prev =>
      prev.map(tg => tg.id === id ? { ...tg, priority } : tg)
    );
  };

  return (
    <TalkgroupScanner
      talkgroups={talkgroups}
      onTalkgroupToggle={handleToggle}
      onAddTalkgroup={handleAdd}
      onUpdatePriority={handleUpdatePriority}
    />
  );
}
```

### Using the TransmissionLogViewer

```typescript
import TransmissionLogViewer from './components/TransmissionLogViewer';

function LogsPage() {
  return (
    <div>
      <h1>P25 Transmission History</h1>
      <TransmissionLogViewer />
    </div>
  );
}
```

## Database Management

### Clearing Old Logs

```typescript
import { getP25TransmissionLogger } from "./utils/p25TransmissionLog";

const logger = getP25TransmissionLogger();
await logger.init();

// Delete logs older than 30 days
const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
const deletedCount = await logger.deleteOlderThan(thirtyDaysAgo);
console.log(`Deleted ${deletedCount} old transmissions`);
```

### Getting Log Counts

```typescript
import { getP25TransmissionLogger } from "./utils/p25TransmissionLog";

const logger = getP25TransmissionLogger();
await logger.init();

// Get total count
const totalCount = await logger.getCount();

// Get count for specific talkgroup
const talkgroupCount = await logger.getCount({ talkgroupId: 101 });
```

### Clearing All Logs

```typescript
import { getP25TransmissionLogger } from "./utils/p25TransmissionLog";

const logger = getP25TransmissionLogger();
await logger.init();

// Clear all transmission logs
await logger.clear();
```

## Data Storage

### IndexedDB Schema

The transmission logs are stored in an IndexedDB database with the following structure:

- **Database Name**: `P25TransmissionLog`
- **Store Name**: `transmissions`
- **Indexes**:
  - `timestamp` - for time-based queries
  - `talkgroupId` - for filtering by talkgroup
  - `sourceId` - for filtering by source
  - `signalQuality` - for quality-based queries

### Storage Considerations

- IndexedDB storage is persistent and survives browser restarts
- Storage quota depends on browser and available disk space
- Recommend periodic cleanup of old logs (e.g., older than 30-90 days)
- Each transmission record is approximately 200-300 bytes

## Performance

- **Logging**: Async operations don't block P25 decoding
- **Queries**: Indexed queries are fast even with thousands of records
- **UI**: Pagination limits memory usage in the log viewer
- **Export**: CSV generation is client-side and efficient

## Browser Compatibility

IndexedDB is supported in all modern browsers:

- Chrome/Edge 24+
- Firefox 16+
- Safari 10+
- Opera 15+

### Priority Scanning

The TalkgroupPriorityScanner automatically monitors talkgroup activity and switches to higher-priority talkgroups when they become active:

```typescript
import { TalkgroupPriorityScanner } from './lib/scanning';
import type { Talkgroup } from './components/TalkgroupScanner';

// Initialize the scanner
const scanner = new TalkgroupPriorityScanner();

// Set up talkgroups with priorities
const talkgroups: Talkgroup[] = [
  { id: "101", name: "Fire Dispatch", category: "Fire", priority: 9, enabled: true },
  { id: "201", name: "Police Dispatch", category: "Police", priority: 9, enabled: true },
  { id: "301", name: "EMS Main", category: "EMS", priority: 8, enabled: true },
];

scanner.updateTalkgroups(talkgroups);

// Process decoded P25 data
scanner.processDecodedData(decodedData, Date.now());

// Check if we should switch to a higher priority talkgroup
const switchEvent = scanner.shouldSwitch(Date.now());
if (switchEvent) {
  console.log(`Switching from ${switchEvent.fromTalkgroup} to ${switchEvent.toTalkgroup} (priority ${switchEvent.priority})`);
  console.log(`Reason: ${switchEvent.reason}`);
  scanner.setCurrentTalkgroup(switchEvent.toTalkgroup);
  // Tune your SDR to the new talkgroup's frequency
}

// Get current activity status for all talkgroups
const activityStatus = scanner.getActivityStatus();
activityStatus.forEach(activity => {
  console.log(`Talkgroup ${activity.talkgroupId}: ${activity.isActive ? 'Active' : 'Inactive'} (Priority ${activity.priority})`);
});
```

#### Priority Switching Logic

The scanner implements the following switching rules:

1. **Initial Selection**: When no talkgroup is selected, switches to the highest-priority active talkgroup
2. **Higher Priority Preemption**: Switches to a higher-priority talkgroup when it becomes active
3. **Current Ended**: Switches to the next-highest priority talkgroup when the current one becomes inactive
4. **Stay on Current**: Remains on the current talkgroup if it's the highest priority active

#### Activity Timeout

Configure how long a talkgroup remains "active" without hearing from it:

```typescript
scanner.setActivityTimeout(5000); // 5 seconds (default)
```

## Future Enhancements

Potential future improvements:

1. **Real-time Alerts**: Notify when specific talkgroups become active
2. **Statistical Analysis**: Aggregate transmission patterns and metrics
3. **Cloud Sync**: Optional cloud backup of transmission logs
4. **Advanced Filtering**: Saved filter presets and complex queries

Note: Priority scanning logic has been implemented (see Priority Scanning section above).

## Testing

Comprehensive test coverage:

- `src/utils/__tests__/p25TransmissionLog.test.ts` - Logger tests
- `src/components/__tests__/TalkgroupScanner.test.tsx` - Scanner tests with priority controls
- `src/components/__tests__/TransmissionLogViewer.test.tsx` - Viewer tests
- `src/lib/scanning/__tests__/talkgroup-priority-scanner.test.ts` - Priority scanner tests

Run tests:

```bash
# Run all P25-related tests
npm test -- --testPathPatterns=p25

# Run priority scanner tests specifically
npm test -- --testPathPatterns=talkgroup-priority-scanner

# Run all scanner-related tests
npm test -- --testPathPatterns="Scanner|Talkgroup"
```

## References

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [P25 Phase 2 Standard](https://www.tiaonline.org/standards/)
- [Project Architecture](../ARCHITECTURE.md)
