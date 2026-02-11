# Definition of Ready (DoR)

Before any Roadmap Item moves to "In Progress", it must have:

1.  **Acceptance Criteria:** A bulleted list of pass/fail conditions.
2.  **UX Artifacts:** (If UI involved) A rough mock or description of the interaction.
3.  **Telemetry Requirements:** What metrics will prove this feature is working/used?
4.  **Risks:** Known unknowns listed.
5.  **Dependencies:** Prerequisite items checked off.

## Example (Good)
> **Feature:** WFM Demodulator
> *   **AC:** Mono audio output; De-emphasis filter applied (50us); Audio output < -1dBFS.
> *   **UX:** Mode selector dropdown includes "WFM".
> *   **Telemetry:** "Demod Active" event with `mode=WFM`.

## Example (Bad)
> **Feature:** Add FM support.
> *   (Too vague. Stereo? RDS? Bandwidth?)
