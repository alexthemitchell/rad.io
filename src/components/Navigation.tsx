import { useEffect } from "react";
import { NavLink } from "react-router-dom";

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
function Navigation(): React.JSX.Element {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent): void => {
      // Only handle keyboard shortcuts if not in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case "1":
          window.location.hash = "#/monitor";
          break;
        case "2":
          window.location.hash = "#/scanner";
          break;
        case "3":
          window.location.hash = "#/decode";
          break;
        case "4":
          window.location.hash = "#/analysis";
          break;
        case "5":
          window.location.hash = "#/recordings";
          break;
        case "?":
          window.location.hash = "#/help";
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return (): void => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  return (
    <nav className="main-nav" role="navigation" aria-label="Main navigation">
      <NavLink
        to="/monitor"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Live signal monitoring and audio playback (Keyboard: 1)"
        aria-keyshortcuts="1"
      >
        Monitor
      </NavLink>
      <NavLink
        to="/scanner"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Scan frequencies and talkgroups (Keyboard: 2)"
        aria-keyshortcuts="2"
      >
        Scanner
      </NavLink>
      <NavLink
        to="/decode"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Digital mode decoders (RTTY, PSK, SSTV) (Keyboard: 3)"
        aria-keyshortcuts="3"
      >
        Decode
      </NavLink>
      <NavLink
        to="/analysis"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Deep signal analysis and DSP pipeline (Keyboard: 4)"
        aria-keyshortcuts="4"
      >
        Analysis
      </NavLink>
      <NavLink
        to="/recordings"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Recording library and playback (Keyboard: 5)"
        aria-keyshortcuts="5"
      >
        Recordings
      </NavLink>
      <NavLink
        to="/help"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Help and documentation (Keyboard: ?)"
        aria-keyshortcuts="?"
      >
        Help
      </NavLink>
    </nav>
  );
}

export default Navigation;
