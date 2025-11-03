import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import FrequencyScanner from "../components/FrequencyScanner";
import SignalTypeSelector, {
  type SignalType,
} from "../components/SignalTypeSelector";
import TalkgroupScanner, {
  type Talkgroup,
} from "../components/TalkgroupScanner";
import TalkgroupStatus from "../components/TalkgroupStatus";
import TransmissionLogViewer from "../components/TransmissionLogViewer";
import { useFrequencyScanner } from "../hooks/useFrequencyScanner";
import { notify } from "../lib/notifications";
import { useDevice } from "../store";

function Scanner(): React.JSX.Element {
  const navigate = useNavigate();
  const { primaryDevice: device } = useDevice();
  const [signalType, setSignalType] = useState<SignalType>("FM");
  const scanner = useFrequencyScanner(device);

  // Live region for screen reader announcements
  // Unified notifications

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
  const [currentTalkgroup] = useState<string | null>(null);
  const [currentTalkgroupName] = useState<string | null>(null);
  const [signalPhase] = useState<"Phase 1" | "Phase 2" | null>(null);
  const [tdmaSlot] = useState<number | null>(null);
  const [signalStrength] = useState(0);
  const [isEncrypted] = useState(false);

  const handleSignalTypeChange = (type: SignalType): void => {
    setSignalType(type);
    notify({
      message: `Signal type changed to ${type}`,
      sr: "polite",
      visual: false,
    });
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

  const handleUpdatePriority = (id: string, priority: number): void => {
    setTalkgroups((prev) =>
      prev.map((tg) => (tg.id === id ? { ...tg, priority } : tg)),
    );
  };

  const handleTuneToSignal = useCallback(
    (frequency: number) => {
      // Navigate to Live Monitor page with frequency in state
      void navigate("/", { state: { frequency, signalType } });
    },
    [navigate, signalType],
  );

  return (
    <div className="container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {null}

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
            onStartScan={() => {
              void scanner.startScan();
            }}
            onPauseScan={scanner.pauseScan}
            onResumeScan={scanner.resumeScan}
            onStopScan={scanner.stopScan}
            onConfigChange={scanner.updateConfig}
            onClearSignals={scanner.clearSignals}
            deviceAvailable={device?.isOpen() ?? false}
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
                onUpdatePriority={handleUpdatePriority}
              />
            </Card>

            <Card
              title="Transmission History"
              subtitle="View and search logged P25 transmissions"
            >
              <TransmissionLogViewer />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default Scanner;
