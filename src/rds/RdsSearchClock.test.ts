import { describe, expect, it } from 'vitest'
import { RdsSearchClock } from './RdsSearchClock'

const TARGET = {
  channelCenterHz: 91_300_000,
  frequencyOffsetHz: 250_000,
}

describe('RdsSearchClock', () => {
  it('starts when the decoder target is selected instead of using track age', () => {
    const clock = new RdsSearchClock()

    clock.update([TARGET], 20_000_000n)

    expect(clock.elapsedUs(TARGET.channelCenterHz, 20_000_000n)).toBe(0n)
    expect(clock.elapsedUs(TARGET.channelCenterHz, 24_000_000n)).toBe(4_000_000n)
  })

  it('restarts acquisition time when a target is removed and selected again', () => {
    const clock = new RdsSearchClock()
    clock.update([TARGET], 1_000_000n)
    clock.update([], 3_000_000n)
    clock.update([TARGET], 10_000_000n)

    expect(clock.elapsedUs(TARGET.channelCenterHz, 11_000_000n)).toBe(1_000_000n)
  })

  it('reset removes all target clocks', () => {
    const clock = new RdsSearchClock()
    clock.update([TARGET], 1_000_000n)
    clock.reset()

    expect(clock.elapsedUs(TARGET.channelCenterHz, 10_000_000n)).toBe(0n)
  })
})