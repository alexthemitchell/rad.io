# Support Diagnostics Entrypoints

## In-App Entrypoints

- Primary action: `Export Diagnostics` button in the control bar.
- Secondary context: recent diagnostics event list (`details` panel under controls).
- Error-state fallback: all blocking errors include `Export diagnostics` as a secondary action.

## Export Contents (MVP)

- Current source, frequency, demod mode, fine tune, zoom.
- Connection and audio state labels.
- Gain stages and current gain values.
- Current status message.
- Recent diagnostic event timeline.
- Runtime telemetry schema version + worker transport mode.
- DSP telemetry contracts:
  - pipeline timing (`ddc/fft/demod/downsample/total` ms)
  - amplitude metrics (`iq/audio rms/peak`, DC offset, clipping ratio)
  - demod quality (`quality score`, `signalPresent`, optional RDS sync/error metrics)
- AGC contract baseline (`implemented=false`) for forward compatibility.

## Safety And Privacy

- No PII is collected in MVP diagnostics export.
- Export excludes raw IQ/audio payloads by default.
- Output is local file download only; no automatic network upload.

## Support Workflow

1. Reproduce issue.
2. Export diagnostics.
3. Attach JSON file to issue with a short repro summary.
4. Include browser version and OS in issue body.

## Accessibility Requirements

- Diagnostics export must be keyboard activatable.
- Export completion must be announced through the same status live region.
