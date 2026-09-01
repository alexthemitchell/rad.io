import type { AnalysisFrameEvent } from '../workers/protocol'

export type PlotHitInfo = {
  frequencyHz: number
  powerDb: number
}

export interface CanvasRenderer {
  resize(width: number, height: number, pixelRatio: number): void
  draw(frame?: AnalysisFrameEvent): void
  reset(): void
  /**
   * Optional hit-test used to translate a CSS-pixel cursor position (relative
   * to the canvas element) into plot data, enabling hover readouts and
   * click-to-tune interactions. Renderers that don't support pointer
   * interaction can omit this method.
   */
  hitTest?(x: number, y: number): PlotHitInfo | null
}

export function observeCanvas(
  canvas: HTMLCanvasElement,
  onResize: (width: number, height: number, pixelRatio: number) => void,
): () => void {
  const resize = () => {
    const bounds = canvas.getBoundingClientRect()
    onResize(
      Math.max(1, Math.round(bounds.width)),
      Math.max(1, Math.round(bounds.height)),
      Math.min(window.devicePixelRatio || 1, 2),
    )
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  return () => observer.disconnect()
}

export function formatFrequency(frequencyHz: number, signed = false): string {
  const prefix = signed && frequencyHz > 0 ? '+' : ''
  const magnitude = Math.abs(frequencyHz)
  if (magnitude >= 1_000_000) return `${prefix}${(frequencyHz / 1_000_000).toFixed(2)} MHz`
  if (magnitude >= 1_000) return `${prefix}${(frequencyHz / 1_000).toFixed(1)} kHz`
  return `${prefix}${frequencyHz.toFixed(0)} Hz`
}

export function waveformChannelAmplitude(height: number): number {
  return Math.max(0, height * 0.18)
}

export function prepareCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelRatio: number,
): void {
  canvas.width = Math.max(1, Math.round(width * pixelRatio))
  canvas.height = Math.max(1, Math.round(height * pixelRatio))
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
}

export function formatRfFrequency(frequencyHz: number): string {
  if (Math.abs(frequencyHz) >= 1_000_000_000) {
    return `${(frequencyHz / 1_000_000_000).toFixed(6)} GHz`
  }
  if (Math.abs(frequencyHz) >= 1_000_000) {
    return `${(frequencyHz / 1_000_000).toFixed(4)} MHz`
  }
  return formatFrequency(frequencyHz)
}

export function frequencyOffsetToX(
  frequencyHz: number,
  sampleRateHz: number,
  plotLeft: number,
  plotWidth: number,
): number {
  const normalized = (frequencyHz + sampleRateHz / 2) / sampleRateHz
  return plotLeft + Math.max(0, Math.min(1, normalized)) * plotWidth
}

export function xToFrequencyOffset(
  x: number,
  sampleRateHz: number,
  plotLeft: number,
  plotWidth: number,
): number {
  const normalized = plotWidth > 0 ? (x - plotLeft) / plotWidth : 0
  const clamped = Math.max(0, Math.min(1, normalized))
  return clamped * sampleRateHz - sampleRateHz / 2
}