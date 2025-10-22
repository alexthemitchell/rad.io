import { NavLink } from "react-router-dom";

function Navigation(): React.JSX.Element {
  return (
    <nav className="main-nav" role="navigation" aria-label="Main navigation">
      <NavLink
        to="/"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Live signal monitoring and audio playback"
      >
        Live Monitor
      </NavLink>
      <NavLink
        to="/scanner"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Scan frequencies and talkgroups"
      >
        Scanner
      </NavLink>
      <NavLink
        to="/analysis"
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Deep signal analysis and DSP pipeline"
      >
        Analysis
      </NavLink>
    </nav>
  );
}

export default Navigation;
