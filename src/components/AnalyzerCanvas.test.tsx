import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FrameHub } from '../analyzer/FrameHub'
import type { CanvasRenderer, PlotHitInfo } from '../renderers/canvas'
import { AnalyzerCanvas } from './AnalyzerCanvas'

class StubRenderer implements CanvasRenderer {
  resize(): void {}
  draw(): void {}
  reset(): void {}
  hitTest(x: number): PlotHitInfo | null {
    if (x < 100) return null
    return { frequencyHz: 100_000_000 + x, powerDbfs: -40 }
  }
}

class NonInteractiveRenderer implements CanvasRenderer {
  resize(): void {}
  draw(): void {}
  reset(): void {}
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

function dispatchCanvasMouseEvent(
  canvas: HTMLElement,
  type: 'mousemove' | 'click',
  offsetX: number,
  offsetY: number,
) {
  const event =
    type === 'mousemove'
      ? createEvent.mouseMove(canvas, { clientX: offsetX, clientY: offsetY })
      : createEvent.click(canvas, { clientX: offsetX, clientY: offsetY })
  Object.defineProperties(event, {
    offsetX: { value: offsetX },
    offsetY: { value: offsetY },
  })
  fireEvent(canvas, event)
}

describe('AnalyzerCanvas', () => {
  it('keeps non-hit-test renderers non-interactive even when a frequency callback is provided', () => {
    const onFrequencySelect = vi.fn()
    render(
      <AnalyzerCanvas
        frames={new FrameHub()}
        title="Spectrum"
        eyebrow="POWER"
        ariaLabel="spectrum"
        renderer={NonInteractiveRenderer}
        onFrequencySelect={onFrequencySelect}
      />,
    )

    const canvas = screen.getByRole('img', { name: 'spectrum' })
    expect(screen.queryByRole('button', { name: 'spectrum' })).not.toBeInTheDocument()

    dispatchCanvasMouseEvent(canvas, 'click', 150, 50)
    expect(onFrequencySelect).not.toHaveBeenCalled()
  })

  it('does not render a hover readout when the renderer has no hitTest', () => {
    render(
      <AnalyzerCanvas
        frames={new FrameHub()}
        title="Spectrum"
        eyebrow="POWER"
        ariaLabel="spectrum"
        renderer={NonInteractiveRenderer}
      />,
    )
    const canvas = screen.getByRole('img', { name: 'spectrum' })
    dispatchCanvasMouseEvent(canvas, 'mousemove', 150, 50)
    expect(document.querySelector('.plot-panel-tooltip')).not.toBeInTheDocument()
  })

  it('shows a frequency/power readout while hovering over hit-testable plot area', () => {
    render(
      <AnalyzerCanvas
        frames={new FrameHub()}
        title="Spectrum"
        eyebrow="POWER"
        ariaLabel="spectrum"
        renderer={StubRenderer}
      />,
    )
    const canvas = screen.getByRole('img', { name: 'spectrum' })
    dispatchCanvasMouseEvent(canvas, 'mousemove', 150, 50)
    expect(document.querySelector('.plot-panel-tooltip')).toHaveTextContent('-40.0 dBFS')

    dispatchCanvasMouseEvent(canvas, 'mousemove', 10, 50)
    expect(document.querySelector('.plot-panel-tooltip')).not.toBeInTheDocument()

    fireEvent.mouseLeave(canvas)
    expect(document.querySelector('.plot-panel-tooltip')).not.toBeInTheDocument()
  })

  it('clears hover state when the renderer changes', () => {
    const frames = new FrameHub()
    const { rerender } = render(
      <AnalyzerCanvas
        frames={frames}
        title="Spectrum"
        eyebrow="POWER"
        ariaLabel="spectrum"
        renderer={StubRenderer}
      />,
    )
    const canvas = screen.getByRole('img', { name: 'spectrum' })
    dispatchCanvasMouseEvent(canvas, 'mousemove', 150, 50)
    expect(document.querySelector('.plot-panel-tooltip')).toHaveTextContent('-40.0 dBFS')

    rerender(
      <AnalyzerCanvas
        frames={frames}
        title="Spectrum"
        eyebrow="POWER"
        ariaLabel="spectrum"
        renderer={NonInteractiveRenderer}
      />,
    )

    expect(document.querySelector('.plot-panel-tooltip')).not.toBeInTheDocument()
  })

  it('invokes onFrequencySelect with the clicked frequency', () => {
    const onFrequencySelect = vi.fn()
    render(
      <AnalyzerCanvas
        frames={new FrameHub()}
        title="Spectrum"
        eyebrow="POWER"
        ariaLabel="spectrum"
        renderer={StubRenderer}
        onFrequencySelect={onFrequencySelect}
      />,
    )
    const canvas = screen.getByRole('button', { name: 'spectrum' })
    dispatchCanvasMouseEvent(canvas, 'click', 150, 50)
    expect(onFrequencySelect).toHaveBeenCalledWith(100_000_150)

    onFrequencySelect.mockClear()
    dispatchCanvasMouseEvent(canvas, 'click', 10, 50)
    expect(onFrequencySelect).not.toHaveBeenCalled()
  })

  it('ignores repeated keyboard activation when selecting a frequency', () => {
    const onFrequencySelect = vi.fn()
    render(
      <AnalyzerCanvas
        frames={new FrameHub()}
        title="Spectrum"
        eyebrow="POWER"
        ariaLabel="spectrum"
        renderer={StubRenderer}
        onFrequencySelect={onFrequencySelect}
      />,
    )
    const canvas = screen.getByRole('button', { name: 'spectrum' })
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 300, height: 100 }),
    })

    fireEvent.keyDown(canvas, { key: 'Enter', repeat: true })
    expect(onFrequencySelect).not.toHaveBeenCalled()

    fireEvent.keyDown(canvas, { key: 'Enter' })
    expect(onFrequencySelect).toHaveBeenCalledWith(100_000_150)
  })
})
