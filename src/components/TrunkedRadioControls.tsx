import { ChangeEvent } from "react";

type TrunkedRadioControlsProps = {
  controlChannel: number;
  nac: string;
  systemId: string;
  wacn: string;
  onControlChannelChange: (frequency: number) => void;
  onNacChange: (nac: string) => void;
  onSystemIdChange: (systemId: string) => void;
  onWacnChange: (wacn: string) => void;
};

export default function TrunkedRadioControls({
  controlChannel,
  nac,
  systemId,
  wacn,
  onControlChannelChange,
  onNacChange,
  onSystemIdChange,
  onWacnChange,
}: TrunkedRadioControlsProps) {
  const handleControlChannelChange = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => {
    if (value === "") {
      // Skip update if input is empty
      return;
    }
    const numValue = Number(value);
    if (Number.isNaN(numValue)) {
      // Skip update if input is not a valid number
      return;
    }
    onControlChannelChange(numValue * 1e6);
  };

  const handleNacChange = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => {
    onNacChange(value);
  };

  const handleSystemIdChange = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => {
    onSystemIdChange(value);
  };

  const handleWacnChange = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => {
    onWacnChange(value);
  };

  const displayFreq = controlChannel / 1e6;

  return (
    <div className="trunked-radio-controls">
      <div className="control-group">
        <label className="control-label" htmlFor="control-channel-input">
          Control Channel (MHz)
        </label>
        <input
          id="control-channel-input"
          type="number"
          name="controlChannel"
          className="control-input"
          min={150}
          max={900}
          step={0.0125}
          value={displayFreq.toFixed(4)}
          onChange={handleControlChannelChange}
          title="P25 trunking control channel frequency. Common ranges: 700-800 MHz (700 MHz band), 150-174 MHz (VHF band), 450-470 MHz (UHF band). The control channel manages all talkgroup assignments."
          aria-label={`Control channel frequency in MHz. Current: ${displayFreq.toFixed(4)} MHz`}
        />
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="nac-input">
          NAC (Network Access Code)
        </label>
        <input
          id="nac-input"
          type="text"
          name="nac"
          className="control-input"
          value={nac}
          onChange={handleNacChange}
          placeholder="$293 (hex)"
          maxLength={4}
          title="Network Access Code (NAC) - 12-bit identifier in hexadecimal format (e.g., $293). Used to identify the P25 system. Must match the system NAC to decode transmissions."
          aria-label={`Network Access Code. Current: ${nac || "Not set"}`}
        />
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="system-id-input">
          System ID
        </label>
        <input
          id="system-id-input"
          type="text"
          name="systemId"
          className="control-input"
          value={systemId}
          onChange={handleSystemIdChange}
          placeholder="$001 (hex)"
          maxLength={4}
          title="System ID - 12-bit identifier in hexadecimal format (e.g., $001). Uniquely identifies this P25 trunked system within the network."
          aria-label={`System ID. Current: ${systemId || "Not set"}`}
        />
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="wacn-input">
          WACN
        </label>
        <input
          id="wacn-input"
          type="text"
          name="wacn"
          className="control-input"
          value={wacn}
          onChange={handleWacnChange}
          placeholder="$BEE00 (hex)"
          maxLength={6}
          title="Wide Area Communications Network (WACN) - 20-bit identifier in hexadecimal format (e.g., $BEE00). Identifies the network operator or region."
          aria-label={`WACN identifier. Current: ${wacn || "Not set"}`}
        />
      </div>
    </div>
  );
}
