import React, { useState } from "react";
import { InfoBanner } from "../components/InfoBanner";

/**
 * Help page with onboarding, keyboard shortcuts, and release notes
 *
 * Purpose: User documentation and assistance
 *
 * Sections:
 * - Onboarding: First-time user guide
 * - Keyboard Shortcuts: Complete list with search
 * - Accessibility: Screen reader guide, keyboard navigation
 * - Release Notes: Version history and new features
 * - Support: Links to documentation, issues, community
 *
 * TODO: Implement tabbed or accordion interface
 * TODO: Add onboarding guide with interactive elements
 * TODO: Create searchable keyboard shortcut reference
 * TODO: Add accessibility feature documentation
 * TODO: Implement release notes viewer
 * TODO: Add links to external documentation
 */
function Help(): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<
    "onboarding" | "keyboard" | "accessibility" | "releases" | "support"
  >("onboarding");

  return (
    <main className="page-container" role="main" aria-labelledby="help-heading">
      <h2 id="help-heading">Help & Documentation</h2>

      <nav aria-label="Help sections">
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeSection === "onboarding" ? "true" : "false"}
            onClick={() => setActiveSection("onboarding")}
          >
            Onboarding
          </button>
          <button
            role="tab"
            aria-selected={activeSection === "keyboard" ? "true" : "false"}
            onClick={() => setActiveSection("keyboard")}
          >
            Keyboard Shortcuts
          </button>
          <button
            role="tab"
            aria-selected={activeSection === "accessibility" ? "true" : "false"}
            onClick={() => setActiveSection("accessibility")}
          >
            Accessibility
          </button>
          <button
            role="tab"
            aria-selected={activeSection === "releases" ? "true" : "false"}
            onClick={() => setActiveSection("releases")}
          >
            Release Notes
          </button>
          <button
            role="tab"
            aria-selected={activeSection === "support" ? "true" : "false"}
            onClick={() => setActiveSection("support")}
          >
            Support
          </button>
        </div>
      </nav>

      {activeSection === "onboarding" && (
        <section role="tabpanel">
          <h3>Getting Started</h3>
          <p>
            Welcome to rad.io, a professional software-defined radio visualizer.
          </p>

          <InfoBanner
            variant="info"
            title="🎯 New to ATSC Digital TV?"
            role="note"
            style={{ marginBottom: "24px" }}
          >
            <p>
              Follow our comprehensive{" "}
              <a
                href="https://github.com/alexthemitchell/rad.io/blob/main/docs/tutorials/atsc-golden-path.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--rad-info-fg)",
                  textDecoration: "underline",
                }}
              >
                ATSC Golden Path Guide
              </a>{" "}
              for a step-by-step walkthrough:
            </p>
            <ol style={{ marginBottom: 0 }}>
              <li>Connect your SDR device</li>
              <li>Scan for ATSC channels</li>
              <li>Tune and play a channel</li>
              <li>View the Electronic Program Guide (EPG)</li>
              <li>Enable closed captions</li>
              <li>Monitor signal health</li>
            </ol>
            <p style={{ marginTop: "12px", marginBottom: 0 }}>
              <strong>Estimated time:</strong> 15-20 minutes |{" "}
              <strong>No SDR experience required!</strong>
            </p>
          </InfoBanner>

          <h4>Quick Start Guide (General SDR)</h4>
          <ol>
            <li>Connect your SDR device (RTL-SDR, HackRF, etc.)</li>
            <li>Go to Devices panel and scan for devices</li>
            <li>Select your device and configure settings</li>
            <li>Navigate to Monitor page to start listening</li>
            <li>Tune to a frequency using the VFO controls</li>
          </ol>

          {/* TODO: Add interactive onboarding tutorial */}
          {/* TODO: Add screenshots/animations */}
          {/* TODO: Add "First Time" checklist */}
        </section>
      )}

      {activeSection === "keyboard" && (
        <section role="tabpanel">
          <h3>Keyboard Shortcuts</h3>

          <h4>Global Shortcuts</h4>
          <dl>
            <dt>
              <kbd>1</kbd>
            </dt>
            <dd>Navigate to Monitor</dd>

            <dt>
              <kbd>2</kbd>
            </dt>
            <dd>Navigate to Scanner</dd>

            <dt>
              <kbd>3</kbd>
            </dt>
            <dd>Navigate to Decode</dd>

            <dt>
              <kbd>4</kbd>
            </dt>
            <dd>Navigate to Analysis</dd>

            <dt>
              <kbd>5</kbd>
            </dt>
            <dd>Navigate to Recordings</dd>

            <dt>
              <kbd>6</kbd>
            </dt>
            <dd>Navigate to ATSC Player</dd>

            <dt>
              <kbd>?</kbd>
            </dt>
            <dd>Show Help</dd>

            <dt>
              <kbd>R</kbd>
            </dt>
            <dd>Toggle Recording</dd>

            <dt>
              <kbd>B</kbd>
            </dt>
            <dd>Add Bookmark</dd>

            <dt>
              <kbd>M</kbd>
            </dt>
            <dd>Cycle Modulation Mode</dd>
          </dl>

          <h4>Tuning</h4>
          <dl>
            <dt>
              <kbd>↑</kbd> / <kbd>↓</kbd>
            </dt>
            <dd>Tune frequency (1 kHz steps)</dd>

            <dt>
              <kbd>Shift</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd>
            </dt>
            <dd>Tune frequency (10 kHz steps)</dd>

            <dt>
              <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd>
            </dt>
            <dd>Tune frequency (100 Hz steps)</dd>

            <dt>
              <kbd>+</kbd> / <kbd>-</kbd>
            </dt>
            <dd>Adjust gain</dd>
          </dl>

          <h4>Display</h4>
          <dl>
            <dt>
              <kbd>,</kbd> / <kbd>.</kbd>
            </dt>
            <dd>Zoom in/out</dd>

            <dt>
              <kbd>W</kbd>
            </dt>
            <dd>Cycle window function</dd>

            <dt>
              <kbd>G</kbd>
            </dt>
            <dd>Toggle grid</dd>
          </dl>

          {/* TODO: Add search functionality */}
          {/* TODO: Make shortcuts configurable */}
        </section>
      )}

      {activeSection === "accessibility" && (
        <section role="tabpanel">
          <h3>Accessibility Features</h3>

          <h4>Screen Reader Support</h4>
          <p>
            rad.io is fully navigable with screen readers (NVDA, JAWS,
            VoiceOver).
          </p>
          <ul>
            <li>All controls have descriptive labels</li>
            <li>Status changes are announced via live regions</li>
            <li>Frequency and signal information is spoken</li>
            <li>Complex visualizations have text alternatives</li>
          </ul>

          <h4>Keyboard Navigation</h4>
          <p>All functionality is accessible via keyboard:</p>
          <ul>
            <li>Tab through interactive elements</li>
            <li>Use arrow keys for tuning and navigation</li>
            <li>Press Enter or Space to activate controls</li>
            <li>Use Escape to close dialogs and panels</li>
          </ul>

          <h4>Visual Accommodations</h4>
          <ul>
            <li>High contrast mode support</li>
            <li>Respects prefers-reduced-motion</li>
            <li>Colorblind-friendly palettes</li>
            <li>Adjustable text size</li>
            <li>Focus indicators always visible</li>
          </ul>

          {/* TODO: Add link to full accessibility documentation */}
          {/* TODO: Add accessibility feedback form */}
        </section>
      )}

      {activeSection === "releases" && (
        <section role="tabpanel">
          <h3>Release Notes</h3>

          <article>
            <h4>Version 0.0.1 (Current)</h4>
            <p>
              <time dateTime="2025-10-25">October 25, 2025</time>
            </p>
            <ul>
              <li>Initial release</li>
              <li>Basic spectrum visualization</li>
              <li>HackRF device support</li>
              <li>WebUSB integration</li>
              <li>Real-time audio demodulation</li>
            </ul>
          </article>

          {/* TODO: Load release notes from external source */}
          {/* TODO: Add version comparison */}
          {/* TODO: Add “What's New” highlights */}
        </section>
      )}

      {activeSection === "support" && (
        <section role="tabpanel">
          <h3>Support & Resources</h3>

          <h4>Documentation</h4>
          <ul>
            <li>
              <a href="https://github.com/alexthemitchell/rad.io">
                GitHub Repository
              </a>
            </li>
            <li>
              <a href="https://github.com/alexthemitchell/rad.io/blob/main/README.md">
                README
              </a>
            </li>
            <li>
              <a href="https://github.com/alexthemitchell/rad.io/blob/main/ARCHITECTURE.md">
                Architecture
              </a>
            </li>
          </ul>

          <h4>Report Issues</h4>
          <ul>
            <li>
              <a href="https://github.com/alexthemitchell/rad.io/issues">
                GitHub Issues
              </a>
            </li>
          </ul>

          <h4>Community</h4>
          <ul>
            <li>
              <a href="https://github.com/alexthemitchell/rad.io/discussions">
                Discussions
              </a>
            </li>
          </ul>

          {/* TODO: Add in-app feedback form */}
          {/* TODO: Add system info copy button for bug reports */}
        </section>
      )}
    </main>
  );
}

export default Help;
