import type { RtlCom } from '@jtarrio/webrtlsdr/rtlsdr/rtlcom.js'
import type { Tuner } from '@jtarrio/webrtlsdr/rtlsdr/tuner.js'
import {
  E4000_MAX_FREQUENCY_HZ,
  E4000_MIN_FREQUENCY_HZ,
  E4000_TUNER_GAINS_DB,
} from './rtlSdrProtocol'

const E4000_I2C_ADDRESS = 0xc8
const E4000_CHECK_REGISTER = 0x02
const E4000_CHECK_VALUE = 0x40
const DEFAULT_XTAL_FREQUENCY_HZ = 28_800_000
const PLL_DENOMINATOR = 65_536

const REGISTER = {
  master: 0x00,
  clockInput: 0x05,
  referenceClock: 0x06,
  synthControl: 0x07,
  synthInteger: 0x09,
  synthFractionLow: 0x0a,
  synthFractionHigh: 0x0b,
  synthDivider: 0x0d,
  rfFilter: 0x10,
  ifFilter: 0x11,
  channelFilter: 0x12,
  lnaGain: 0x14,
  mixerGain: 0x15,
  ifGain1To4: 0x16,
  ifGain5To6: 0x17,
  agcMode: 0x1a,
  agcHighThreshold: 0x1d,
  agcLowThreshold: 0x1e,
  agcCalibration: 0x1f,
  mixerAgc: 0x20,
  enhancedGain: 0x24,
  dcControl: 0x2d,
  dcTime1: 0x70,
  dcTime2: 0x71,
  bias: 0x78,
  clockOutputPower: 0x7a,
} as const

const STARTUP_REGISTERS: ReadonlyArray<readonly [number, number]> = [
  [REGISTER.master, 0x07],
  [REGISTER.clockInput, 0x00],
  [REGISTER.referenceClock, 0x00],
  [REGISTER.clockOutputPower, 0x96],
  [0x7e, 0x01],
  [0x7f, 0xfe],
  [0x82, 0x00],
  [0x86, 0x50],
  [0x87, 0x20],
  [0x88, 0x01],
  [0x9f, 0x7f],
  [0xa0, 0x07],
  [REGISTER.agcHighThreshold, 0x10],
  [REGISTER.agcLowThreshold, 0x04],
  [REGISTER.agcCalibration, 0x1a],
  [REGISTER.ifGain1To4, 0x01],
  [REGISTER.ifGain5To6, 0x12],
  [REGISTER.ifFilter, 0xff],
  [REGISTER.channelFilter, 0x1f],
] as const

const PLL_DIVIDERS = [
  { belowHz: 72_400_000, dividerRegister: 0x0f, divider: 48 },
  { belowHz: 81_200_000, dividerRegister: 0x0e, divider: 40 },
  { belowHz: 108_300_000, dividerRegister: 0x0d, divider: 32 },
  { belowHz: 162_500_000, dividerRegister: 0x0c, divider: 24 },
  { belowHz: 216_600_000, dividerRegister: 0x0b, divider: 16 },
  { belowHz: 325_000_000, dividerRegister: 0x0a, divider: 12 },
  { belowHz: 350_000_000, dividerRegister: 0x09, divider: 8 },
  { belowHz: 432_000_000, dividerRegister: 0x03, divider: 8 },
  { belowHz: 667_000_000, dividerRegister: 0x02, divider: 6 },
  { belowHz: 1_200_000_000, dividerRegister: 0x01, divider: 4 },
] as const

const UHF_FILTER_CENTERS_HZ = [
  360, 380, 405, 425, 450, 475, 505, 540,
  575, 615, 670, 720, 760, 840, 890, 970,
].map((frequencyMhz) => frequencyMhz * 1_000_000)

const L_BAND_FILTER_CENTERS_HZ = [
  1300, 1320, 1360, 1410, 1445, 1460, 1490, 1530,
  1560, 1590, 1640, 1660, 1680, 1700, 1720, 1750,
].map((frequencyMhz) => frequencyMhz * 1_000_000)

const LNA_GAIN_CODES = new Map<number, number>([
  [-5, 0],
  [-2.5, 1],
  [0, 4],
  [2.5, 5],
  [5, 6],
  [7.5, 7],
  [10, 8],
  [12.5, 9],
  [15, 10],
  [17.5, 11],
  [20, 12],
  [25, 13],
  [30, 14],
])

type PllConfiguration = {
  actualFrequencyHz: number
  dividerRegister: number
  integerMultiplier: number
  fractionalMultiplier: number
}

export class E4000Tuner implements Tuner {
  readonly #com: RtlCom
  #xtalFrequencyHz = DEFAULT_XTAL_FREQUENCY_HZ

  private constructor(com: RtlCom) {
    this.#com = com
  }

  static async maybeInit(com: RtlCom): Promise<E4000Tuner | null> {
    let detected: boolean
    await com.openI2C()
    try {
      detected = await com.getI2CReg(E4000_I2C_ADDRESS, E4000_CHECK_REGISTER) ===
        E4000_CHECK_VALUE
    } catch {
      detected = false
    } finally {
      await com.closeI2C()
    }
    if (!detected) return null

    const tuner = new E4000Tuner(com)
    await tuner.open()
    return tuner
  }

  async open(): Promise<void> {
    await this.#withI2C(async () => {
      for (const [register, value] of STARTUP_REGISTERS) {
        await this.#write(register, value)
      }
      await this.#setMasked(REGISTER.dcControl, 0x03, 0)
      await this.#setMasked(REGISTER.dcTime1, 0x03, 0)
      await this.#setMasked(REGISTER.dcTime2, 0x03, 0)
      await this.#configureAutoGain()
    })
  }

  async close(): Promise<void> {
    await this.#withI2C(() => this.#setMasked(REGISTER.master, 0x02, 0))
  }

  async setFrequency(frequencyHz: number): Promise<number> {
    if (
      !Number.isSafeInteger(frequencyHz) ||
      frequencyHz < E4000_MIN_FREQUENCY_HZ ||
      frequencyHz > E4000_MAX_FREQUENCY_HZ
    ) {
      throw new Error('E4000 frequency must be an integer from 50 MHz to 2.2 GHz.')
    }
    const pll = this.#computePll(frequencyHz)
    await this.#withI2C(async () => {
      await this.#write(REGISTER.synthDivider, pll.dividerRegister)
      await this.#write(REGISTER.synthInteger, pll.integerMultiplier)
      await this.#write(REGISTER.synthFractionLow, pll.fractionalMultiplier & 0xff)
      await this.#write(REGISTER.synthFractionHigh, pll.fractionalMultiplier >>> 8)
      await this.#selectBandAndFilter(pll.actualFrequencyHz)
      const synthControl = await this.#read(REGISTER.synthControl)
      if ((synthControl & 0x01) === 0) {
        throw new Error(`E4000 PLL did not lock at ${frequencyHz} Hz.`)
      }
    })
    return pll.actualFrequencyHz
  }

  async setAutoGain(): Promise<void> {
    await this.#withI2C(() => this.#configureAutoGain())
  }

  async setManualGain(gainDb: number): Promise<void> {
    if (!(E4000_TUNER_GAINS_DB as readonly number[]).includes(gainDb)) {
      throw new Error(`Unsupported E4000 tuner gain ${gainDb} dB.`)
    }
    const mixerGainDb = gainDb > 34 ? 12 : 4
    const lnaGainDb = Math.min(30, gainDb - mixerGainDb)
    const lnaCode = LNA_GAIN_CODES.get(lnaGainDb)
    if (lnaCode === undefined) {
      throw new Error(`E4000 tuner gain ${gainDb} dB has no hardware mapping.`)
    }
    await this.#withI2C(async () => {
      await this.#setMasked(REGISTER.agcMode, 0x0f, 0x00)
      await this.#setMasked(REGISTER.mixerAgc, 0x01, 0x00)
      await this.#setMasked(REGISTER.enhancedGain, 0x07, 0x00)
      await this.#setMasked(REGISTER.lnaGain, 0x0f, lnaCode)
      await this.#setMasked(REGISTER.mixerGain, 0x01, mixerGainDb === 12 ? 1 : 0)
    })
  }

  setXtalFrequency(xtalFrequencyHz: number): void {
    if (!Number.isFinite(xtalFrequencyHz) || xtalFrequencyHz < 16_000_000 || xtalFrequencyHz > 30_000_000) {
      throw new Error('E4000 crystal frequency must be from 16 to 30 MHz.')
    }
    this.#xtalFrequencyHz = xtalFrequencyHz
  }

  getIntermediateFrequency(): number {
    return 0
  }

  getMinimumFrequency(): number {
    return E4000_MIN_FREQUENCY_HZ
  }

  #computePll(frequencyHz: number): PllConfiguration {
    const selected = PLL_DIVIDERS.find(({ belowHz }) => frequencyHz < belowHz) ?? {
      dividerRegister: 0,
      divider: 2,
    }
    const vcoFrequencyHz = frequencyHz * selected.divider
    const integerMultiplier = Math.floor(vcoFrequencyHz / this.#xtalFrequencyHz)
    const remainderHz = vcoFrequencyHz - integerMultiplier * this.#xtalFrequencyHz
    const fractionalMultiplier = Math.floor(
      remainderHz * PLL_DENOMINATOR / this.#xtalFrequencyHz,
    )
    if (integerMultiplier > 0xff || fractionalMultiplier > 0xffff) {
      throw new Error(`E4000 cannot synthesize ${frequencyHz} Hz.`)
    }
    const actualVcoFrequencyHz =
      this.#xtalFrequencyHz * integerMultiplier +
      Math.floor(this.#xtalFrequencyHz * fractionalMultiplier / PLL_DENOMINATOR)
    return {
      actualFrequencyHz: Math.floor(actualVcoFrequencyHz / selected.divider),
      dividerRegister: selected.dividerRegister,
      integerMultiplier,
      fractionalMultiplier,
    }
  }

  async #selectBandAndFilter(frequencyHz: number): Promise<void> {
    const band = frequencyHz < 140_000_000
      ? 0
      : frequencyHz < 350_000_000
        ? 1
        : frequencyHz < 1_135_000_000
          ? 2
          : 3
    await this.#write(REGISTER.bias, band === 3 ? 0 : 3)
    await this.#setMasked(REGISTER.synthControl, 0x06, 0)
    await this.#setMasked(REGISTER.synthControl, 0x06, band << 1)

    const centers = band === 2
      ? UHF_FILTER_CENTERS_HZ
      : band === 3
        ? L_BAND_FILTER_CENTERS_HZ
        : []
    const filterIndex = centers.length === 0 ? 0 : closestIndex(centers, frequencyHz)
    await this.#setMasked(REGISTER.rfFilter, 0x0f, filterIndex)
  }

  async #configureAutoGain(): Promise<void> {
    await this.#setMasked(REGISTER.agcMode, 0x0f, 0x09)
    await this.#setMasked(REGISTER.mixerAgc, 0x01, 0x01)
    await this.#setMasked(REGISTER.enhancedGain, 0x07, 0x00)
  }

  async #withI2C<T>(operation: () => Promise<T>): Promise<T> {
    await this.#com.openI2C()
    try {
      return await operation()
    } finally {
      await this.#com.closeI2C()
    }
  }

  #read(register: number): Promise<number> {
    return this.#com.getI2CReg(E4000_I2C_ADDRESS, register)
  }

  #write(register: number, value: number): Promise<void> {
    return this.#com.setI2CReg(E4000_I2C_ADDRESS, register, value)
  }

  async #setMasked(register: number, mask: number, value: number): Promise<void> {
    const current = await this.#read(register)
    const next = (current & ~mask) | (value & mask)
    if (next !== current) await this.#write(register, next)
  }
}

function closestIndex(values: readonly number[], target: number): number {
  let selectedIndex = 0
  let selectedDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < values.length; index += 1) {
    const distance = Math.abs(values[index] - target)
    if (distance < selectedDistance) {
      selectedIndex = index
      selectedDistance = distance
    }
  }
  return selectedIndex
}