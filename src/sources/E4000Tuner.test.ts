import { describe, expect, it } from 'vitest'
import type { RtlCom } from '@jtarrio/webrtlsdr/rtlsdr/rtlcom.js'
import { E4000Tuner } from './E4000Tuner'

class FakeRtlCom {
  readonly registers = new Map<number, number>([
    [0x02, 0x40],
    [0x07, 0x01],
  ])
  readonly writes: Array<{ register: number; value: number }> = []
  openCount = 0
  closeCount = 0

  async openI2C(): Promise<void> {
    this.openCount += 1
  }

  async closeI2C(): Promise<void> {
    this.closeCount += 1
  }

  async getI2CReg(_address: number, register: number): Promise<number> {
    return this.registers.get(register) ?? 0
  }

  async setI2CReg(_address: number, register: number, value: number): Promise<void> {
    this.registers.set(register, value)
    this.writes.push({ register, value })
  }
}

describe('E4000Tuner', () => {
  it('detects and initializes the attached tuner identity', async () => {
    const com = new FakeRtlCom()

    const tuner = await E4000Tuner.maybeInit(com as unknown as RtlCom)

    expect(tuner).not.toBeNull()
    expect(com.writes).toContainEqual({ register: 0x00, value: 0x07 })
    expect(com.writes).toContainEqual({ register: 0x7a, value: 0x96 })
    expect(com.openCount).toBe(com.closeCount)
  })

  it('does not initialize a different tuner', async () => {
    const com = new FakeRtlCom()
    com.registers.set(0x02, 0)

    expect(await E4000Tuner.maybeInit(com as unknown as RtlCom)).toBeNull()
    expect(com.writes).toEqual([])
  })

  it('programs the PLL and reports the actual tuned frequency', async () => {
    const com = new FakeRtlCom()
    const tuner = await E4000Tuner.maybeInit(com as unknown as RtlCom)

    const actualFrequencyHz = await tuner!.setFrequency(100_000_000)

    expect(actualFrequencyHz).toBeGreaterThan(99_999_000)
    expect(actualFrequencyHz).toBeLessThanOrEqual(100_000_000)
    expect(com.writes).toEqual(expect.arrayContaining([
      { register: 0x0d, value: 0x0d },
      { register: 0x09, value: 111 },
      { register: 0x78, value: 3 },
    ]))
  })

  it('maps documented manual gains and can return to AGC', async () => {
    const com = new FakeRtlCom()
    const tuner = await E4000Tuner.maybeInit(com as unknown as RtlCom)

    await tuner!.setManualGain(24)
    expect(com.registers.get(0x14)).toBe(12)
    expect((com.registers.get(0x15) ?? 0) & 0x01).toBe(0)

    await tuner!.setManualGain(42)
    expect(com.registers.get(0x14)).toBe(14)
    expect((com.registers.get(0x15) ?? 0) & 0x01).toBe(1)
    await expect(tuner!.setManualGain(43)).rejects.toThrow(/Unsupported/)

    await tuner!.setAutoGain()
    expect(com.registers.get(0x1a)! & 0x0f).toBe(0x09)
    expect(com.registers.get(0x20)! & 0x01).toBe(0x01)
  })
})