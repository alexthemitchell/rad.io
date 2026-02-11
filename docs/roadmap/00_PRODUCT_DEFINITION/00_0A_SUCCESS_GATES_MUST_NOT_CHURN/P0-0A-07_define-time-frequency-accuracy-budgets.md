# Time & Frequency Accuracy Budgets

## Frequency (Tuning)
*   **Resolution:** 1 Hz tuning steps (UI).
*   **Display Accuracy:** Matches requested frequency exactly (0 Hz error in UI math).
*   **Physical Accuracy (Uncalibrated):** Depends on hardware (e.g., HackRF +/- 20 PPM). UI must show "~" or "Uncalibrated" indicator.
*   **PPM Correction:** Software correction range +/- 100 PPM.
*   **Drift Budget:**
    *   AFC (Automatic Frequency Control) must hold NFM/SSB signal if drift < 10 Hz/sec.

## Time (Sampling)
*   **Sample Rate:** Device native rate (no software resampling in MVP vertical slice to reduce complexity).
*   **Timestamp Monotonicity:**
    *   Timestamps must strictly increase.
    *   Discontinuities (drops/retunes) must be logged as "gap events" in stream metadata.
*   **Recording Sync:**
    *   Audio and IQ files must align within < 10ms at start.
    *   Long recordings (> 1 hour) allowed to drift if OS audio clock diverges from RF clock (unless "Resample to Audio" feature is active - *Phase 2*).
