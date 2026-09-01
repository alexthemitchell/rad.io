import { useLayoutEffect, useRef, useState } from 'react'
import type { FrameHub } from '../analyzer/FrameHub'
import {
  formatRfFrequency,
  observeCanvas,
  type CanvasRenderer,
  type PlotHitInfo,
} from '../renderers/canvas'

type RendererConstructor = new (canvas: HTMLCanvasElement) => CanvasRenderer

type HoverInfo = PlotHitInfo & { x: number; y: number }

const TOOLTIP_EDGE_PADDING_PX = 96

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

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setHover(null)
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

  const hitTestAt = (x: number, y: number): PlotHitInfo | null => {
    const canvas = canvasRef.current
    const renderer = rendererRef.current
    if (!canvas || !renderer?.hitTest) return null
    return renderer.hitTest(x, y)
  }

  const hoverAt = (x: number, y: number): HoverInfo | null => {
    const canvas = canvasRef.current
    const hit = hitTestAt(x, y)
    if (!canvas || !hit) return null
    const containerWidth = canvas.parentElement?.clientWidth ?? 0
    const edgePaddingPx = Math.min(TOOLTIP_EDGE_PADDING_PX, containerWidth / 2)
    const clampedX = Math.min(
      Math.max(canvas.offsetLeft + x, edgePaddingPx),
      Math.max(edgePaddingPx, containerWidth - edgePaddingPx),
    )
    if (!hit) return null
    return {
      ...hit,
      x: clampedX,
      y: canvas.offsetTop + y,
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
        onMouseMove={(event) => setHover(hoverAt(event.nativeEvent.offsetX, event.nativeEvent.offsetY))}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          if (!onFrequencySelect) return
          const hit = hitTestAt(event.nativeEvent.offsetX, event.nativeEvent.offsetY)
          if (hit) onFrequencySelect(hit.frequencyHz)
        }}
        onKeyDown={(event) => {
          if (!onFrequencySelect || !rendererRef.current?.hitTest || event.repeat) return
          if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return
          event.preventDefault()
          const canvas = canvasRef.current
          if (!canvas) return
          const width = canvas.clientWidth || canvas.getBoundingClientRect().width
          const height = canvas.clientHeight || canvas.getBoundingClientRect().height
          const hit = hitTestAt(width / 2, height / 2)
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
          <span>{hover.powerDbfs.toFixed(1)} dBFS</span>
        </div>
      )}
    </figure>
  )
}
