import type { AnalysisFrameEvent } from '../workers/protocol'

export type FrameListener = (frame: AnalysisFrameEvent) => void

export class FrameHub {
  readonly #listeners = new Set<FrameListener>()
  #latest: AnalysisFrameEvent | undefined
  #pending:
    | { frame: AnalysisFrameEvent; afterDelivery?: () => void }
    | undefined
  #animationFrame: number | undefined

  get latest(): AnalysisFrameEvent | undefined {
    return this.#latest
  }

  publish(frame: AnalysisFrameEvent, afterDelivery?: () => void): void {
    this.#pending?.afterDelivery?.()
    this.#pending = { frame, afterDelivery }
    this.#animationFrame ??= requestAnimationFrame(this.#deliver)
  }

  subscribe(listener: FrameListener): () => void {
    this.#listeners.add(listener)
    if (this.#latest) listener(this.#latest)
    return () => this.#listeners.delete(listener)
  }

  clear(): void {
    if (this.#animationFrame !== undefined) {
      cancelAnimationFrame(this.#animationFrame)
      this.#animationFrame = undefined
    }
    const pending = this.#pending
    this.#pending = undefined
    this.#latest = undefined
    pending?.afterDelivery?.()
  }

  readonly #deliver = (): void => {
    this.#animationFrame = undefined
    const pending = this.#pending
    this.#pending = undefined
    if (!pending) return

    this.#latest = pending.frame
    try {
      for (const listener of this.#listeners) listener(pending.frame)
    } finally {
      pending.afterDelivery?.()
    }
  }
}