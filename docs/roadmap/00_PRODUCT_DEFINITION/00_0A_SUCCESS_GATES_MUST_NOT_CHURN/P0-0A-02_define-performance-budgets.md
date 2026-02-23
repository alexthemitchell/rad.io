# Performance Budgets

## Visuals

- **Frame Rate:** 60 FPS consistent (16.6ms frame budget).
- **Latency:** < 100ms visual latency (action to pixel).
- **Resolution:** Full retina support on primary canvas.

## Audio / DSP

- **Audio Latency:** < 50ms glass-to-glass (RF in → Sound out).
- **Sample Rate:** Support 2.4 MSPS (HackRF) minimum on mid-range laptop.
- **Drop Rate:** < 0.1% dropped buffers on sustained listening.

## System

- **Memory:** < 500MB heap usage for main tab.
- **Startup:** < 2s to interactive state (cold boot).
