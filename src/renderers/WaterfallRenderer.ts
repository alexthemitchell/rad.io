import type { AnalysisFrameEvent } from '../workers/protocol'
import { prepareCanvas, type CanvasRenderer } from './canvas'
import { spectrumIndex, WATERFALL_LUT } from './colorMap'

export class WaterfallRenderer implements CanvasRenderer {
  readonly #canvas: HTMLCanvasElement
  readonly #context: CanvasRenderingContext2D
  readonly #history = document.createElement('canvas')
  readonly #historyContext: CanvasRenderingContext2D
  #width = 1
  #height = 1
  #pixelRatio = 1
  #hasRows = false

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false })
    const historyContext = this.#history.getContext('2d', { alpha: false })
    if (!context || !historyContext) throw new Error('Canvas 2D is unavailable.')
    this.#canvas = canvas
    this.#context = context
    this.#historyContext = historyContext
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.#width = width
    this.#height = height
    this.#pixelRatio = pixelRatio
    prepareCanvas(this.#canvas, this.#context, width, height, pixelRatio)
    this.#history.width = this.#canvas.width
    this.#history.height = this.#canvas.height
    this.#hasRows = false
    this.draw()
  }

  draw(frame?: AnalysisFrameEvent): void {
    if (frame?.spectrumDb.length) this.#appendRow(frame.spectrumDb)
    this.#paint()
  }

  reset(): void {
    this.#historyContext.fillStyle = '#071213'
    this.#historyContext.fillRect(0, 0, this.#history.width, this.#history.height)
    this.#hasRows = false
    this.#paint()
  }

  #appendRow(spectrumDb: Float32Array): void {
    const width = this.#history.width
    const height = this.#history.height
    const rowHeight = Math.max(1, Math.round(this.#pixelRatio * 2))
    if (this.#hasRows) {
      this.#historyContext.drawImage(
        this.#history,
        0,
        0,
        width,
        height - rowHeight,
        0,
        rowHeight,
        width,
        height - rowHeight,
      )
    } else {
      this.#historyContext.fillStyle = '#071213'
      this.#historyContext.fillRect(0, 0, width, height)
      this.#hasRows = true
    }

    const row = this.#historyContext.createImageData(width, rowHeight)
    for (let x = 0; x < width; x += 1) {
      const bin = Math.min(
        spectrumDb.length - 1,
        Math.floor((x / Math.max(1, width - 1)) * spectrumDb.length),
      )
      const colorOffset = spectrumIndex(spectrumDb[bin]) * 4
      for (let y = 0; y < rowHeight; y += 1) {
        const pixelOffset = (y * width + x) * 4
        row.data[pixelOffset] = WATERFALL_LUT[colorOffset]
        row.data[pixelOffset + 1] = WATERFALL_LUT[colorOffset + 1]
        row.data[pixelOffset + 2] = WATERFALL_LUT[colorOffset + 2]
        row.data[pixelOffset + 3] = 255
      }
    }
    this.#historyContext.putImageData(row, 0, 0)
  }

  #paint(): void {
    this.#context.setTransform(1, 0, 0, 1, 0, 0)
    this.#context.fillStyle = '#071213'
    this.#context.fillRect(0, 0, this.#canvas.width, this.#canvas.height)
    this.#context.drawImage(this.#history, 0, 0)
    this.#context.setTransform(this.#pixelRatio, 0, 0, this.#pixelRatio, 0, 0)
    this.#context.strokeStyle = 'rgba(189, 220, 214, 0.12)'
    this.#context.lineWidth = 1
    for (let division = 1; division < 4; division += 1) {
      const x = (division / 4) * this.#width
      this.#context.beginPath()
      this.#context.moveTo(x, 0)
      this.#context.lineTo(x, this.#height)
      this.#context.stroke()
    }
    this.#context.fillStyle = 'rgba(220, 236, 232, 0.72)'
    this.#context.font = '10px "IBM Plex Mono"'
    this.#context.textAlign = 'right'
    this.#context.fillText('NEW', this.#width - 10, 16)
  }
}