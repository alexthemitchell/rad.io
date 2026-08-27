import type { TrackedSignal } from '../workers/protocol'

const MINIMUM_FM_STATION_SPAN_HZ = 25_000

export class BroadcastStationGate {
  readonly #qualifiedChannelsHz = new Set<number>()

  filter(signals: readonly TrackedSignal[]): TrackedSignal[] {
    const currentChannelsHz = new Set<number>()
    for (const signal of signals) {
      const channelCenterHz = fmChannelCenter(signal)
      if (channelCenterHz === null) continue
      currentChannelsHz.add(channelCenterHz)
      if (signal.bandwidthHz > MINIMUM_FM_STATION_SPAN_HZ) {
        this.#qualifiedChannelsHz.add(channelCenterHz)
      }
    }

    for (const channelCenterHz of this.#qualifiedChannelsHz) {
      if (!currentChannelsHz.has(channelCenterHz)) {
        this.#qualifiedChannelsHz.delete(channelCenterHz)
      }
    }

    return signals.filter((signal) => {
      const channelCenterHz = fmChannelCenter(signal)
      return (
        channelCenterHz === null || this.#qualifiedChannelsHz.has(channelCenterHz)
      )
    })
  }

  reset(): void {
    this.#qualifiedChannelsHz.clear()
  }
}

function fmChannelCenter(signal: TrackedSignal): number | null {
  const candidate = signal.classification.primary
  return candidate.category === 'fm-broadcast' ? candidate.channelCenterHz : null
}