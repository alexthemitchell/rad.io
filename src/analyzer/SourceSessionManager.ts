import { SourceSession, type SourceSessionSnapshot } from './SourceSession'
import type { SourceSessionId } from '../sources/types'
import type {
  AuthorizedUsbDevice,
  UsbDeviceSelection,
} from '../sources/UsbDeviceRegistry'
import { UsbDeviceRegistry } from '../sources/UsbDeviceRegistry'
import type { VfoConfig } from '../vfo/types'

export type SourceSessionManagerSnapshot = {
  selectedSessionId: SourceSessionId | null
  sessions: SourceSessionSnapshot[]
}

type SourceSessionManagerDependencies = {
  createSession?: (selection: UsbDeviceSelection) => SourceSession
  setInterval?: (handler: () => void, timeoutMs: number) => number
  clearInterval?: (timer: number) => void
}

export class SourceSessionManager {
  readonly #registry: UsbDeviceRegistry
  readonly #dependencies: SourceSessionManagerDependencies
  readonly #sessions = new Map<SourceSessionId, SourceSession>()
  readonly #sessionUnsubscribers = new Map<SourceSessionId, () => void>()
  readonly #listeners = new Set<(snapshot: SourceSessionManagerSnapshot) => void>()
  readonly #unsubscribeRegistry: () => void
  #selectedSessionId: SourceSessionId | null = null
  #samplingTimer: number | undefined

  constructor(
    registry: UsbDeviceRegistry,
    dependencies: SourceSessionManagerDependencies = {},
  ) {
    this.#registry = registry
    this.#dependencies = dependencies
    this.#unsubscribeRegistry = registry.subscribe((selections) => {
      for (const selection of selections) this.#sessions.get(selection.id)?.updateSelection(selection)
      this.#emit()
    })
  }

  get snapshot(): SourceSessionManagerSnapshot {
    return {
      selectedSessionId: this.#selectedSessionId,
      sessions: [...this.#sessions.values()].map((session) => session.snapshot),
    }
  }

  getSession(id: SourceSessionId): SourceSession | undefined {
    return this.#sessions.get(id)
  }

  get selectedSession(): SourceSession | undefined {
    return this.#selectedSessionId === null
      ? undefined
      : this.#sessions.get(this.#selectedSessionId)
  }

  getAuthorizedDevices(): Promise<AuthorizedUsbDevice[]> {
    return this.#registry.getAuthorizedDevices()
  }

  async addDevice(authorizedDevice?: AuthorizedUsbDevice): Promise<SourceSession> {
    const selection = await this.#registry.addDevice(authorizedDevice)
    const session = this.#dependencies.createSession?.(selection) ?? new SourceSession(selection)
    this.#sessions.set(selection.id, session)
    this.#selectedSessionId = selection.id
    this.#sessionUnsubscribers.set(selection.id, session.subscribe(() => this.#emit()))
    try {
      await session.initialize()
      this.#emit()
      return session
    } catch (error) {
      this.#sessionUnsubscribers.get(selection.id)?.()
      this.#sessionUnsubscribers.delete(selection.id)
      this.#sessions.delete(selection.id)
      this.#registry.remove(selection.id)
      session.dispose()
      this.#selectedSessionId = this.#sessions.keys().next().value ?? null
      this.#emit()
      throw error
    }
  }

  selectSession(id: SourceSessionId | null): void {
    if (id !== null && !this.#sessions.has(id)) throw new Error(`Unknown source session ${id}.`)
    if (id === this.#selectedSessionId) return
    this.#selectedSessionId = id
    this.#emit()
  }

  connectSession(id: SourceSessionId): void {
    this.#requireSession(id).connect()
  }

  async stopSession(id: SourceSessionId): Promise<void> {
    await this.#requireSession(id).stop()
    this.#emit()
  }

  async resetSession(id: SourceSessionId): Promise<void> {
    await this.#requireSession(id).reset()
    this.#emit()
  }

  configureVfos(vfos: readonly VfoConfig[]): void {
    for (const session of this.#sessions.values()) session.configureVfos(vfos)
  }

  async removeSession(id: SourceSessionId): Promise<void> {
    const session = this.#requireSession(id)
    await session.stop()
    this.#sessionUnsubscribers.get(id)?.()
    this.#sessionUnsubscribers.delete(id)
    this.#sessions.delete(id)
    this.#registry.remove(id)
    session.dispose()
    if (this.#selectedSessionId === id) {
      this.#selectedSessionId = this.#sessions.keys().next().value ?? null
    }
    this.#emit()
  }

  startSampling(): void {
    if (this.#samplingTimer !== undefined) return
    const setTimer = this.#dependencies.setInterval ?? window.setInterval.bind(window)
    this.#samplingTimer = setTimer(() => {
      const nowMs = performance.now()
      for (const session of this.#sessions.values()) session.tickAutoOptimize(nowMs)
      this.#emit()
    }, 250)
  }

  stopSampling(): void {
    if (this.#samplingTimer === undefined) return
    const clearTimer = this.#dependencies.clearInterval ?? window.clearInterval.bind(window)
    clearTimer(this.#samplingTimer)
    this.#samplingTimer = undefined
  }

  subscribe(listener: (snapshot: SourceSessionManagerSnapshot) => void): () => void {
    this.#listeners.add(listener)
    listener(this.snapshot)
    return () => this.#listeners.delete(listener)
  }

  async dispose(): Promise<void> {
    this.stopSampling()
    this.#unsubscribeRegistry()
    await Promise.all([...this.#sessions.values()].map((session) => session.stop()))
    for (const unsubscribe of this.#sessionUnsubscribers.values()) unsubscribe()
    this.#sessionUnsubscribers.clear()
    for (const session of this.#sessions.values()) session.dispose()
    this.#sessions.clear()
    this.#listeners.clear()
    this.#registry.dispose()
    this.#selectedSessionId = null
  }

  #requireSession(id: SourceSessionId): SourceSession {
    const session = this.#sessions.get(id)
    if (!session) throw new Error(`Unknown source session ${id}.`)
    return session
  }

  #emit(): void {
    const snapshot = this.snapshot
    for (const listener of this.#listeners) listener(snapshot)
  }
}