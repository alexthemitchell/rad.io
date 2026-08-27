import type { AnalysisFrameEvent } from '../workers/protocol'
import {
  formatFrequency,
  prepareCanvas,
  type CanvasRenderer,
} from './canvas'

const MARGIN = { top: 18, right: 18, bottom: 30, left: 50 }

export class SpectrumRenderer implements CanvasRenderer {
  readonly #canvas: HTMLCanvasElement
  readonly #context: CanvasRenderingContext2D
  #width = 1
  #height = 1
  #pixelRatio = 1
  #lastFrame: AnalysisFrameEvent | undefined

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas 2D is unavailable.')
    this.#canvas = canvas
    this.#context = context
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.#width = width
    this.#height = height
    this.#pixelRatio = pixelRatio
    prepareCanvas(this.#canvas, this.#context, width, height, pixelRatio)
    this.draw(this.#lastFrame)
  }

  draw(frame = this.#lastFrame): void {
    this.#lastFrame = frame
    const context = this.#context
    const plotWidth = Math.max(1, this.#width - MARGIN.left - MARGIN.right)
    const plotHeight = Math.max(1, this.#height - MARGIN.top - MARGIN.bottom)
    context.setTransform(this.#pixelRatio, 0, 0, this.#pixelRatio, 0, 0)
    context.fillStyle = '#10191a'
    context.fillRect(0, 0, this.#width, this.#height)
    drawSpectrumGrid(context, this.#width, this.#height, plotWidth, plotHeight, frame)
    if (!frame || frame.spectrumDb.length < 2) return

    context.save()
    context.beginPath()
    context.rect(MARGIN.left, MARGIN.top, plotWidth, plotHeight)
    context.clip()
    const gradient = context.createLinearGradient(0, MARGIN.top, 0, MARGIN.top + plotHeight)
    gradient.addColorStop(0, 'rgba(73, 221, 205, 0.28)')
    gradient.addColorStop(1, 'rgba(73, 221, 205, 0)')
    context.beginPath()
    for (let index = 0; index < frame.spectrumDb.length; index += 1) {
      const x = MARGIN.left + (index / (frame.spectrumDb.length - 1)) * plotWidth
      const normalized = Math.max(0, Math.min(1, (frame.spectrumDb[index] + 120) / 120))
      const y = MARGIN.top + (1 - normalized) * plotHeight
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.lineTo(MARGIN.left + plotWidth, MARGIN.top + plotHeight)
    context.lineTo(MARGIN.left, MARGIN.top + plotHeight)
    context.closePath()
    context.fillStyle = gradient
    context.fill()

    context.beginPath()
    for (let index = 0; index < frame.spectrumDb.length; index += 1) {
      const x = MARGIN.left + (index / (frame.spectrumDb.length - 1)) * plotWidth
      const normalized = Math.max(0, Math.min(1, (frame.spectrumDb[index] + 120) / 120))
      const y = MARGIN.top + (1 - normalized) * plotHeight
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.strokeStyle = '#49ddcd'
    context.lineWidth = 1.5
    context.stroke()

    const peakX =
      MARGIN.left +
      ((frame.peakFrequencyHz + frame.sampleRateHz / 2) / frame.sampleRateHz) *
        plotWidth
    context.beginPath()
    context.moveTo(peakX, MARGIN.top)
    context.lineTo(peakX, MARGIN.top + plotHeight)
    context.strokeStyle = '#f0bd56'
    context.lineWidth = 1
    context.stroke()
    context.restore()
  }

  reset(): void {
    this.#lastFrame = undefined
    this.draw()
  }
}

function drawSpectrumGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  plotWidth: number,
  plotHeight: number,
  frame?: AnalysisFrameEvent,
): void {
  context.strokeStyle = 'rgba(134, 165, 166, 0.18)'
  context.fillStyle = '#839596'
  context.font = '10px "IBM Plex Mono"'
  context.lineWidth = 1
  for (let division = 0; division <= 4; division += 1) {
    const x = MARGIN.left + (division / 4) * plotWidth
    const y = MARGIN.top + (division / 4) * plotHeight
    context.beginPath()
    context.moveTo(x, MARGIN.top)
    context.lineTo(x, MARGIN.top + plotHeight)
    context.moveTo(MARGIN.left, y)
    context.lineTo(MARGIN.left + plotWidth, y)
    context.stroke()
    context.textAlign = 'right'
    context.fillText(`${-division * 30}`, MARGIN.left - 7, y + 3)
  }
  const sampleRate = frame?.sampleRateHz ?? 1_000_000
  context.textAlign = 'left'
  context.fillText(formatFrequency(-sampleRate / 2), MARGIN.left, height - 9)
  context.textAlign = 'center'
  context.fillText('DC', MARGIN.left + plotWidth / 2, height - 9)
  context.textAlign = 'right'
  context.fillText(formatFrequency(sampleRate / 2), width - MARGIN.right, height - 9)
}