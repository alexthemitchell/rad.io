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
- Fail CI on error: enabled
- Enhanced comment layout with tree/file views

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

### Test Quality Over Quantity

- 100% coverage doesn't guarantee bug-free code
- Focus on meaningful tests, edge cases, realistic scenarios
- Use TDD approach for new features
- Add regression tests for every bug fix

### Critical Test Patterns

1. **DSP Functions**: Validate mathematical correctness, Parseval's theorem, frequency accuracy
2. **Device Models**: Mock WebUSB, test error conditions, state management
3. **React Components**: User interactions, state changes, WebGL fallbacks

## Bug Fix

Fixed flaky test in `useFrequencyScanner.test.ts`:

- Test: "does not start scanning when device is not open"
- Issue: Mock device.open() was succeeding when it should fail
- Fix: Added `.mockRejectedValue(new Error("Device failed to open"))` to open() spy
- Result: All 626 tests now pass consistently

## CI Integration

- Coverage enforced on every PR
- PRs that decrease coverage below thresholds will fail
- Codecov provides visual coverage reports and PR comments
- Multiple coverage file formats for tool compatibility

## Usage

### Local Verification

```bash
npm test -- --coverage                    # Full coverage report
npm test -- src/utils/__tests__/dsp.test.ts --coverage  # Specific module
npm test -- --coverage --coverageReporters=html  # HTML report
open coverage/index.html                  # View in browser
```

### CI Behavior

- Thresholds enforced automatically on push/PR
- Failed coverage check blocks PR merge
- Codecov comment on PR shows detailed diff

## Future Improvements

- Gradually increase DSP coverage from 70% to 95%+
- Add integration tests for device lifecycle
- Expand component tests for uncovered branches
- Consider snapshot testing for UI components

## References

- jest.config.js: Coverage threshold configuration
- codecov.yml: Codecov settings and flags
- CONTRIBUTING.md: Test strategy documentation (lines 220-400+)
- quality-checks.yml: CI coverage enforcement
