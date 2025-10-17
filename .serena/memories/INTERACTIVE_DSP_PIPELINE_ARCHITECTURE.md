# Interactive DSP Pipeline Debugger - Architecture Guide

## Purpose
Guide agents implementing an interactive, debuggable DSP pipeline with visualizations and real-time parameter tweaking for rad.io SDR visualizer.

## Overview
Transform the static DSP pipeline (`src/components/DSPPipeline.tsx`) into an interactive debugging tool where users can:
- Click each pipeline stage to see intermediate signal processing results
- Adjust stage-specific parameters in real-time (FFT size, bandwidth, gains, etc.)
- View live visualizations of data at each processing step
- Compare input vs output of each stage
- Export intermediate results for external analysis

## Core Architecture Pattern

### Component Structure
```
InteractiveDSPPipeline (Container)
├── DSPPipelineStages (Navigation/Selection)
│   ├── StageButton (RF Input)
│   ├── StageButton (Tuner) *selected*
│   ├── StageButton (I/Q Sampling)
│   └── ... more stages
├── DSPStagePanel (Details for selected stage)
│   ├── StageVisualization (Canvas-based)
│   ├── StageControls (Parameter tweakers)
│   └── StageMetrics (Performance stats)
└── DSPComparisonView (Side-by-side before/after)
```

### State Management
Use React hooks pattern (Model-View-Hook):
```typescript
// In hooks/useDSPPipeline.ts
type DSPPipelineStage = {
  id: string;
  name: string;
  description: string;
  inputData: Sample[] | null;
  outputData: Sample[] | null;
  parameters: Record<string, number | boolean | string>;
  metrics: { processingTime: number; sampleRate: number };
};

function useDSPPipeline(device: ISDRDevice | undefined, rawSamples: Sample[]) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [stages, setStages] = useState<DSPPipelineStage[]>([...]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Process samples through all stages
  const processPipeline = useCallback((samples: Sample[]) => {
    // Chain: Raw → Tuned → FFT → Demod → Audio
  }, [device]);
  
  return { stages, selectedStageId, selectStage, updateParameter };
}
```

## Pipeline Stages Definition

### 1. RF Input Stage
- **Input**: Raw antenna signal (simulated in browser)
- **Output**: Sample[] from device
- **Visualization**: SignalStrengthMeter, time-domain waveform
- **Parameters**: None (hardware-level)
- **Metrics**: Signal strength (dBm), noise floor

### 2. Tuner Stage
- **Input**: Full-bandwidth samples
- **Output**: Frequency-shifted samples centered at 0 Hz
- **Visualization**: FFTChart showing spectrum before/after shift
- **Parameters**: 
  - Target frequency (Hz)
  - Bandwidth filter (Hz)
  - LO frequency offset
- **Metrics**: Center frequency accuracy, filter rolloff

### 3. I/Q Sampling Stage
- **Input**: Analog signal (conceptual)
- **Output**: Sample[] with I/Q pairs
- **Visualization**: IQConstellation showing sample distribution
- **Parameters**:
  - Sample rate (MSPS)
  - Bit depth (8/16)
  - DC offset correction (boolean)
- **Metrics**: Sample rate actual, DC offset level, IQ imbalance

### 4. FFT Stage
- **Input**: Time-domain Sample[]
- **Output**: Frequency-domain Float32Array
- **Visualization**: FFTChart (spectrum), Spectrogram (waterfall)
- **Parameters**:
  - FFT size (power of 2: 64-4096)
  - Window function (Hann, Hamming, Blackman, Rectangular)
  - Overlap (0-75%)
  - WASM acceleration (boolean)
- **Metrics**: FFT duration (ms), WASM used (boolean), bins per Hz

### 5. Demodulation Stage
- **Input**: FFT result or I/Q samples
- **Output**: Audio samples (Float32Array)
- **Visualization**: WaveformChart showing demodulated envelope
- **Parameters**:
  - Demod type (FM/AM/SSB/P25)
  - FM deviation (Hz)
  - AM depth (%)
  - Audio filter cutoff (Hz)
- **Metrics**: Demod SNR (dB), audio peak level, THD (%)

### 6. Audio Output Stage
- **Input**: Audio samples
- **Output**: WebAudio AudioBuffer
- **Visualization**: Audio spectrum analyzer, VU meter
- **Parameters**:
  - Volume (0-1)
  - Mute (boolean)
  - Audio filter (lowpass/highpass/bandpass)
- **Metrics**: Audio latency (ms), buffer underruns, output level (dBFS)

## Implementation Locations

### New Files to Create
- `src/hooks/useDSPPipeline.ts` - Pipeline state management
- `src/components/InteractiveDSPPipeline.tsx` - Main container
- `src/components/DSPStagePanel.tsx` - Stage detail view
- `src/components/DSPStageControls.tsx` - Parameter tweakers
- `src/components/DSPComparisonView.tsx` - Side-by-side view
- `src/utils/dspProcessing.ts` - Stage-specific processing functions
- `src/components/__tests__/InteractiveDSPPipeline.test.tsx` - Tests

### Files to Modify
- `src/components/DSPPipeline.tsx` - Refactor to use new interactive version
- `src/pages/Visualizer.tsx` - Wire up pipeline hook and samples
- `src/utils/dsp.ts` - Add stage-specific helper functions
- `src/styles/main.css` - Add styles for interactive pipeline UI

## Data Flow Pattern

```
Visualizer (page)
  ↓ rawSamples, device
useDSPPipeline (hook)
  ↓ processes samples through stages
  ↓ stores intermediate results
  ↓ computes metrics
  ↓ returns { stages[], selectedStageId, ... }
InteractiveDSPPipeline (component)
  ↓ displays stage navigation
  ↓ renders selected stage details
DSPStagePanel
  ├→ DSPStageVisualization (reuses IQConstellation, FFTChart, etc.)
  ├→ DSPStageControls (parameter sliders/toggles)
  └→ DSPStageMetrics (performance stats)
```

## Key Implementation Techniques

### 1. Intermediate Data Capture
```typescript
function processPipeline(rawSamples: Sample[]): DSPPipelineStage[] {
  const stages: DSPPipelineStage[] = [];
  let currentData = rawSamples;
  
  // Stage 1: RF Input
  stages.push({
    id: 'rf-input',
    inputData: null,
    outputData: currentData,
    // ...
  });
  
  // Stage 2: Tuner (frequency shift)
  const tunedData = applyFrequencyShift(currentData, targetFreq);
  stages.push({
    id: 'tuner',
    inputData: currentData,
    outputData: tunedData,
    // ...
  });
  currentData = tunedData;
  
  // Continue for all stages...
  return stages;
}
```

### 2. Real-Time Parameter Updates
Use debouncing for expensive recalculations:
```typescript
const debouncedProcessing = useMemo(
  () => debounce((samples: Sample[], params: StageParams) => {
    const result = processStage(samples, params);
    updateStageOutput(result);
  }, 100),
  []
);

const handleParameterChange = (param: string, value: number) => {
  setParameters(prev => ({ ...prev, [param]: value }));
  debouncedProcessing(stageInput, { ...parameters, [param]: value });
};
```

### 3. Visualization Reuse
Leverage existing components with adapter pattern:
```typescript
function DSPStageVisualization({ stage }: Props) {
  switch (stage.id) {
    case 'iq-sampling':
      return <IQConstellation samples={stage.outputData} />;
    case 'fft':
      return <FFTChart fftData={stage.outputData} />;
    case 'demodulation':
      return <WaveformChart samples={stage.outputData} />;
    // ...
  }
}
```

### 4. Performance Monitoring
Wrap each stage with performance tracking:
```typescript
const processStageWithMetrics = (stage: DSPPipelineStage) => {
  const startMark = `stage-${stage.id}-start`;
  performanceMonitor.mark(startMark);
  
  const result = processStage(stage.inputData, stage.parameters);
  
  const duration = performanceMonitor.measure(
    `stage-${stage.id}`,
    startMark
  );
  
  return { ...result, metrics: { ...result.metrics, duration } };
};
```

## UI/UX Guidelines

### Stage Selection
- Horizontal scrollable stage buttons
- Active stage highlighted with accent color
- Visual indicator of processing status (spinner/checkmark)
- Click to select, Space/Enter for keyboard

### Parameter Controls
- Sliders for continuous values (frequency, gain)
- Toggles for boolean flags (WASM, DC offset correction)
- Dropdowns for enums (window function, demod type)
- Real-time value display with units
- "Reset to Default" button per control

### Visualizations
- Same canvas-based approach as existing components
- Reuse high-DPI scaling, GPU hints
- Add pan/zoom using useVisualizationInteraction hook
- Export button for saving visualization as PNG

### Comparison View
- Split-screen: input (left) vs output (right)
- Synchronized zoom/pan
- Diff visualization (when applicable)
- Toggle between overlay and side-by-side modes

## Testing Strategy

### Unit Tests
- Each stage processing function independently
- Parameter validation and range limits
- Intermediate data format correctness
- Metrics calculation accuracy

### Integration Tests
- Full pipeline execution with known test signals
- Parameter updates trigger correct reprocessing
- Stage selection updates UI correctly
- Visualization components receive correct data

### Performance Tests
- Pipeline processing latency (<50ms for 10k samples)
- UI responsiveness during parameter changes
- Memory usage with large sample buffers
- WASM vs JS performance per stage

## Code Style & Patterns

### TypeScript Strictness
- All stage data structures fully typed
- No `any` for pipeline state
- Discriminated unions for stage-specific parameters

### React Best Practices
- Functional components with hooks
- useMemo for expensive computations
- useCallback for event handlers
- Proper cleanup in useEffect

### Canvas Rendering
- Reuse existing optimization patterns from ARCHITECTURE memory
- High-DPI scaling, GPU acceleration
- RequestAnimationFrame for smooth updates
- Throttle to 30 FPS when needed

## Tools Usage for Implementation

### Discovery Phase
1. `list_memories` → read ARCHITECTURE, WASM_DSP, INTERACTIVE_CONTROLS
2. `get_symbols_overview` → survey existing components/hooks
3. `find_symbol` → examine calculateFFT, calculateWaveform, etc.
4. `search_for_pattern` → find visualization component usage patterns

### Implementation Phase
1. `insert_before_symbol` → add new stage processing functions in dsp.ts
2. `replace_symbol_body` → refactor DSPPipeline component
3. `find_referencing_symbols` → ensure backward compatibility
4. Use `runTests` after each major change

### Validation Phase
1. `runTests` → verify all tests pass
2. `get_errors` → check TypeScript/lint issues
3. `run_in_terminal` → manual testing with `npm start`
4. Playwright browser tools → visual verification

## Memory Updates
After implementation, update:
- This memory with actual file paths and lessons learned
- ARCHITECTURE memory with new component hierarchy
- Create DSP_DEBUGGING_WORKFLOW playbook for using the feature

## Known Pitfalls
- **Performance**: Processing full pipeline on every parameter change is expensive. Use debouncing and only reprocess affected stages.
- **Memory**: Storing intermediate results for all stages can consume significant RAM. Implement sample count limits or adaptive downsampling.
- **State Sync**: Ensure pipeline parameters stay in sync with device configuration (frequency, sample rate).
- **Canvas IDs**: Multiple visualizations need unique canvas IDs to avoid conflicts.

## Future Enhancements
- Record/playback pipeline state for bug reports
- A/B comparison between different parameter sets
- Preset configurations for common use cases (FM radio, P25, etc.)
- Export pipeline graph as JSON for external tools
- GPU-accelerated stage processing (WebGL compute shaders)
