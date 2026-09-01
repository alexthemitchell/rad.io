import { describe, expect, it, vi } from 'vitest'
import { SourceSessionManager } from './SourceSessionManager'
import type { SourceSessionSnapshot } from './SourceSession'
import type { UsbDeviceSelection } from '../sources/UsbDeviceRegistry'
import { UsbDeviceRegistry } from '../sources/UsbDeviceRegistry'
import type { Usb, UsbDevice } from '../sources/webUsb'

class FakeSession {
  readonly selection: UsbDeviceSelection
  readonly initialize = vi.fn(async () => undefined)
  readonly connect = vi.fn()
  readonly stop = vi.fn(async () => undefined)
  readonly reset = vi.fn(async () => undefined)
  readonly dispose = vi.fn()
  readonly configureVfos = vi.fn(() => undefined)
  readonly tickAutoOptimize = vi.fn(() => undefined)
  readonly listeners = new Set<(snapshot: SourceSessionSnapshot) => void>()

  constructor(selection: UsbDeviceSelection) {
    this.selection = selection
  }

  get id(): string {
    return this.selection.id
  }

  get snapshot(): SourceSessionSnapshot {
    return {
      id: this.selection.id,
      kind: this.selection.kind,
      label: this.selection.label,
      serialNumber: this.selection.serialNumber,
      deviceConnected: this.selection.connected,
      config: this.selection.kind === 'hackrf'
        ? {
            centerFrequencyHz: 100_000_000,
            sampleRateHz: 2_000_000,
            fftSize: 2048,
            lnaGainDb: 16,
            vgaGainDb: 20,
            ampEnabled: false,
            frameRate: 30,
          }
        : {
            centerFrequencyHz: 100_000_000,
            sampleRateHz: 2_400_000,
            fftSize: 2048,
            tunerGainDb: null,
            frequencyCorrectionPpm: 0,
            directSampling: 'off',
            biasTeeEnabled: false,
            frameRate: 30,
          },
      detectionConfig: {
        enabled: true,
        minimumSnrDb: 15,
        maxSignals: 24,
        bandPlanId: 'fcc-us',
      },
      analyzer: {
        state: 'idle',
        detail: 'ready',
        sequence: 0,
        peakFrequencyHz: 0,
        peakPowerDbfs: -120,
        centerFrequencyHz: 0,
        noiseFloorDbfs: -120,
        trackedSignals: [],
        processingTimeMs: 0,
      },
      runtimePending: false,
      runtimeError: null,
      discontinuityRevision: 0,
      autoOptimize: {
        enabled: false,
        status: 'off',
        targetFrequencyHz: null,
        detail: 'Automatic optimization is off.',
      },
    }
  }

  initializeAudio(): void {}
  updateSelection(selection: UsbDeviceSelection): void {
    Object.assign(this.selection, selection)
    this.#emit()
  }
  subscribe(listener: (snapshot: SourceSessionSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => this.listeners.delete(listener)
  }
  #emit(): void {
    for (const listener of this.listeners) listener(this.snapshot)
  }
}

function device(vendorId: number, productId: number, serialNumber: string): UsbDevice {
  return { vendorId, productId, serialNumber } as UsbDevice
}

describe('SourceSessionManager', () => {
  it('adds, selects, connects, and removes sessions independently', async () => {
    const devices = [
      device(0x1d50, 0x6089, 'hackrf-a'),
      device(0x0bda, 0x2838, 'rtl-a'),
    ]
    let nextDevice = 0
    const usb = new EventTarget() as Usb
    usb.requestDevice = vi.fn(async () => devices[nextDevice++])
    usb.getDevices = vi.fn(async () => devices.slice(0, nextDevice))
    const registry = new UsbDeviceRegistry(usb)
    const sessions: FakeSession[] = []
    const manager = new SourceSessionManager(registry, {
      createSession: (selection) => {
        const session = new FakeSession(selection)
        sessions.push(session)
        return session as never
      },
    })

    const hackrf = await manager.addDevice()
    const rtl = await manager.addDevice()
    manager.connectSession(hackrf.id)
    manager.connectSession(rtl.id)

    expect(manager.snapshot.sessions).toHaveLength(2)
    expect(manager.snapshot.selectedSessionId).toBe(rtl.id)
    expect(sessions[0].connect).toHaveBeenCalledOnce()
    expect(sessions[1].connect).toHaveBeenCalledOnce()

    manager.selectSession(hackrf.id)
    await manager.removeSession(hackrf.id)
    expect(sessions[0].stop).toHaveBeenCalledOnce()
    expect(sessions[0].dispose).toHaveBeenCalledOnce()
    expect(manager.snapshot.selectedSessionId).toBe(rtl.id)
  })

  it('samples aggregate snapshots with one shared timer', async () => {
    const usbDevice = device(0x1d50, 0x6089, 'hackrf-a')
    const usb = new EventTarget() as Usb
    usb.requestDevice = vi.fn(async () => usbDevice)
    usb.getDevices = vi.fn(async () => [usbDevice])
    const registry = new UsbDeviceRegistry(usb)
    let timerHandler: (() => void) | undefined
    const clearInterval = vi.fn()
    const manager = new SourceSessionManager(registry, {
      createSession: (selection) => new FakeSession(selection) as never,
      setInterval: (handler) => {
        timerHandler = handler
        return 17
      },
      clearInterval,
    })
    const listener = vi.fn()
    manager.subscribe(listener)
    await manager.addDevice()

    manager.startSampling()
    manager.startSampling()
    timerHandler?.()
    manager.stopSampling()

    expect(listener).toHaveBeenCalled()
    expect(clearInterval).toHaveBeenCalledWith(17)
  })

  it('keeps a session removed while its initialization finishes', async () => {
    const usbDevice = device(0x0bda, 0x2838, 'rtl-a')
    const usb = new EventTarget() as Usb
    usb.requestDevice = vi.fn(async () => usbDevice)
    usb.getDevices = vi.fn(async () => [usbDevice])
    const registry = new UsbDeviceRegistry(usb)
    let resolveInitialization: (() => void) | undefined
    const initialization = new Promise<undefined>((resolve) => {
      resolveInitialization = () => resolve(undefined)
    })
    let createdSession: FakeSession | undefined
    const manager = new SourceSessionManager(registry, {
      createSession: (selection) => {
        createdSession = new FakeSession(selection)
        createdSession.initialize.mockReturnValue(initialization)
        return createdSession as never
      },
    })

    const adding = manager.addDevice()
    await vi.waitFor(() => expect(manager.snapshot.sessions).toHaveLength(1))
    await manager.removeSession(manager.snapshot.sessions[0].id)
    expect(createdSession?.stop).toHaveBeenCalledOnce()
    expect(createdSession?.dispose).toHaveBeenCalledOnce()
    expect(manager.snapshot.sessions).toEqual([])

    resolveInitialization?.()
    await adding
    expect(manager.snapshot.sessions).toEqual([])
  })
})