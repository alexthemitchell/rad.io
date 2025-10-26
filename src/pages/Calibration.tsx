import React from "react";

/**
 * Calibration page with wizard flow
 *
 * Purpose: Guide user through device calibration for accurate measurements
 *
 * Calibration types:
 * - Frequency PPM correction
 * - Gain offset (dB)
 * - IQ balance correction
 * - DC offset correction
 *
 * Workflow:
 * 1. Select device to calibrate
 * 2. Choose calibration type
 * 3. Follow step-by-step wizard
 * 4. Validate calibration results
 * 5. Save as calibration profile
 * 6. Set expiration reminder
 *
 * Success criteria:
 * - Results stored as profiles
 * - Auto-applied to matching devices
 * - Expiration reminders for periodic re-calibration
 * - ±1 Hz and ±0.2 dB accuracy targets (PRD)
 *
 * TODO: Implement wizard flow with steps
 * TODO: Add frequency PPM calibration (known reference signal)
 * TODO: Add gain offset calibration (signal generator)
 * TODO: Add IQ balance calibration
 * TODO: Add DC offset calibration
 * TODO: Implement profile management (save, load, apply)
 * TODO: Add validation and accuracy measurements
 * TODO: Add expiration tracking and reminders
 */
function Calibration(): React.JSX.Element {
  return (
    <main
      className="page-container"
      role="main"
      aria-labelledby="calibration-heading"
    >
      <h2 id="calibration-heading">Device Calibration</h2>

      <section aria-label="Introduction">
        <p>
          Calibration improves measurement accuracy by correcting for
          device-specific errors. Follow the wizard to calibrate frequency,
          gain, IQ balance, and DC offset.
        </p>
      </section>

      <section aria-label="Device Selection">
        <h3>Step 1: Select Device</h3>
        {/* TODO: Device selector dropdown */}
        <p>Select a connected device to calibrate</p>
      </section>

      <section aria-label="Calibration Type">
        <h3>Step 2: Calibration Type</h3>
        {/* TODO: Radio buttons for calibration type */}
        <ul>
          <li>Frequency PPM Correction (requires known reference signal)</li>
          <li>Gain Offset (requires calibrated signal generator)</li>
          <li>IQ Balance Correction</li>
          <li>DC Offset Correction</li>
        </ul>
      </section>

      <section aria-label="Calibration Wizard">
        <h3>Step 3: Calibration Procedure</h3>
        {/* TODO: Step-by-step wizard based on calibration type */}
        <p>Follow the instructions for your selected calibration type</p>
      </section>

      <section aria-label="Results">
        <h3>Step 4: Validation</h3>
        {/* TODO: Display measured corrections */}
        {/* TODO: Before/after comparison */}
        {/* TODO: Accuracy metrics */}
        <p>Calibration results will appear here</p>
      </section>

      <section aria-label="Save Profile">
        <h3>Step 5: Save Calibration</h3>
        {/* TODO: Profile name input */}
        {/* TODO: Auto-apply toggle */}
        {/* TODO: Expiration date picker */}
        <button disabled>Save Calibration Profile</button>
      </section>

      <section aria-label="Existing Profiles">
        <h3>Saved Calibration Profiles</h3>
        {/* TODO: List of existing profiles with apply/delete actions */}
        {/* TODO: Show expiration dates and warnings */}
        <p>No calibration profiles saved yet</p>
      </section>
    </main>
  );
}

export default Calibration;
