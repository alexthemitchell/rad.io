import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyzerSource, RdsSink, SampleSink } from '../sources/types'
import type {
  AnalysisFrameEvent,
  RdsDecodeTarget,
  RdsReception,
  WorkerEvent,
  WorkerRequest,
} from '../workers/protocol'
import { DEFAULT_GENERATOR_CONFIG } from '../workers/protocol'
import { AnalyzerController } from './AnalyzerController'

class FakeWorker {
  static instance: FakeWorker
  readonly requests: WorkerRequest[] = []
  readonly #messageListeners = new Set<(event: MessageEvent<WorkerEvent>) => void>()

  constructor() {
    FakeWorker.instance = this
  }

  postMessage(request: WorkerRequest): void {
    this.requests.push(request)
    if (request.type === 'init') {
      queueMicrotask(() => {
        this.emit({ type: 'ready', protocolVersion: 3, engineSequence: 0 })
      })
    }
  }

  addEventListener(type: string, listener: EventListener): void {
    if (type === 'message') {
      this.#messageListeners.add(listener as (event: MessageEvent<WorkerEvent>) => void)
    }
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (type === 'message') {
      this.#messageListeners.delete(listener as (event: MessageEvent<WorkerEvent>) => void)
    }
  }

  terminate(): void {}

  emit(message: WorkerEvent): void {
    const event = { data: message } as MessageEvent<WorkerEvent>
    for (const listener of this.#messageListeners) listener(event)
  }
}

class FakeSource implements AnalyzerSource {
  readonly id = 'fake-source'
  readonly targets: RdsDecodeTarget[][] = []
  #rdsSink: RdsSink | undefined
  #resolve: (() => void) | undefined

  start(_sink: SampleSink, rdsSink?: RdsSink): Promise<void> {
    this.#rdsSink = rdsSink
    return new Promise((resolve) => {
      this.#resolve = resolve
    })
  }

  setRdsTargets(targets: readonly RdsDecodeTarget[]): void {
    this.targets.push([...targets])
  }

  async stop(): Promise<void> {
    this.#resolve?.()
  }

  emitRds(receptions: readonly RdsReception[]): void {
    this.#rdsSink?.(receptions)
  }
}

function frame(
  timestampUs: bigint,
  state: 'active' | 'recent' = 'active',
  centerFrequencyHz = 100_000_000,
): AnalysisFrameEvent {
  const channelCenterHz = 100_100_000
  const peakOffsetHz = channelCenterHz - centerFrequencyHz
  return {
    type: 'analysis-frame',
    protocolVersion: 3,
    sequence: Number(timestampUs / 1_000n) + 1,
    waveform: new Float32Array(2),
    spectrumDb: new Float32Array(2048),
    noiseFloorDbfs: -90,
    detections: [],
    trackedSignals: [
      {
        id: 'signal-1',
        peakOffsetHz,
        lowerOffsetHz: peakOffsetHz - 100_000,
        upperOffsetHz: peakOffsetHz + 100_000,
        absoluteFrequencyHz: channelCenterHz,
        lowerFrequencyHz: 100_000_000,
        upperFrequencyHz: 100_200_000,
        bandwidthHz: 200_000,
        peakPowerDbfs: -30,
        snrDb: 30,
        edgeClipped: false,
        firstSeenUs: 0n,
        lastSeenUs: timestampUs,
        durationUs: timestampUs,
        hitCount: 5,
        state,
        classification: {
          profileId: 'fcc-us',
          spectralShape: 'medium-band',
          primary: {
            allocationId: 'fm-100100000',
            channelCenterHz,
            label: 'FM broadcast channel 261 (100.1 MHz)',
            category: 'fm-broadcast',
            score: 0.9,
            reasons: [],
            caveats: [],
          },
          alternatives: [],
        },
        rds: {
          channelCenterHz,
          state: 'searching',
          reason: null,
          metadata: null,
          diagnostics: {
            synchronized: false,
            validGroups: 0,
            correctedBlocks: 0,
            rejectedGroups: 0,
            lostSyncCount: 0,
            lastValidGroupAtUs: null,
          },
        },
      },
    ],
    rdsTargets: [{ channelCenterHz, frequencyOffsetHz: peakOffsetHz }],
    sampleRateHz: 2_000_000,
    centerFrequencyHz,
    peakFrequencyHz: peakOffsetHz,
    peakPowerDbfs: -30,
    elapsedSamples: timestampUs * 2n,
    processingTimeMs: 1,
    sourceSequence: Number(timestampUs / 1_000n),
    timestampUs,
    formatVersion: 1,
  }
}

const RECEPTION: RdsReception = {
  channelCenterHz: 100_100_000,
  state: 'locked',
  reason: null,
  metadata: null,
  diagnostics: {
    synchronized: true,
    validGroups: 10,
    correctedBlocks: 0,
    rejectedGroups: 0,
    lostSyncCount: 0,
    lastValidGroupAtUs: 100_000n,
  },
}

describe('AnalyzerController RDS integration', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('forwards targets, associates updates, marks stale data, and clears on stop', async () => {
    const controller = new AnalyzerController()
    const source = new FakeSource()
    await controller.initialize()
    const running = controller.startExternal(source)

    FakeWorker.instance.emit(frame(100_000n))
    expect(source.targets.at(-1)).toEqual([
      { channelCenterHz: 100_100_000, frequencyOffsetHz: 100_000 },
    ])

    source.emitRds([RECEPTION])
    expect(controller.snapshot.trackedSignals[0].rds?.state).toBe('locked')

    FakeWorker.instance.emit(frame(1_000_000n, 'recent'))
    expect(controller.snapshot.trackedSignals[0].rds?.state).toBe('locked')

    FakeWorker.instance.emit(frame(2_200_001n, 'recent'))
    expect(controller.snapshot.trackedSignals[0].rds?.state).toBe('stale')

    await controller.stop()
    await running
    expect(source.targets.at(-1)).toEqual([])
    expect(controller.snapshot.trackedSignals[0].rds).toBeUndefined()
    controller.dispose()
  })

  it('reports a synchronous external source startup failure', async () => {
    const controller = new AnalyzerController()
    await controller.initialize()
    const source: AnalyzerSource = {
      id: 'failing-source',
      start: () => {
        throw new Error('WebUSB is unavailable.')
      },
      stop: async () => undefined,
    }

    await controller.startExternal(source)
    FakeWorker.instance.emit({
      type: 'status',
      protocolVersion: 3,
      state: 'idle',
    })

    expect(controller.snapshot.state).toBe('error')
    expect(controller.snapshot.detail).toBe('WebUSB is unavailable.')
    controller.dispose()
  })

  it('clears and reacquires RDS state after the RF center changes', async () => {
    const controller = new AnalyzerController()
    const source = new FakeSource()
    await controller.initialize()
    const running = controller.startExternal(source)

    FakeWorker.instance.emit(frame(100_000n))
    source.emitRds([RECEPTION])
    expect(controller.snapshot.trackedSignals[0].rds?.state).toBe('locked')

    controller.configure({
      ...DEFAULT_GENERATOR_CONFIG,
      sampleRateHz: 2_000_000,
      centerFrequencyHz: 99_850_000,
    })
    expect(source.targets.at(-1)).toEqual([])

    FakeWorker.instance.emit(frame(200_000n, 'active', 99_850_000))
    expect(source.targets.at(-1)).toEqual([
      { channelCenterHz: 100_100_000, frequencyOffsetHz: 250_000 },
    ])
    expect(controller.snapshot.trackedSignals[0].rds?.state).toBe('searching')

    source.emitRds([{
      ...RECEPTION,
      diagnostics: { ...RECEPTION.diagnostics, lastValidGroupAtUs: 200_000n },
    }])
    expect(controller.snapshot.trackedSignals[0].rds?.state).toBe('locked')

    await controller.stop()
    await running
    controller.dispose()
  })

  it('resumes generated analysis after resetting an active generator', async () => {
    const controller = new AnalyzerController()
    await controller.initialize()
    controller.startGenerated()

    await Promise.all([controller.reset(), controller.reset()])

    expect(FakeWorker.instance.requests.map((request) => request.type).slice(-4)).toEqual([
      'start-generated',
      'stop',
      'reset',
      'start-generated',
    ])
    controller.dispose()
  })
})