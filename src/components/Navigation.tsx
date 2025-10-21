import { NavLink } from "react-router-dom";
import "../styles/main.css";

function Navigation(): React.JSX.Element {
  return (
    <nav className="main-nav" role="navigation" aria-label="Main navigation">
      <NavLink
        to="/"
        className={({ isActive }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Live signal monitoring and audio playback"
      >
        Live Monitor
      </NavLink>
      <NavLink
        to="/scanner"
        className={({ isActive }) =>
          isActive ? "nav-link active" : "nav-link"
        }
        title="Scan frequencies and talkgroups"
      >
        Scanner
      </NavLink>
      <NavLink
        to="/analysis"
        className={({ isActive }) =>
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
