type TalkgroupStatusProps = {
  currentTalkgroup: string | null;
  currentTalkgroupName: string | null;
  signalPhase: "Phase 1" | "Phase 2" | null;
  tdmaSlot: number | null;
  signalStrength: number;
  isEncrypted: boolean;
};

export default function TalkgroupStatus({
  currentTalkgroup,
  currentTalkgroupName,
  signalPhase,
  tdmaSlot,
  signalStrength,
  isEncrypted,
}: TalkgroupStatusProps): React.JSX.Element {
  const getSignalStrengthLabel = (strength: number): string => {
    if (strength >= 80) {
      return "Excellent";
    }
    if (strength >= 60) {
      return "Good";
    }
    if (strength >= 40) {
      return "Fair";
    }
    if (strength >= 20) {
      return "Weak";
    }
    return "Very Weak";
  };

  const getSignalStrengthClass = (strength: number): string => {
    if (strength >= 80) {
      return "excellent";
    }
    if (strength >= 60) {
      return "good";
    }
    if (strength >= 40) {
      return "fair";
    }
    return "weak";
  };

  return (
    <div className="talkgroup-status">
      <div className="status-row">
        <div className="status-item">
          <div className="status-label">Current Talkgroup</div>
          <div className="status-value">
            {currentTalkgroup ? (
              <>
                <span className="status-talkgroup-id">{currentTalkgroup}</span>
                {currentTalkgroupName && (
                  <span className="status-talkgroup-name">
                    {currentTalkgroupName}
                  </span>
                )}
              </>
            ) : (
              <span className="status-inactive">No active transmission</span>
            )}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">P25 Phase</div>
          <div className="status-value">
            {signalPhase ? (
              <span className="status-phase">{signalPhase}</span>
            ) : (
              <span className="status-inactive">—</span>
            )}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">TDMA Slot</div>
          <div className="status-value">
            {tdmaSlot !== null ? (
              <span className="status-slot">Slot {tdmaSlot}</span>
            ) : (
              <span className="status-inactive">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="status-row">
        <div className="status-item">
          <div className="status-label">Signal Strength</div>
          <div className="status-value">
            <div className="signal-strength-container">
              <div className="signal-strength-bar-container">
                <div
                  className={`signal-strength-bar ${getSignalStrengthClass(signalStrength)}`}
                  style={{ width: `${signalStrength}%` }}
                />
              </div>
              <span className="signal-strength-text">
                {signalStrength}% ({getSignalStrengthLabel(signalStrength)})
              </span>
            </div>
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Encryption</div>
          <div className="status-value">
            {isEncrypted ? (
              <span className="status-encrypted">🔒 Encrypted</span>
            ) : (
              <span className="status-clear">Clear (Unencrypted)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
