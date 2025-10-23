// Utility functions for exporting pipeline data and visualizations

export function exportStageDataAsCSV<T extends Record<string, unknown>>(
  _stageId: string,
  data: T[],
): string {
  if (!data || !Array.isArray(data) || data.length === 0 || !data[0]) {
    return "";
  }
  const keys = Object.keys(data[0] as object);
  const header = keys.join(",");
  const rows = data.map((row) => keys.map((k) => String(row[k])).join(","));
  return [header, ...rows].join("\n");
}

export function exportStageDataAsJSON<T>(stageId: string, data: T[]): string {
  return JSON.stringify({ stageId, data }, null, 2);
}

export function copyToClipboard(text: string): void {
  if (navigator?.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    // fallback
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

export function savePNGFromCanvas(
  canvas: HTMLCanvasElement,
  filename: string = "stage.png",
): void {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
