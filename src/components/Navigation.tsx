import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";

/**
 * Main navigation component for primary workspaces
 *
 * According to ADR-0018, shows:
 * - Monitor (default, keyboard: 1)
 * - Scanner (keyboard: 2)
 * - Decode (keyboard: 3)
 * - Analysis (keyboard: 4)
 * - Recordings (keyboard: 5)
 *
 * Additional pages accessible via other means:
 * - Settings, Calibration, Help
 * - Panels: Bookmarks, Devices, Measurements, Diagnostics
 *
 * Accessibility:
 * - Keyboard shortcuts (1-5 for primary pages)
 * - Clear active state
 * - Screen reader labels
 */

/**
 * Keyboard shortcut mappings for navigation
 * Maps keyboard keys to their corresponding routes
 *
 * Primary pages (1-5): Monitor, Scanner, Decode, Analysis, Recordings
 * Additional shortcuts: ? for Help
 */
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * String keys represent literal keyboard inputs, not variable names.
 * Disabling naming-convention for this object is intentional and documented.
 */
const KEYBOARD_SHORTCUTS: Record<string, string> = {
  "1": "/monitor",
  "2": "/scanner",
  "3": "/decode",
  "4": "/analysis",
  "5": "/recordings",
  "6": "/atsc-player",
  "?": "/help",
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

function Navigation(): React.JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent): void => {
      // Only handle keyboard shortcuts if not in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const route = KEYBOARD_SHORTCUTS[event.key];
      if (route !== undefined) {
        event.preventDefault();
        void navigate(route);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return (): void => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [navigate]);

  return (
    <nav className="main-nav" role="navigation" aria-label="Main navigation">
      <NavLink
        to="/monitor"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Live signal monitoring and audio playback - Start here for general SDR use (Keyboard: 1)"
        aria-keyshortcuts="1"
      >
        Monitor
      </NavLink>
      <NavLink
        to="/scanner"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Scan for ATSC channels, FM/AM stations, and talkgroups - Essential for finding signals (Keyboard: 2)"
        aria-keyshortcuts="2"
      >
        Scanner
      </NavLink>
      <NavLink
        to="/decode"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Digital mode decoders (RTTY, PSK, SSTV) - Advanced feature (Keyboard: 3)"
        aria-keyshortcuts="3"
      >
        Decode
      </NavLink>
      <NavLink
        to="/analysis"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Deep signal analysis and DSP pipeline - Advanced feature (Keyboard: 4)"
        aria-keyshortcuts="4"
      >
        Analysis
      </NavLink>
      <NavLink
        to="/recordings"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Recording library and playback - Save signals for later (Keyboard: 5)"
        aria-keyshortcuts="5"
      >
        Recordings
      </NavLink>
      <NavLink
        to="/atsc-player"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="ATSC Digital TV Player - Watch over-the-air TV broadcasts (Keyboard: 6)"
        aria-keyshortcuts="6"
      >
        ATSC Player
      </NavLink>
      <NavLink
        to="/help"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Help and documentation - Find guides and keyboard shortcuts (Keyboard: ?)"
        aria-keyshortcuts="?"
      >
        Help
      </NavLink>
    </nav>
  );
}

export default Navigation;
