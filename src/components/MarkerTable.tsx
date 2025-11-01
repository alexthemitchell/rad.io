import React from "react";

export type MarkerRow = {
  id: string;
  freqHz: number;
  powerDb?: number;
  label?: string;
};

export type MarkerTableProps = {
  markers: MarkerRow[];
  onRemove?: (id: string) => void;
  onTune?: (freqHz: number) => void;
};

function formatMHz(hz: number): string {
  return (hz / 1e6).toFixed(6);
}

/**
 * Calculate deltas between current marker and previous marker
 */
function calculateMarkerDeltas(
  marker: MarkerRow,
  prevMarker: MarkerRow | null,
): { deltaFreqHz: number | null; deltaPowerDb: number | null } {
  if (!prevMarker) {
    return { deltaFreqHz: null, deltaPowerDb: null };
  }

  const deltaFreqHz = marker.freqHz - prevMarker.freqHz;
  const deltaPowerDb =
    marker.powerDb !== undefined && prevMarker.powerDb !== undefined
      ? marker.powerDb - prevMarker.powerDb
      : null;

  return { deltaFreqHz, deltaPowerDb };
}

/**
 * Get color for delta power display based on value
 */
function getDeltaPowerColor(deltaPowerDb: number | null): string {
  if (deltaPowerDb === null) {
    return "#e8f2ff";
  }
  if (deltaPowerDb > 0) {
    return "#4fc3f7"; // Blue for gain
  }
  if (deltaPowerDb < 0) {
    return "#ff8080"; // Red for loss
  }
  return "#e8f2ff"; // Default for zero
}

/**
 * Format delta power for display with sign prefix and directional indicator
 * Uses ↑ for gain, ↓ for loss to provide visual cues independent of color
 */
function formatDeltaPower(deltaPowerDb: number | null): string {
  if (deltaPowerDb === null) {
    return "—";
  }
  if (deltaPowerDb > 0) {
    return `↑ +${deltaPowerDb.toFixed(2)}`;
  }
  if (deltaPowerDb < 0) {
    return `↓ ${deltaPowerDb.toFixed(2)}`;
  }
  return deltaPowerDb.toFixed(2);
}

export default function MarkerTable({
  markers,
  onRemove,
  onTune,
}: MarkerTableProps): React.JSX.Element | null {
  if (markers.length === 0) {
    return null;
  }

  const exportCsv = (): void => {
    const header = [
      "id",
      "freqHz",
      "freqMHz",
      "powerDb",
      "deltaFreqHz",
      "deltaPowerDb",
      "label",
    ].join(",");
    const rows = markers.map((m, idx) => {
      const prevMarker = idx > 0 ? (markers[idx - 1] ?? null) : null;
      const { deltaFreqHz, deltaPowerDb } = calculateMarkerDeltas(
        m,
        prevMarker,
      );

      return [
        m.id,
        String(m.freqHz),
        formatMHz(m.freqHz),
        m.powerDb?.toFixed(2) ?? "",
        deltaFreqHz !== null ? String(deltaFreqHz) : "",
        deltaPowerDb !== null ? deltaPowerDb.toFixed(2) : "",
        m.label ?? "",
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "markers.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Markers</h3>
        <button
          type="button"
          onClick={exportCsv}
          aria-label="Export markers as CSV"
          style={{
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
          }}
        >
          Export CSV
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Frequency (MHz)</th>
              <th style={thStyle}>Power (dB)</th>
              <th style={thStyle}>Δ Freq (Hz)</th>
              <th style={thStyle}>Δ Power (dB)</th>
              {onTune ? <th style={thStyle}>Tune</th> : null}
              {onRemove ? <th style={thStyle}>Remove</th> : null}
            </tr>
          </thead>
          <tbody>
            {markers.map((m, idx) => {
              const prevMarker = idx > 0 ? (markers[idx - 1] ?? null) : null;
              const { deltaFreqHz, deltaPowerDb } = calculateMarkerDeltas(
                m,
                prevMarker,
              );

              return (
                <tr key={m.id}>
                  <td style={tdStyle}>{idx + 1}</td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    }}
                  >
                    {formatMHz(m.freqHz)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    }}
                  >
                    {m.powerDb !== undefined ? m.powerDb.toFixed(2) : "—"}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    }}
                  >
                    {deltaFreqHz !== null ? deltaFreqHz.toFixed(0) : "—"}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                      color: getDeltaPowerColor(deltaPowerDb),
                    }}
                  >
                    {formatDeltaPower(deltaPowerDb)}
                  </td>
                  {onTune ? (
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => onTune(m.freqHz)}
                        aria-label={`Tune to ${formatMHz(m.freqHz)} megahertz`}
                        style={btnStyle}
                      >
                        Tune
                      </button>
                    </td>
                  ) : null}
                  {onRemove ? (
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => onRemove(m.id)}
                        aria-label={`Remove marker ${idx + 1}`}
                        style={btnDangerStyle}
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  color: "#cfe8ff",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  color: "#e8f2ff",
};

const btnStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "3px 8px",
  borderRadius: 4,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
};

const btnDangerStyle: React.CSSProperties = {
  ...btnStyle,
  background: "rgba(255,80,80,0.15)",
  border: "1px solid rgba(255,80,80,0.35)",
};
