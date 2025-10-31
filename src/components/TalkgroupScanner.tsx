import { type ChangeEvent, useState } from "react";

export type Talkgroup = {
  id: string;
  name: string;
  category: string;
  priority: number;
  enabled: boolean;
};

type TalkgroupScannerProps = {
  talkgroups: Talkgroup[];
  onTalkgroupToggle: (id: string) => void;
  onAddTalkgroup: (talkgroup: Omit<Talkgroup, "enabled">) => void;
  onUpdatePriority?: (id: string, priority: number) => void;
};

export default function TalkgroupScanner({
  talkgroups,
  onTalkgroupToggle,
  onAddTalkgroup,
  onUpdatePriority,
}: TalkgroupScannerProps): React.JSX.Element {
  const [newTgId, setNewTgId] = useState("");
  const [newTgName, setNewTgName] = useState("");
  const [newTgCategory, setNewTgCategory] = useState("General");
  const [newTgPriority, setNewTgPriority] = useState(5);

  const handleAddTalkgroup = (): void => {
    if (newTgId && newTgName) {
      onAddTalkgroup({
        id: newTgId,
        name: newTgName,
        category: newTgCategory,
        priority: newTgPriority,
      });
      setNewTgId("");
      setNewTgName("");
      setNewTgCategory("General");
      setNewTgPriority(5);
    }
  };

  const categories = ["Fire", "Police", "EMS", "Public Works", "General"];

  return (
    <div className="talkgroup-scanner">
      <div className="talkgroup-add-section">
        <h3 className="talkgroup-section-title">Add Talkgroup</h3>
        <div className="talkgroup-add-form">
          <input
            type="text"
            className="control-input talkgroup-input"
            placeholder="Talkgroup ID (decimal)"
            value={newTgId}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setNewTgId(e.target.value)
            }
            title="Enter talkgroup ID in decimal format (e.g., 101, 2002). This is the unique identifier for the talkgroup on the P25 system."
            aria-label="Talkgroup ID"
          />
          <input
            type="text"
            className="control-input talkgroup-input"
            placeholder="Name"
            value={newTgName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setNewTgName(e.target.value)
            }
            title="Enter a descriptive name for this talkgroup (e.g., 'Fire Dispatch', 'Police Channel 1')"
            aria-label="Talkgroup name"
          />
          <select
            className="control-select talkgroup-select"
            value={newTgCategory}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setNewTgCategory(e.target.value)
            }
            title="Select the category for this talkgroup to organize your scanner"
            aria-label="Talkgroup category"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <label className="talkgroup-priority-label">
            <span>Priority: {newTgPriority}</span>
            <input
              type="range"
              className="talkgroup-priority-slider"
              min="1"
              max="10"
              value={newTgPriority}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNewTgPriority(parseInt(e.target.value))
              }
              title="Set priority level (1=lowest, 10=highest). Higher priority talkgroups will be monitored preferentially."
              aria-label="Talkgroup priority"
            />
          </label>
          <button
            className="btn btn-primary talkgroup-add-btn"
            onClick={handleAddTalkgroup}
            disabled={!newTgId || !newTgName}
            title="Add this talkgroup to your scanner list"
            aria-label="Add talkgroup"
          >
            Add
          </button>
        </div>
      </div>

      <div className="talkgroup-list-section">
        <h3 className="talkgroup-section-title">
          Monitored Talkgroups ({talkgroups.filter((tg) => tg.enabled).length}/
          {talkgroups.length})
        </h3>
        <div className="talkgroup-list">
          {talkgroups.length === 0 ? (
            <div className="talkgroup-empty">
              No talkgroups configured. Add talkgroups above to start
              monitoring.
            </div>
          ) : (
            talkgroups.map((tg) => (
              <div
                key={tg.id}
                className={`talkgroup-item ${tg.enabled ? "enabled" : "disabled"}`}
              >
                <label className="talkgroup-checkbox-label">
                  <input
                    type="checkbox"
                    className="talkgroup-checkbox"
                    checked={tg.enabled}
                    onChange={() => onTalkgroupToggle(tg.id)}
                    title={`${tg.enabled ? "Disable" : "Enable"} monitoring for ${tg.name}`}
                    aria-label={`${tg.enabled ? "Disable" : "Enable"} ${tg.name}`}
                  />
                  <div className="talkgroup-info">
                    <div className="talkgroup-name">{tg.name}</div>
                    <div className="talkgroup-details">
                      ID: {tg.id} • {tg.category} • Priority: {tg.priority}
                    </div>
                  </div>
                </label>
                {onUpdatePriority && (
                  <div className="talkgroup-priority-control">
                    <input
                      type="range"
                      className="talkgroup-priority-slider"
                      min="1"
                      max="10"
                      value={tg.priority}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        onUpdatePriority(tg.id, parseInt(e.target.value))
                      }
                      title={`Adjust priority for ${tg.name} (1=lowest, 10=highest)`}
                      aria-label={`Priority for ${tg.name}`}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
