import type { RdsDecodeTarget } from '../workers/protocol'

export class RdsSearchClock {
  readonly #startedAtUs = new Map<number, bigint>()

  update(targets: readonly RdsDecodeTarget[], timestampUs: bigint): void {
    const channels = new Set(targets.map((target) => target.channelCenterHz))
    for (const channelCenterHz of this.#startedAtUs.keys()) {
      if (!channels.has(channelCenterHz)) this.#startedAtUs.delete(channelCenterHz)
    }
    for (const channelCenterHz of channels) {
      if (!this.#startedAtUs.has(channelCenterHz)) {
        this.#startedAtUs.set(channelCenterHz, timestampUs)
      }
    }
  }

  elapsedUs(channelCenterHz: number, timestampUs: bigint): bigint {
    const startedAtUs = this.#startedAtUs.get(channelCenterHz)
    if (startedAtUs === undefined || timestampUs <= startedAtUs) return 0n
    return timestampUs - startedAtUs
  }

  reset(): void {
    this.#startedAtUs.clear()
  }
}