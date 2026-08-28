import { describe, expect, it, vi } from 'vitest'
import type { VfoMixerCommand, VfoMixerEvent } from '../vfo/types'
import {
  AudioPlaybackController,
  type AudioPlaybackDependencies,
} from './AudioPlaybackController'

type PortDouble = {
  messages: VfoMixerCommand[]
  onmessage: ((event: MessageEvent<VfoMixerEvent>) => void) | null
  postMessage(message: VfoMixerCommand): void
  close(): void
}

function createHarness(dependencyChanges: AudioPlaybackDependencies = {}) {
  const port: PortDouble = {
    messages: [],
    onmessage: null,
    postMessage(message) {
      this.messages.push(message)
    },
    close: vi.fn(),
  }
  const addModule = vi.fn(async () => {})
  const resume = vi.fn(async () => {})
  const suspend = vi.fn(async () => {})
  const close = vi.fn(async () => {})
  const connect = vi.fn()
  const disconnect = vi.fn()
  const createContext = vi.fn(() => ({
    sampleRate: 48_000,
    state: 'suspended' as AudioContextState,
    audioWorklet: { addModule },
    destination: {},
    resume,
    suspend,
    close,
  }))
  const createNode = vi.fn(() => ({
    port: port as unknown as MessagePort,
    connect,
    disconnect,
  }))
  const dependencies = {
    createContext,
    createNode,
    workletUrl: '/vfo-mixer.js',
    ...dependencyChanges,
  } satisfies AudioPlaybackDependencies
  return {
    controller: new AudioPlaybackController(dependencies),
    port,
    createContext,
    createNode,
    addModule,
    resume,
    suspend,
    close,
    connect,
    disconnect,
  }
}

describe('AudioPlaybackController', () => {
  it('closes both channel ends when worklet port attachment fails', async () => {
    const producerClose = vi.fn()
    const consumerClose = vi.fn()
    const channel = {
      port1: { close: producerClose },
      port2: { close: consumerClose },
    } as unknown as MessageChannel
    const harness = createHarness({ createMessageChannel: () => channel })
    await harness.controller.start()
    harness.port.postMessage = () => {
      throw new Error('Worklet port attachment failed.')
    }

    expect(() => harness.controller.createProducerPort()).toThrow(
      'Worklet port attachment failed.',
    )
    expect(producerClose).toHaveBeenCalledOnce()
    expect(consumerClose).toHaveBeenCalledOnce()
  })

  it('reports a worklet load failure and can retry with the same context', async () => {
    const harness = createHarness()
    harness.addModule.mockRejectedValueOnce(new Error('Worklet module failed to load.'))

    await expect(harness.controller.start()).rejects.toThrow('Worklet module failed to load.')
    expect(harness.controller.snapshot).toMatchObject({
      state: 'error',
      detail: 'Worklet module failed to load.',
    })

    await expect(harness.controller.start()).resolves.toBe(48_000)
    expect(harness.createContext).toHaveBeenCalledOnce()
    expect(harness.addModule).toHaveBeenCalledTimes(2)
  })

  it('creates one audio graph lazily on the first start gesture', async () => {
    const harness = createHarness()
    expect(harness.createContext).not.toHaveBeenCalled()

    await expect(harness.controller.start()).resolves.toBe(48_000)
    await expect(harness.controller.start()).resolves.toBe(48_000)

    expect(harness.createContext).toHaveBeenCalledTimes(1)
    expect(harness.createNode).toHaveBeenCalledTimes(1)
    expect(harness.addModule).toHaveBeenCalledWith('/vfo-mixer.js')
    expect(harness.resume).toHaveBeenCalledTimes(1)
    expect(harness.connect).toHaveBeenCalledTimes(1)
    expect(harness.controller.snapshot).toMatchObject({
      state: 'running',
      sampleRateHz: 48_000,
    })
  })

  it('updates controls without rebuilding the audio graph and flushes before suspend', async () => {
    const harness = createHarness()
    harness.controller.configureVfos([
      { id: 'vfo-1', revision: 1, gainDb: -6, muted: false, solo: false, active: true },
    ])
    await harness.controller.start()
    harness.controller.configureMaster(-12, true)
    await harness.controller.suspend()

    expect(harness.createNode).toHaveBeenCalledTimes(1)
    expect(harness.port.messages).toContainEqual({
      type: 'configure',
      vfos: [
        { id: 'vfo-1', revision: 1, gainDb: -6, muted: false, solo: false, active: true },
      ],
      masterGainDb: -12,
      masterMuted: true,
    })
    expect(harness.port.messages.at(-1)).toEqual({ type: 'flush' })
    expect(harness.suspend).toHaveBeenCalledTimes(1)
  })

  it('publishes worklet diagnostics and disposes the graph', async () => {
    const harness = createHarness()
    await harness.controller.start()
    harness.port.onmessage?.({
      data: {
        type: 'diagnostics',
        diagnostics: {
          queuedFrames: { 'vfo-1': 960 },
          underruns: {},
          overruns: {},
          staleBlocks: 0,
          limiterReductionDb: -2,
        },
      },
    } as unknown as MessageEvent<VfoMixerEvent>)
    expect(harness.controller.snapshot.diagnostics?.queuedFrames['vfo-1']).toBe(960)

    await harness.controller.dispose()
    expect(harness.disconnect).toHaveBeenCalledTimes(1)
    expect(harness.close).toHaveBeenCalledTimes(1)
    expect(harness.controller.snapshot.state).toBe('idle')
  })
})