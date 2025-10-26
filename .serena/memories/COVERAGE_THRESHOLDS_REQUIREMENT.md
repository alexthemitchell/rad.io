# Coverage Thresholds Are Requirements, Not Warnings

## Important Policy
Coverage thresholds in jest.config.js are **mandatory requirements**, not optional warnings. Tests must meet or exceed all defined thresholds before code can be merged.

## Current Thresholds
- Global: 38% statements, 35% branches, 39% functions, 38% lines
- Per-module thresholds for critical files (must be maintained):
  - `dspProcessing.ts`: 94% statements, 94% lines, 85% functions
  - `dsp.ts`: 70% statements, 63% branches, 69% lines, 82% functions
  - `audioStream.ts`: 93% statements, 78% branches, 93% lines, 93% functions
  - And others...

## Action Required
When adding new code or modifying existing code:
1. Always check coverage with `npm test -- --coverage`
2. If coverage drops below threshold, add tests to meet requirements
3. Coverage failures will block PR merging
4. Do not merge code that fails coverage thresholds

## Example Issue
For `dspProcessing.ts`:
- Required: 94% statements, 94% lines
- Actual: 88.17% statements, 88.82% lines
- Action: Add tests to cover uncovered lines until thresholds are met

## How to Identify Uncovered Lines
Run `npm test -- path/to/file.test.ts --coverage` and check the coverage report. The output shows which lines are not covered (e.g., "143-163,406-417").
