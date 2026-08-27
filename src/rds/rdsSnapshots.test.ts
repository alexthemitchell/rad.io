import { describe, expect, it } from 'vitest'
import { pendingRdsReception } from './rdsSnapshots'

describe('pendingRdsReception', () => {
  it('reports searching while the decoder acquisition window is open', () => {
    const reception = pendingRdsReception(100_300_000, 4_999_999n)

    expect(reception.state).toBe('searching')
    expect(reception.reason).toBeNull()
  })

  it('explains missing station data after the acquisition window', () => {
    const reception = pendingRdsReception(100_300_000, 5_000_000n)

    expect(reception.state).toBe('unavailable')
    expect(reception.reason).toContain('may not transmit RDS')
  })
})