import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import { useFrequencyScanner } from "../hooks/useFrequencyScanner";
import { useLiveRegion } from "../hooks/useLiveRegion";
import SignalTypeSelector, {
  SignalType,
} from "../components/SignalTypeSelector";
import FrequencyScanner from "../components/FrequencyScanner";
import TalkgroupScanner, { Talkgroup } from "../components/TalkgroupScanner";
import TalkgroupStatus from "../components/TalkgroupStatus";
import Card from "../components/Card";

function Scanner(): React.JSX.Element {
  const navigate = useNavigate();
  const { device } = useHackRFDevice();
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const scanner = useFrequencyScanner(device);

  // Live region for screen reader announcements
  const { announce, LiveRegion } = useLiveRegion();

  // P25 Trunked Radio State
  const [talkgroups, setTalkgroups] = useState<Talkgroup[]>([
    {
      id: "101",
      name: "Fire Dispatch",
      category: "Fire",
      priority: 9,
      enabled: true,
    },
    {
      id: "201",
      name: "Police Dispatch",
      category: "Police",
      priority: 9,
      enabled: true,
    },
    {
      id: "301",
      name: "EMS Main",
      category: "EMS",
      priority: 8,
      enabled: true,
    },
    {
      id: "102",
      name: "Fire Tactical",
      category: "Fire",
      priority: 7,
      enabled: false,
    },
  ]);
  const [currentTalkgroup, _setCurrentTalkgroup] = useState<string | null>(
    null,
  );
  const [currentTalkgroupName, _setCurrentTalkgroupName] = useState<
    string | null
  >(null);
  const [signalPhase, _setSignalPhase] = useState<"Phase 1" | "Phase 2" | null>(
    null,
  );
  const [tdmaSlot, _setTdmaSlot] = useState<number | null>(null);
  const [signalStrength, _setSignalStrength] = useState(0);
  const [isEncrypted, _setIsEncrypted] = useState(false);

  const handleSignalTypeChange = (type: SignalType): void => {
    setSignalType(type);
    announce(`Signal type changed to ${type}`);
  };

  const handleTalkgroupToggle = (id: string): void => {
    setTalkgroups((prev) =>
      prev.map((tg) => (tg.id === id ? { ...tg, enabled: !tg.enabled } : tg)),
    );
  };

  const handleAddTalkgroup = (
    newTalkgroup: Omit<Talkgroup, "enabled">,
  ): void => {
    setTalkgroups((prev) => [...prev, { ...newTalkgroup, enabled: true }]);
  };

  const handleTuneToSignal = useCallback(
    (frequency: number) => {
      // Navigate to Live Monitor page with frequency in state
      navigate("/", { state: { frequency, signalType } });
    },
    [navigate, signalType],
  );

  return (
    <div className="container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <LiveRegion />

      <main id="main-content" role="main">
        <Card
          title="Scanner Configuration"
          subtitle="Select signal type for scanning"
        >
          <SignalTypeSelector
            signalType={signalType}
            onSignalTypeChange={handleSignalTypeChange}
          />
        </Card>

        {signalType !== "P25" ? (
          <FrequencyScanner
            state={scanner.state}
            config={scanner.config}
            currentFrequency={scanner.currentFrequency}
            activeSignals={scanner.activeSignals}
            progress={scanner.progress}
            onStartScan={scanner.startScan}
            onPauseScan={scanner.pauseScan}
            onResumeScan={scanner.resumeScan}
            onStopScan={scanner.stopScan}
            onConfigChange={scanner.updateConfig}
            onClearSignals={scanner.clearSignals}
            deviceAvailable={device !== undefined && device.isOpen()}
            onTuneToSignal={handleTuneToSignal}
          />
        ) : (
          <>
            <Card
              title="Talkgroup Status"
              subtitle="Current P25 trunked radio activity"
            >
              <TalkgroupStatus
                currentTalkgroup={currentTalkgroup}
                currentTalkgroupName={currentTalkgroupName}
                signalPhase={signalPhase}
                tdmaSlot={tdmaSlot}
                signalStrength={signalStrength}
                isEncrypted={isEncrypted}
              />
            </Card>

            <Card
              title="Talkgroup Scanner"
              subtitle="Configure and monitor P25 talkgroups"
            >
              <TalkgroupScanner
                talkgroups={talkgroups}
                onTalkgroupToggle={handleTalkgroupToggle}
                onAddTalkgroup={handleAddTalkgroup}
              />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default Scanner;
