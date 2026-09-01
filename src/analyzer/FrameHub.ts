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
    if (this.#listeners.size === 0) {
      this.#releasePending()
      this.#latest = frame
      afterDelivery?.()
      return
    }
    this.#pending?.afterDelivery?.()
    this.#pending = { frame, afterDelivery }
    this.#animationFrame ??= requestAnimationFrame(this.#deliver)
  }

  subscribe(listener: FrameListener): () => void {
    this.#listeners.add(listener)
    if (this.#latest) listener(this.#latest)
    return () => {
      this.#listeners.delete(listener)
      if (this.#listeners.size === 0 && this.#pending) {
        const pending = this.#pending
        this.#releasePending()
        this.#latest = pending.frame
      }
    }
  }

  clear(): void {
    this.#releasePending()
    this.#latest = undefined
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

  #releasePending(): void {
    if (this.#animationFrame !== undefined) {
      cancelAnimationFrame(this.#animationFrame)
      this.#animationFrame = undefined
    }
    const pending = this.#pending
    this.#pending = undefined
    pending?.afterDelivery?.()
  }
}