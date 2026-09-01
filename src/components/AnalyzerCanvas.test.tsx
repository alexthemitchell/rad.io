import { fireEvent, render, screen } from '@testing-library/react'
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
    return { frequencyHz: 100_000_000 + x, powerDb: -40 }
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

describe('AnalyzerCanvas', () => {
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
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 50 })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 50 })
    expect(screen.getByRole('status')).toHaveTextContent('-40.0 dBFS')

    fireEvent.mouseMove(canvas, { clientX: 10, clientY: 50 })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.mouseLeave(canvas)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
    const canvas = screen.getByRole('img', { name: 'spectrum' })
    fireEvent.click(canvas, { clientX: 150, clientY: 50 })
    expect(onFrequencySelect).toHaveBeenCalledWith(100_000_150)

    onFrequencySelect.mockClear()
    fireEvent.click(canvas, { clientX: 10, clientY: 50 })
    expect(onFrequencySelect).not.toHaveBeenCalled()
  })
})
