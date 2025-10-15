type P25System = {
  name: string;
  controlChannel: number;
  nac: string;
  systemId: string;
  wacn: string;
  location: string;
};

// Common P25 systems (examples - users should configure their local systems)
const P25_SYSTEMS: P25System[] = [
  {
    name: "Example County Public Safety",
    controlChannel: 770.95625e6,
    nac: "$293",
    systemId: "$001",
    wacn: "$BEE00",
    location: "700 MHz",
  },
  {
    name: "Example City Police",
    controlChannel: 773.00625e6,
    nac: "$2E1",
    systemId: "$002",
    wacn: "$BEE00",
    location: "700 MHz",
  },
  {
    name: "Example State Highway Patrol",
    controlChannel: 851.0125e6,
    nac: "$3A5",
    systemId: "$003",
    wacn: "$BEE01",
    location: "800 MHz",
  },
  {
    name: "Example Regional Fire",
    controlChannel: 154.2575e6,
    nac: "$1B7",
    systemId: "$004",
    wacn: "$BEE02",
    location: "VHF",
  },
];

type P25SystemPresetsProps = {
  currentControlChannel: number;
  onSystemSelect: (system: P25System) => void;
};

export default function P25SystemPresets({
  currentControlChannel,
  onSystemSelect,
}: P25SystemPresetsProps) {
  return (
    <div className="control-group">
      <label className="control-label">Preset P25 Systems</label>
      <div className="preset-stations">
        {P25_SYSTEMS.map((system) => {
          const isActive =
            Math.abs(currentControlChannel - system.controlChannel) < 1e3;
          const displayFreq = `${(system.controlChannel / 1e6).toFixed(4)} MHz`;

          const tooltip = `${system.name} - Control Channel: ${displayFreq} (${system.location})\nNAC: ${system.nac}, System ID: ${system.systemId}, WACN: ${system.wacn}\nClick to configure this P25 system.${isActive ? " (Currently configured)" : ""}`;

          return (
            <button
              key={system.name}
              className={`preset-btn p25-preset-btn ${isActive ? "active" : ""}`}
              onClick={() => onSystemSelect(system)}
              title={tooltip}
              aria-label={tooltip}
              aria-pressed={isActive}
            >
              <div className="preset-name">{system.name}</div>
              <div className="preset-freq">{system.location}</div>
            </button>
          );
        })}
      </div>
      <div className="p25-preset-note">
        Note: These are example systems. Configure your local P25 system details
        using the controls above.
      </div>
    </div>
  );
}
