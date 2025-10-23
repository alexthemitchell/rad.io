# Waterfall Display Mode Implementation

## Summary
Added waterfall display mode to rad.io for real-time scrolling frequency spectrum visualization. Users can toggle between static spectrogram and scrolling waterfall modes.

## Key Changes

### Components Modified
- **Spectrogram.tsx**: Added `mode` prop ("spectrogram" | "waterfall") with waterfall buffer management
- **FFTChart.tsx**: Propagates mode prop to Spectrogram
- **Visualizer.tsx**: Added toggle button and mode state management

### Implementation Details
1. **Waterfall Buffer**: Uses `waterfallBufferRef` to maintain rolling buffer of FFT frames
2. **Configurable Limit**: `maxWaterfallFrames` prop (default: 100) limits buffer size
3. **Display Logic**: In waterfall mode, new frames are appended and old frames trimmed
4. **Rendering**: Reuses existing WebGL pipeline - no changes to rendering code needed
5. **Toggle UI**: Button overlaid on spectrogram card switches modes dynamically

### Code Pattern
```typescript
const displayData = useMemo((): Float32Array[] => {
  if (mode === "waterfall") {
    const newBuffer = [...waterfallBufferRef.current, ...fftData];
    const trimmed = newBuffer.slice(-maxWaterfallFrames);
    waterfallBufferRef.current = trimmed;
    return trimmed;
  }
  return fftData; // Static mode
}, [fftData, mode, maxWaterfallFrames]);
```

### Testing
- Added 6 new tests covering waterfall mode, buffer management, mode switching
- All 21 Spectrogram tests passing
- Backward compatible - defaults to "spectrogram" mode

### User Experience
- Toggle button shows "💧 Waterfall" in spectrogram mode, "📊 Static" in waterfall mode
- Card title/subtitle update based on active mode
- Smooth switching without data loss

## References
- Components: src/components/Spectrogram.tsx, FFTChart.tsx
- Tests: src/components/__tests__/Spectrogram.test.tsx
- Usage: src/pages/Visualizer.tsx
- Docs: README.md (updated with waterfall features)

## Lessons Learned
- Minimal changes strategy: Added mode prop instead of creating separate component
- Reused existing WebGL rendering by changing data source
- useMemo for displayData ensures efficient re-computation only when inputs change
- useRef for buffer persistence across renders without triggering re-renders