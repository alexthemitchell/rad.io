import React from "react";

/**
 * Recordings page for IQ/audio recording library
 *
 * Purpose: Library for IQ/audio recordings with metadata and export
 * Dependencies: ADR-0005 (Storage Strategy), ADR-0010 (Offline-First)
 *
 * Features to implement:
 * - List/grid view with filters and tags
 * - Playback/preview functionality
 * - SigMF export
 * - Storage quota management
 * - Search and filter recordings
 *
 * Success criteria:
 * - Handles 20GB+ with quota management
 * - Supports segmented long captures (per PRD)
 *
 * TODO: Implement recording list/grid with metadata
 * TODO: Add playback controls and preview
 * TODO: Implement SigMF export functionality
 * TODO: Add storage quota management UI
 * TODO: Add search, filter, and tagging system
 * TODO: Integrate with IndexedDB storage (ADR-0005)
 */
function Recordings(): React.JSX.Element {
  return (
    <main
      className="page-container"
      role="main"
      aria-labelledby="recordings-heading"
    >
      <h2 id="recordings-heading">Recordings Library</h2>

      <section aria-label="Recording List Controls">
        <div>
          {/* TODO: View toggle (list/grid), search, filter controls */}
          <p>Search and filter controls coming soon</p>
        </div>
      </section>

      <section aria-label="Recordings List">
        <h3>Your Recordings</h3>
        {/* TODO: Recording list/grid with thumbnails, metadata, and actions */}
        <p>No recordings yet. Start recording from the Monitor page.</p>
      </section>

      <aside aria-label="Storage Information">
        <h3>Storage</h3>
        {/* TODO: Storage quota, usage breakdown, cleanup options */}
        <p>Storage management coming soon</p>
      </aside>

      <section aria-label="Recording Playback">
        {/* TODO: Playback controls when a recording is selected */}
        {/* TODO: Option to open in Analysis or Decode */}
      </section>
    </main>
  );
}

export default Recordings;
