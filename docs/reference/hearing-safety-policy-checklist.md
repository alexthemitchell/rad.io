# Hearing Safety Policy Checklist

This checklist formalizes the minimum hearing-safety policy for Phase 5.2 and links each policy to existing code and automated coverage.

## Policy

- Startup defaults to muted audio until the operator explicitly enables listening.
- Audio transitions use click-safe ramps on start/stop/mute/reconfigure paths.
- A limiter/soft-clip stage is always active before sink output.
- Pathological bursts trigger an emergency safety mute event counter.
- Per-mode default output and max output levels stay within conservative bounds.
- Panic mute remains globally available (`P` shortcut and UI mute control).

## Evidence

- Startup muted default: `src/App.tsx:724`, `src/App.tsx:1467`
- Panic mute shortcut/action: `src/App.tsx:4018`, `src/App.tsx:7192`
- Limiter and burst safety mute implementation: `src/audio/AudioSink.ts:106`, `src/audio/AudioSink.ts:159`
- Click-safe ramps on transitions: `src/audio/AudioSink.ts:91`, `src/audio/AudioSink.ts:182`
- Per-mode output policy defaults: `src/dsp/controlGuardrails.ts:27`

## Automated Coverage

- Audio sink limiter/underrun/safety mute behavior: `src/audio/AudioSink.test.ts:51`
- Audio sink mute ramp behavior: `src/audio/AudioSink.test.ts:142`
- Mode output-level policy bounds: `src/dsp/controlGuardrails.test.ts:56`
