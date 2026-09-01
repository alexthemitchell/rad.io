import { describe, expect, it, vi } from 'vitest'
import { FrameHub } from './FrameHub'
import {
  SourceSession,
  type SourceSessionController,
} from './SourceSession'
import { HackRFSource } from '../sources/HackRFSource'
import { RtlSdrSource } from '../sources/RtlSdrSource'
import { DEFAULT_HACKRF_CONFIG, type HackRfConfig } from '../sources/hackrfProtocol'
import type { RtlSdrConfig } from '../sources/rtlSdrProtocol'
import type { UsbDeviceSelection } from '../sources/UsbDeviceRegistry'
import type { AnalyzerSnapshot } from './AnalyzerController'
import type { DetectionConfig, GeneratorConfig, TrackedSignal } from '../workers/protocol'
import type { VfoConfig } from '../vfo/types'

class FakeController implements SourceSessionController {
  readonly frames = new FrameHub()
  readonly configured: GeneratorConfig[] = []
  readonly detections: DetectionConfig[] = []
  readonly vfoRoutes: VfoConfig[][] = []
  readonly audioOwners: string[] = []
  readonly listeners = new Set<(snapshot: AnalyzerSnapshot) => void>()
  #resolveRun: (() => void) | undefined
  snapshot: AnalyzerSnapshot = {
    state: 'booting',
    detail: 'booting',
    sequence: 0,
    peakFrequencyHz: 0,
    peakPowerDbfs: -120,
    centerFrequencyHz: 0,
    noiseFloorDbfs: -120,
    trackedSignals: [],
    processingTimeMs: 0,
  }

  async initialize(): Promise<void> {
    this.#update({ state: 'idle', detail: 'ready' })
  }

  configure(config: GeneratorConfig): void {
    this.configured.push(config)
  }

  configureDetection(config: DetectionConfig): void {
    this.detections.push(config)
  }

  configureVfos(vfos: readonly VfoConfig[]): void {
    this.vfoRoutes.push([...vfos])
  }

  startExternal(): Promise<void> {
    this.#update({ state: 'running', detail: 'live' })
    return new Promise((resolve) => {
      this.#resolveRun = resolve
    })
  }

  startVfoAudio(
    _outputSampleRateHz: number,
    portFactory: (sourceSessionId: string) => MessagePort,
  ): void {
    portFactory('hackrf-3')
    this.audioOwners.push('hackrf-3')
  }

  stopVfoAudio(): void {}

  async stop(): Promise<void> {
    this.#resolveRun?.()
    this.#resolveRun = undefined
    this.#update({ state: 'idle', detail: 'ready' })
  }

  async reset(): Promise<void> {
    this.#update({ sequence: 0 })
  }

  subscribeStatus(listener: (snapshot: AnalyzerSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.listeners.clear()
  }

  #update(change: Partial<AnalyzerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...change }
    for (const listener of this.listeners) listener(this.snapshot)
  }
}

class DeferredController extends FakeController {
  #resolveInitialization: (() => void) | undefined

  override initialize(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.#resolveInitialization = resolve
    })
  }

  finishInitialization(): void {
    this.#resolveInitialization?.()
    this.#resolveInitialization = undefined
  }
}

class TestHackRfSource extends HackRFSource {
  config: HackRfConfig

  constructor(config: HackRfConfig, selection: UsbDeviceSelection) {
    super(config, { selection })
    this.config = config
  }

  override async applyRuntimeCommand(command: Parameters<HackRFSource['applyRuntimeCommand']>[0]) {
    if (command.type === 'set-center-frequency') {
      this.config = { ...this.config, centerFrequencyHz: command.centerFrequencyHz }
    } else if (command.type === 'set-lna-gain') {
      this.config = { ...this.config, lnaGainDb: command.lnaGainDb }
    } else {
      this.config = { ...this.config, vgaGainDb: command.vgaGainDb }
    }
    return { ...this.config }
  }
}

class PendingRtlSdrSource extends RtlSdrSource {
  readonly commands: Parameters<RtlSdrSource['applyRuntimeCommand']>[0][] = []

  override applyRuntimeCommand(command: Parameters<RtlSdrSource['applyRuntimeCommand']>[0]) {
    this.commands.push(command)
    return new Promise<RtlSdrConfig>(() => undefined)
  }
}

const selection: UsbDeviceSelection = {
  id: 'hackrf-3',
  kind: 'hackrf',
  label: 'Bench HackRF',
  device: { vendorId: 0x1d50, productId: 0x6089 } as never,
  vendorId: 0x1d50,
  productId: 0x6089,
  serialNumber: 'serial-3',
  acquisitionOwner: 'worker',
  connected: true,
}

const rtlSelection: UsbDeviceSelection = {
  ...selection,
  id: 'rtl-sdr-4',
  kind: 'rtl-sdr',
  label: 'Bench RTL-SDR',
  device: { vendorId: 0x0bda, productId: 0x2838 } as never,
  vendorId: 0x0bda,
  productId: 0x2838,
  serialNumber: 'serial-4',
}

const trackedSignal: TrackedSignal = {
  id: 'signal-1',
  peakOffsetHz: 100_000,
  lowerOffsetHz: 0,
  upperOffsetHz: 200_000,
  absoluteFrequencyHz: 100_100_000,
  lowerFrequencyHz: 100_000_000,
  upperFrequencyHz: 100_200_000,
  bandwidthHz: 200_000,
  peakPowerDbfs: -30,
  snrDb: 20,
  edgeClipped: false,
  firstSeenUs: 0n,
  lastSeenUs: 2_000_000n,
  durationUs: 2_000_000n,
  hitCount: 20,
  state: 'active',
  classification: {
    profileId: 'fcc-us',
    spectralShape: 'medium-band',
    primary: {
      allocationId: 'fm-100100000',
      channelCenterHz: 100_100_000,
      label: 'FM broadcast',
      category: 'fm-broadcast',
      score: 0.9,
      reasons: [],
      caveats: [],
    },
    alternatives: [],
  },
}

function vfo(id: string, sourceSessionId: string): VfoConfig {
  return {
    id,
    sourceSessionId,
    label: id,
    frequencyHz: 100_100_000,
    mode: 'wbfm',
    bandwidthHz: 200_000,
    squelchDbfs: -85,
    revision: 1,
    gainDb: -6,
    muted: false,
    solo: false,
  }
}

describe('SourceSession', () => {
  it('owns one controller and routes only its VFOs', async () => {
    const controller = new FakeController()
    const source = new TestHackRfSource(DEFAULT_HACKRF_CONFIG, selection)
    const session = new SourceSession(selection, {
      controller,
      createHackRfSource: () => source,
    })

    await session.initialize()
    session.configureVfos([vfo('mine', 'hackrf-3'), vfo('other', 'rtl-sdr-4')])
    session.connect()

    expect(session.snapshot).toMatchObject({
      id: 'hackrf-3',
      kind: 'hackrf',
      label: 'Bench HackRF',
      analyzer: { state: 'running' },
    })
    expect(controller.vfoRoutes.at(-1)?.map((candidate) => candidate.id)).toEqual(['mine'])

    const createPort = vi.fn(() => ({} as MessagePort))
    session.startVfoAudio(48_000, createPort)
    expect(createPort).toHaveBeenCalledWith('hackrf-3')

    await session.stop()
    expect(session.snapshot.analyzer.state).toBe('idle')
  })

  it('adopts acknowledged runtime configuration only for the current run', async () => {
    const controller = new FakeController()
    const source = new TestHackRfSource(DEFAULT_HACKRF_CONFIG, selection)
    const session = new SourceSession(selection, {
      controller,
      createHackRfSource: () => source,
    })
    await session.initialize()
    session.connect()

    await expect(session.applyHackRfRuntimeCommand({
      type: 'set-center-frequency',
      centerFrequencyHz: 99_750_000,
    })).resolves.toMatchObject({ centerFrequencyHz: 99_750_000 })

    expect(session.snapshot.config).toMatchObject({ centerFrequencyHz: 99_750_000 })
    expect(controller.configured.at(-1)?.centerFrequencyHz).toBe(99_750_000)
    expect(session.snapshot.runtimePending).toBe(false)
    await session.stop()
  })

  it('resets an in-flight optimizer command before an immediate reconnect', async () => {
    const controller = new FakeController()
    const sources: PendingRtlSdrSource[] = []
    const session = new SourceSession(rtlSelection, {
      controller,
      createRtlSdrSource: (config, deviceSelection) => {
        const source = new PendingRtlSdrSource(config, { selection: deviceSelection })
        sources.push(source)
        return source
      },
    })
    await session.initialize()
    session.connect()
    controller.snapshot = {
      ...controller.snapshot,
      peakPowerDbfs: -30,
      trackedSignals: [trackedSignal],
    }
    session.setAutoOptimizeEnabled(true)
    session.tickAutoOptimize(1_000)
    expect(sources[0].commands).toEqual([{ type: 'set-tuner-gain', tunerGainDb: 24 }])

    await session.stop()
    session.connect()
    controller.snapshot = {
      ...controller.snapshot,
      peakPowerDbfs: -30,
      trackedSignals: [trackedSignal],
    }
    session.tickAutoOptimize(1_250)

    expect(sources[1].commands).toEqual([{ type: 'set-tuner-gain', tunerGainDb: 24 }])
    await session.stop()
  })

  it('does not configure a controller after disposal during initialization', async () => {
    const controller = new DeferredController()
    const session = new SourceSession(selection, { controller })

    const initializing = session.initialize()
    session.dispose()
    controller.finishInitialization()
    await initializing

    expect(controller.configured).toEqual([])
    expect(controller.detections).toEqual([])
  })
})