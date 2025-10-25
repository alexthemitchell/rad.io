# Test Coverage Enforcement Implementation

## Overview

Implemented comprehensive test coverage tracking and enforcement for rad.io to prevent regressions and maintain code quality.

## Configuration Files

### jest.config.js

- Added `coverageThreshold` with baseline enforcement
- Global thresholds: 38% statements, 35% branches, 39% functions, 38% lines
- Per-module thresholds for critical code:
  - dsp.ts: 70%+ (core DSP functions)
  - audioStream.ts: 93%+ (real-time audio)
  - p25decoder.ts: 96%+ (protocol decoder)
  - iqRecorder.ts: 77%+ (recording)
  - speechRecognition.ts: 78%+ (speech-to-text)
  - rdsDecoder.ts: 57%+ (RDS data)
  - dspProcessing.ts: 94%+ (DSP pipeline)
- Coverage reporters: text, lcov, html, json-summary
- Excludes: index.ts files, workers, .d.ts files

### codecov.yml

- Project target: auto with 1% threshold
- Patch target: 80% with 5% threshold
- Coverage flags: utils, models, components, hooks
- **Codecov Components**: 21 logical components defined with granular coverage tracking
- Fail CI on error: enabled
- Enhanced comment layout with components view

## Codecov Components Architecture

Components enable granular coverage tracking beyond simple path-based flags. Each component represents a logical subsystem with specific coverage targets aligned to its criticality and testability.

### Component Categories

**UI Layer** (60-75% targets):
- `ui_components`: User-facing React components (70% target)
- `ui_pages`: Top-level page components (60% target)
- `ui_panels`: Reusable panel components (65% target)

**Integration Layer** (75-80% targets):
- `hooks`: React hooks for state/device management (75% target)

**Device Layer** (80-85% targets):
- `device_models`: Hardware interface implementations (80% target)

**DSP Layer** (70-90% targets):
- `dsp_core`: Core signal processing algorithms (85% target)
- `dsp_utils`: DSP utility functions (70% target)

**Signal Analysis** (75-85% targets):
- `signal_detection`: Auto-detection systems (80% target)
- `signal_scanning`: Frequency scanning logic (75% target)
- `signal_measurement`: Spectrum analysis (80% target)

**Decoders** (57-70% targets):
- `decoders`: RDS/P25 protocol decoders (57% baseline, 70% goal)

**Audio** (93-95% targets):
- `audio_processing`: Real-time audio streaming (93% target)

**Recording** (77-85% targets):
- `recording`: IQ recording & playback (77% target)

**Speech** (78-85% targets):
- `speech_recognition`: Speech-to-text processing (78% target)

**Rendering** (70-80% targets):
- `rendering`: Render tier management (70% target)
- `visualization_webgl`: WebGL visualizations (75% target)
- `visualization_webgpu`: WebGPU visualizations (70% target)

**Workers** (75-80% targets):
- `workers`: Web worker management & DSP pools (75% target)

**Infrastructure** (65-100% targets):
- `monitoring`: Performance monitoring (70% target)
- `utils_core`: Core utilities (65% target)
- `test_infrastructure`: Test helpers (95% target, 100% goal)

### Component Benefits

1. **Granular Status Checks**: Each component can have independent CI status checks
2. **Focused Coverage Reports**: Filter coverage view by component in Codecov UI
3. **Component Trends**: Track coverage over time per component
4. **Targeted Improvements**: Identify which subsystems need attention
5. **PR Comments**: Component-level coverage diffs in PR comments

### Configuration Structure

```yaml
component_management:
  default_rules:
    statuses:
      - type: project
        target: auto
  
  individual_components:
    - component_id: ui_components  # Unique ID (never change)
      name: "UI Components"         # Display name (can change)
      paths:
        - src/components/**
      statuses:
        - type: project
          target: 70%
        - type: patch
          target: 75%
```

### quality-checks.yml

- Added coverage threshold documentation step
- Upload multiple coverage files (lcov.info, coverage-final.json)
- Enabled fail_ci_if_error and verbose output

## Documentation Updates

### README.md

- Added Codecov badge: `[![codecov](https://codecov.io/gh/alexthemitchell/rad.io/branch/main/graph/badge.svg)](...)`
- Added Quality Checks badge for CI status

### CONTRIBUTING.md (250+ lines added)

- Complete test coverage strategy section
- Module-specific threshold rationale
- Test writing guidelines by module type (DSP, devices, components)
- Coverage enforcement workflow (local + CI)
- Examples of effective tests
- Hard-to-test code guidance

## Key Insights

### Coverage Philosophy

- Baseline thresholds prevent regression (not aspirational targets)
- Different thresholds for different module types (DSP 70%+, UI 40%+)
- WebGL/WebUSB components harder to test due to browser API mocking limitations
- Components allow virtual grouping across directory boundaries

### Test Quality Standards

- **100% test pass rate required** - no failing tests acceptable
- Focus on meaningful tests, edge cases, realistic scenarios
- Use TDD approach for new features
- Add regression tests for every bug fix
- All new code must have passing tests before PR approval

### Critical Test Patterns

1. **DSP Functions**: Validate mathematical correctness, Parseval's theorem, frequency accuracy
2. **Device Models**: Mock WebUSB, test error conditions, state management
3. **React Components**: User interactions, state changes, WebGL fallbacks

## Test Pass Rate Requirements

- **Local Development**: All tests must pass before committing
- **PR Submission**: 100% pass rate required for CI to pass
- **PR Review**: Cannot merge with any failing tests
- **Complex Components**: If proper mocking is difficult, work must continue until tests pass or component must be refactored for testability

## CI Integration

- Coverage enforced on every PR
- Test pass rate enforced on every PR
- Component-level status checks for granular feedback
- PRs that decrease coverage below thresholds will fail
- PRs with any failing tests will fail
- Codecov provides visual coverage reports, component filtering, and PR comments
- Multiple coverage file formats for tool compatibility

## Usage

### Local Verification

```bash
npm test                                  # All tests must pass
npm test -- --coverage                    # Full coverage report
npm test -- src/utils/__tests__/dsp.test.ts --coverage  # Specific module
npm test -- --coverage --coverageReporters=html  # HTML report
open coverage/index.html                  # View in browser
```

### CI Behavior

- Thresholds enforced automatically on push/PR
- Failed coverage check blocks PR merge
- Any failing test blocks PR merge
- Codecov comment on PR shows detailed diff with component breakdown
- Component status checks provide granular feedback

### Codecov UI Features

- **Component Filtering**: Filter file tree by component in UI
- **Component Analytics**: View coverage trends per component over time
- **PR Comments**: Component-level coverage changes in PR comments
- **Status Checks**: Individual status checks per component (optional)

## Future Improvements

- Gradually increase DSP coverage from 70% to 95%+
- Add integration tests for device lifecycle
- Expand component tests for uncovered branches
- Consider snapshot testing for UI components
- Improve mocking utilities for complex browser APIs (AudioContext, WebUSB, WebGL)
- Enable component analytics in Codecov UI for historical tracking

## References

- jest.config.js: Coverage threshold configuration
- codecov.yml: Codecov settings, flags, and component definitions (lines 39-288)
- CONTRIBUTING.md: Test strategy documentation (lines 220-400+)
- quality-checks.yml: CI coverage enforcement
- Codecov Components Docs: https://docs.codecov.com/docs/components
