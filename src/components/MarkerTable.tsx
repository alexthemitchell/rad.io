import React from "react";

export type MarkerRow = {
  id: string;
  freqHz: number;
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

export default function MarkerTable({
  markers,
  onRemove,
  onTune,
}: MarkerTableProps): React.JSX.Element | null {
  if (markers.length === 0) {
    return null;
  }

  const exportCsv = (): void => {
    const header = ["id", "freqHz", "freqMHz", "label"].join(",");
    const rows = markers.map((m) =>
      [m.id, String(m.freqHz), formatMHz(m.freqHz), m.label ?? ""].join(","),
    );
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
              {onTune ? <th style={thStyle}>Tune</th> : null}
              {onRemove ? <th style={thStyle}>Remove</th> : null}
            </tr>
          </thead>
          <tbody>
            {markers.map((m, idx) => (
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
            ))}
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
