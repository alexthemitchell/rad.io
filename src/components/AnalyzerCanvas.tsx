import { useEffect, useRef } from 'react'
import type { FrameHub } from '../analyzer/FrameHub'
import {
  observeCanvas,
  type CanvasRenderer,
} from '../renderers/canvas'

type RendererConstructor = new (canvas: HTMLCanvasElement) => CanvasRenderer

type AnalyzerCanvasProps = {
  frames: FrameHub
  title: string
  eyebrow: string
  ariaLabel: string
  className?: string
  renderer: RendererConstructor
}

export function AnalyzerCanvas({
  frames,
  title,
  eyebrow,
  ariaLabel,
  className = '',
  renderer: Renderer,
}: AnalyzerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new Renderer(canvas)
    const stopObserving = observeCanvas(canvas, (width, height, pixelRatio) => {
      renderer.resize(width, height, pixelRatio)
    })
    const unsubscribe = frames.subscribe((frame) => renderer.draw(frame))
    return () => {
      unsubscribe()
      stopObserving()
    }
  }, [frames, Renderer])

  return (
    <figure className={`plot-panel ${className}`}>
      <figcaption>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </figcaption>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </figure>
  )
}