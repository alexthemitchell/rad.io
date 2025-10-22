# RDS Display UI Mockup

## Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│ RDS - Radio Data System                                [×]  │
│ Real-time FM station information and metadata               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ PI: 1A2B     [US]              Quality: ████████░░ 85%  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                    N P R - F M                          │ │
│ │              (Station Name - 8 chars)                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📝 Radio Text:                                          │ │
│ │ This is NPR News - Stay informed with your local...    │ │
│ │            (Auto-scrolling for long text)               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Program Type:          │ Sync:                          │ │
│ │ News                   │ ● Locked (green)               │ │
│ ├────────────────────────┼────────────────────────────────┤ │
│ │ Traffic:               │ Time:                          │ │
│ │ ✓ Available            │ 10:30:45 AM                    │ │
│ ├────────────────────────┼────────────────────────────────┤ │
│ │ Alt. Frequencies:      │                                │ │
│ │ 2 available            │                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Groups: 95/100    Error Rate: 5.0%    Corrected: 5     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## No Data State

```
┌─────────────────────────────────────────────────────────────┐
│ RDS - Radio Data System                                [×]  │
│ Real-time FM station information and metadata               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                          📻                                   │
│                     No RDS Data                               │
│        Tune to an FM station with RDS broadcasting           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Compact Variant

```
┌─────────────────────────────┐
│ NPR-FM                      │
│ This is NPR News - Stay...  │
│ News • 1A2B                 │
└─────────────────────────────┘
```

## Color Coding

### Signal Quality Bar
- **Green (85-100%)**: Excellent signal, high quality decode
- **Yellow (50-84%)**: Good signal, moderate quality
- **Red (0-49%)**: Poor signal, low quality decode

### Sync Status
- **Green "Locked"**: Successfully synchronized with RDS blocks
- **Yellow "Searching"**: Attempting to find block synchronization

### Traffic Indicators
- **"✓ Available"**: Station broadcasts traffic information (TP=1, TA=0)
- **"🚨 Announcement"**: Active traffic announcement (TP=1, TA=1)

## Responsive Behavior

### Desktop (>768px)
- Full metadata grid with 2 columns
- Large station name (48px font)
- Radio text at 18px font
- All metadata visible

### Mobile (<768px)
- Metadata grid stacks to single column
- Station name reduced to 32px
- Radio text at 14px
- Compact layout maintains readability

## Interactive Features

### Auto-Scrolling Radio Text
- When radio text exceeds display width (>48 characters)
- Scrolls left continuously at 300ms interval
- Creates loop effect with separator: "message  •  message"
- Provides smooth reading experience

### Collapsible Card
- Can be collapsed to save screen space
- State persists across sessions
- Collapse/expand animation

### Dynamic Updates
- Station data updates in real-time as RDS groups are decoded
- Quality bar animates smoothly on signal changes
- Statistics increment as groups are received
- No page refresh required

## Accessibility Features

### Screen Reader Support
- Semantic HTML structure
- ARIA labels for all interactive elements
- Clear hierarchy with headings
- Status updates announced

### Keyboard Navigation
- Tab through interactive elements
- Enter/Space to collapse/expand
- Focus indicators visible
- Skip links available

### Visual Accessibility
- High contrast text on background
- Color is not sole indicator (icons + text)
- Readable font sizes
- Clear visual hierarchy

## CSS Classes Reference

### Main Container
- `.rds-display` - Main container
- `.rds-display.rds-no-data` - No data state modifier

### Header Section
- `.rds-header` - Header with PI and quality
- `.rds-pi` - PI code display
- `.rds-quality` - Quality bar container
- `.rds-quality-bar` - Quality bar background
- `.rds-quality-fill` - Quality bar fill (animated)

### Station Name
- `.rds-main` - Main display area
- `.rds-station-name` - Large station name

### Radio Text
- `.rds-radio-text` - Radio text container
- `.rds-rt-label` - "Radio Text:" label
- `.rds-rt-content` - Scrolling text content

### Metadata Grid
- `.rds-metadata` - Grid container
- `.rds-meta-item` - Individual metadata item
- `.rds-meta-label` - Item label
- `.rds-meta-value` - Item value

### Statistics
- `.rds-stats` - Statistics footer
- `.rds-stat` - Individual statistic

### Compact Variant
- `.rds-display-compact` - Compact container
- `.rds-compact-ps` - Compact station name
- `.rds-compact-rt` - Compact radio text
- `.rds-compact-meta` - Compact metadata

## Integration in Visualizer

### Placement
- Appears after Audio Controls card
- Before Recording Controls section
- Part of main content flow

### Visibility Conditions
```typescript
{signalType === "FM" && isAudioPlaying && (
  <Card title="RDS - Radio Data System">
    <RDSDisplay rdsData={rdsData} stats={rdsStats} />
  </Card>
)}
```

### State Management
```typescript
// State variables
const [rdsData, setRdsData] = useState<RDSStationData | null>(null);
const [rdsStats, setRdsStats] = useState<RDSDecoderStats | null>(null);

// Update on audio extraction
const result = await audioProcessor.extractAudio(..., { enableRDS: true });
if (result.rdsData) setRdsData(result.rdsData);
if (result.rdsStats) setRdsStats(result.rdsStats);

// Clear on mode change
if (signalType !== "FM") {
  setRdsData(null);
  setRdsStats(null);
}
```

## Animation Specifications

### Quality Bar Fill
- Property: `width`, `background-color`
- Duration: 300ms
- Easing: ease
- Smooth transition between quality levels

### Radio Text Scroll
- Interval: 300ms per character
- Direction: Left (decreasing position)
- Loop: Continuous with separator "  •  "
- Reset on text change

### Card Expand/Collapse
- Duration: 200ms (inherited from Card component)
- Easing: ease-in-out
- Content fade during transition

## Testing Considerations

### Unit Tests (30 tests)
- No data state rendering
- Station data display accuracy
- Statistics calculations
- Edge cases (missing data, long text, zero quality)
- Compact variant rendering

### Integration Tests
- State updates from audio processor
- Mode switching behavior
- Cleanup on unmount
- Memory leak prevention

### Manual Testing Scenarios
1. Tune to FM station without RDS → "No RDS Data" message
2. Tune to FM station with RDS → Data appears within 1-10 seconds
3. Switch to AM → RDS display disappears
4. Switch back to FM → RDS display reappears (data resets)
5. Long radio text → Auto-scroll activates
6. Weak signal → Quality bar shows red
7. Strong signal → Quality bar shows green
8. Mobile view → Layout adapts responsively
