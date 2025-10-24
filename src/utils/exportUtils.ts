// Utility functions for exporting pipeline data and visualizations

export function exportStageDataAsCSV(
  _stageId: string,
  data: Array<Record<string, unknown>>,
): string {
  const firstRow = data[0];
  if (data.length === 0 || !firstRow) {
    return "";
  }
  const keys = Object.keys(firstRow);
  const header = keys.join(",");
  const rows = data.map((row) => keys.map((k) => String(row[k])).join(","));
  return [header, ...rows].join("\n");
}

export function exportStageDataAsJSON(
  stageId: string,
  data: unknown[],
): string {
  return JSON.stringify({ stageId, data }, null, 2);
}

export function copyToClipboard(text: string): void {
  // Prefer modern clipboard API
  void navigator.clipboard.writeText(text).catch(() => {
    // fallback - execCommand is deprecated but necessary for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- fallback for browsers without clipboard API
    document.execCommand("copy");
    document.body.removeChild(textarea);
  });
}

export function savePNGFromCanvas(
  canvas: HTMLCanvasElement,
  filename = "stage.png",
): void {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
