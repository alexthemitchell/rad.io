import { useEffect, useRef, useState } from 'react'
import type { FrameHub } from '../analyzer/FrameHub'
import {
  formatRfFrequency,
  observeCanvas,
  type CanvasRenderer,
  type PlotHitInfo,
} from '../renderers/canvas'

type RendererConstructor = new (canvas: HTMLCanvasElement) => CanvasRenderer

type HoverInfo = PlotHitInfo & { x: number; y: number }

type AnalyzerCanvasProps = {
  frames: FrameHub
  title: string
  eyebrow: string
  ariaLabel: string
  className?: string
  renderer: RendererConstructor
  /**
   * When provided, clicking on a location within the plot that resolves to a
   * frequency (via the renderer's optional `hitTest`) invokes this callback
   * with the absolute RF frequency, enabling click-to-tune interactions.
   * Hovering over such a plot also renders a live frequency/power readout.
   */
  onFrequencySelect?: (frequencyHz: number) => void
}

export function AnalyzerCanvas({
  frames,
  title,
  eyebrow,
  ariaLabel,
  className = '',
  renderer: Renderer,
  onFrequencySelect,
}: AnalyzerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<CanvasRenderer | null>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new Renderer(canvas)
    rendererRef.current = renderer
    const stopObserving = observeCanvas(canvas, (width, height, pixelRatio) => {
      renderer.resize(width, height, pixelRatio)
    })
    const unsubscribe = frames.subscribe((frame) => renderer.draw(frame))
    return () => {
      unsubscribe()
      stopObserving()
      rendererRef.current = null
    }
  }, [frames, Renderer])

  const hitTestAt = (clientX: number, clientY: number): HoverInfo | null => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer?.hitTest) return null
    const canvasBounds = canvas.getBoundingClientRect()
    const x = clientX - canvasBounds.left
    const y = clientY - canvasBounds.top
    const hit = renderer.hitTest(x, y)
    if (!hit) return null
    const containerBounds = canvas.parentElement?.getBoundingClientRect() ?? canvasBounds
    return {
      ...hit,
      x: clientX - containerBounds.left,
      y: clientY - containerBounds.top,
    }
  }

  const interactive = Boolean(onFrequencySelect && Renderer.prototype.hitTest)

  return (
    <figure className={`plot-panel ${className}`}>
      <figcaption>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </figcaption>
      <canvas
        ref={canvasRef}
        role={interactive ? 'button' : 'img'}
        tabIndex={interactive ? 0 : undefined}
        aria-label={ariaLabel}
        className={interactive ? 'plot-panel-canvas--interactive' : undefined}
        onMouseMove={(event) => setHover(hitTestAt(event.clientX, event.clientY))}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          if (!onFrequencySelect) return
          const hit = hitTestAt(event.clientX, event.clientY)
          if (hit) onFrequencySelect(hit.frequencyHz)
        }}
        onKeyDown={(event) => {
          if (!onFrequencySelect || !rendererRef.current?.hitTest) return
          if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return
          event.preventDefault()
          const canvas = canvasRef.current
          if (!canvas) return
          const bounds = canvas.getBoundingClientRect()
          const hit = hitTestAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
          if (hit) onFrequencySelect(hit.frequencyHz)
        }}
      />
      {hover && (
        <div
          className="plot-panel-tooltip"
          style={{ left: hover.x, top: hover.y }}
          aria-hidden="true"
        >
          <strong>{formatRfFrequency(hover.frequencyHz)}</strong>
          <span>{hover.powerDb.toFixed(1)} dBFS</span>
        </div>
      )}
    </figure>
  )
}
