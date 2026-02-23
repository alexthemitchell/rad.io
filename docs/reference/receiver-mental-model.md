# Receiver Mental Model Reference

## Plain Language Definitions

- Center frequency is what the display is centered on.
- Tuned frequency is what you are trying to listen to.
- Span is how wide the visible frequency window is.
- Sample rate is how much RF bandwidth the source can deliver.
- Bandwidth is how much of the tuned signal you pass to demod.
- VFO is a logical listening channel.

## Example 1: Tune Within A Span

- Center: 90.000 MHz
- Span: 2 MHz (89 to 91 MHz visible)
- Click a peak near 90.350 MHz
- Result: tuned frequency becomes 90.350 MHz while center may stay 90.000 MHz.

## Example 2: Shift Center To Avoid DC Spur

- A DC spur appears at exact center of the display.
- Shift center from 90.000 MHz to 90.050 MHz.
- Keep tuned frequency at 90.100 MHz.
- Result: the spur moves away from the target signal, improving readability.

## Troubleshooting Mental Model

Why can I see a signal but not hear audio?

- You may be visually centered near a signal but tuned to a different frequency.
- Mode/bandwidth may not match signal type.
- Audio may be muted or awaiting user gesture.
- Source can be streaming while audio is degraded or blocked.
