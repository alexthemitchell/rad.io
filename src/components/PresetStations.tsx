import { SignalType } from "./SignalTypeSelector";

type Station = {
  name: string;
  frequency: number;
  type: SignalType;
};

// Common FM stations (88.1 - 107.9 MHz)
const FM_STATIONS: Station[] = [
  { name: "NPR", frequency: 88.5e6, type: "FM" },
  { name: "Classic Rock", frequency: 95.5e6, type: "FM" },
  { name: "Pop", frequency: 100.3e6, type: "FM" },
  { name: "Jazz", frequency: 101.9e6, type: "FM" },
  { name: "Alternative", frequency: 103.1e6, type: "FM" },
  { name: "Country", frequency: 106.7e6, type: "FM" },
];

// Common AM stations (530 - 1700 kHz)
const AM_STATIONS: Station[] = [
  { name: "News", frequency: 660e3, type: "AM" },
  { name: "Talk Radio", frequency: 710e3, type: "AM" },
  { name: "Sports", frequency: 1010e3, type: "AM" },
  { name: "Music", frequency: 1130e3, type: "AM" },
  { name: "Public Radio", frequency: 1450e3, type: "AM" },
  { name: "Religious", frequency: 1600e3, type: "AM" },
];

type PresetStationsProps = {
  signalType: SignalType;
  currentFrequency: number;
  onStationSelect: (frequency: number) => void;
};

export default function PresetStations({
  signalType,
  currentFrequency,
  onStationSelect,
}: PresetStationsProps) {
  const stations = signalType === "FM" ? FM_STATIONS : AM_STATIONS;

  return (
    <div className="control-group">
      <label className="control-label">Preset Stations</label>
      <div className="preset-stations">
        {stations.map((station) => {
          const isActive = Math.abs(currentFrequency - station.frequency) < 1e4;
          return (
            <button
              key={station.name}
              className={`preset-btn ${isActive ? "active" : ""}`}
              onClick={() => onStationSelect(station.frequency)}
            >
              <div className="preset-name">{station.name}</div>
              <div className="preset-freq">
                {signalType === "FM"
                  ? `${(station.frequency / 1e6).toFixed(1)} MHz`
                  : `${(station.frequency / 1e3).toFixed(0)} kHz`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
