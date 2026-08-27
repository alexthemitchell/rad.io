import type { AnalysisFrameEvent } from '../workers/protocol'
import {
  prepareCanvas,
  waveformChannelAmplitude,
  type CanvasRenderer,
} from './canvas'

export class WaveformRenderer implements CanvasRenderer {
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
    context.setTransform(this.#pixelRatio, 0, 0, this.#pixelRatio, 0, 0)
    context.fillStyle = '#10191a'
    context.fillRect(0, 0, this.#width, this.#height)
    context.strokeStyle = 'rgba(134, 165, 166, 0.18)'
    context.lineWidth = 1
    for (let division = 1; division < 4; division += 1) {
      const x = (division / 4) * this.#width
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, this.#height)
      context.stroke()
    }
    context.beginPath()
    context.moveTo(0, this.#height / 2)
    context.lineTo(this.#width, this.#height / 2)
    context.stroke()
    context.fillStyle = '#49ddcd'
    context.font = '600 11px "IBM Plex Mono"'
    context.fillText('I', 10, 18)
    context.fillStyle = '#f0bd56'
    context.fillText('Q', 10, this.#height / 2 + 18)
    if (!frame || frame.waveform.length < 4) return

    const amplitude = waveformChannelAmplitude(this.#height)
    drawChannel(
      context,
      frame.waveform,
      0,
      this.#width,
      this.#height / 4,
      amplitude,
      '#49ddcd',
    )
    drawChannel(
      context,
      frame.waveform,
      1,
      this.#width,
      (this.#height * 3) / 4,
      amplitude,
      '#f0bd56',
    )
  }

  reset(): void {
    this.#lastFrame = undefined
    this.draw()
  }
}

function drawChannel(
  context: CanvasRenderingContext2D,
  waveform: Float32Array,
  channel: 0 | 1,
  width: number,
  centerY: number,
  amplitude: number,
  color: string,
): void {
  const points = waveform.length / 2
  context.beginPath()
  for (let index = 0; index < points; index += 1) {
    const x = (index / (points - 1)) * width
    const y = centerY - Math.max(-1, Math.min(1, waveform[index * 2 + channel])) * amplitude
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.strokeStyle = color
  context.lineWidth = 1.4
  context.stroke()
}