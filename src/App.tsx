import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import {
  AudioPlaybackController,
  type AudioPlaybackSnapshot,
} from './audio/AudioPlaybackController'
import {
  AnalyzerController,
  type AnalyzerSnapshot,
} from './analyzer/AnalyzerController'
import {
  SourceSessionManager,
  type SourceSessionManagerSnapshot,
} from './analyzer/SourceSessionManager'
import { AnalyzerCanvas } from './components/AnalyzerCanvas'
import { AnalyzerStatus } from './components/AnalyzerStatus'
import { DetectedSignalsPanel } from './components/DetectedSignalsPanel'
import { GeneratorControls } from './components/GeneratorControls'
import { HackRFControls } from './components/HackRFControls'
import { RtlSdrControls } from './components/RtlSdrControls'
import { SourceSessionsPanel } from './components/SourceSessionsPanel'
import { VfoMixerPanel } from './components/VfoMixerPanel'
import { signalDisplayFrequencyHz } from './detection/signalDisplay'
import { SpectrumRenderer } from './renderers/SpectrumRenderer'
import { WaterfallRenderer } from './renderers/WaterfallRenderer'
import { WaveformRenderer } from './renderers/WaveformRenderer'
import type { HackRfConfig } from './sources/hackrfProtocol'
import type { RtlSdrConfig, RtlSdrRuntimeCommand } from './sources/rtlSdrProtocol'
import type { SourceSessionId } from './sources/types'
import {
  UsbDeviceRegistry,
  type AuthorizedUsbDevice,
} from './sources/UsbDeviceRegistry'
import { webUsbFromNavigator } from './sources/webUsb'
import {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_GENERATOR_CONFIG,
  type DetectionConfig,
  type GeneratorConfig,
  type TrackedSignal,
} from './workers/protocol'
import { suggestVfoFromSignal } from './vfo/suggestVfoFromSignal'
import {
  createVfoState,
  isVfoInPassband,
  reduceVfoState,
} from './vfo/vfoState'
import { MAX_VFOS, type VfoMode } from './vfo/types'

const GENERATOR_SESSION_ID = 'generator'
const EMPTY_MANAGER_SNAPSHOT: SourceSessionManagerSnapshot = {
  selectedSessionId: null,
  sessions: [],
}

class EffectReplayGuard {
  #generation = 0

  begin(): number {
    this.#generation += 1
    return this.#generation
  }

  isCurrent(generation: number): boolean {
    return this.#generation === generation
  }
}

function App() {
  const [generatorController] = useState(() => new AnalyzerController())
  const [audioController] = useState(() => new AudioPlaybackController())
  const [sessionManager] = useState(() => {
    const usb = webUsbFromNavigator(navigator)
    return usb ? new SourceSessionManager(new UsbDeviceRegistry(usb)) : null
  })
  const [managerSnapshot, setManagerSnapshot] = useState(EMPTY_MANAGER_SNAPSHOT)
  const [generatorSnapshot, setGeneratorSnapshot] = useState<AnalyzerSnapshot>(
    generatorController.snapshot,
  )
  const [generatorReady, setGeneratorReady] = useState(false)
  const [audioSnapshot, setAudioSnapshot] = useState<AudioPlaybackSnapshot>(
    audioController.snapshot,
  )
  const [vfoState, dispatchVfo] = useReducer(reduceVfoState, createVfoState())
  const [masterGainDb, setMasterGainDb] = useState(-6)
  const [masterMuted, setMasterMuted] = useState(false)
  const [generatorConfig, setGeneratorConfig] = useState<GeneratorConfig>(
    DEFAULT_GENERATOR_CONFIG,
  )
  const [generatorDetectionConfig, setGeneratorDetectionConfig] = useState(
    DEFAULT_DETECTION_CONFIG,
  )
  const [addDeviceError, setAddDeviceError] = useState<string | null>(null)
  const [authorizedDevices, setAuthorizedDevices] = useState<AuthorizedUsbDevice[]>([])
  const [viewRevision, setViewRevision] = useState(0)
  const [managerLifecycle] = useState(() => new EffectReplayGuard())
  const attachedAudioSessions = useRef(new Set<SourceSessionId>())
  const discontinuityRevisions = useRef(new Map<SourceSessionId, number>())

  const selectedHardwareSnapshot = managerSnapshot.selectedSessionId === null
    ? undefined
    : managerSnapshot.sessions.find(
        (session) => session.id === managerSnapshot.selectedSessionId,
      )
  const selectedHardwareSession = selectedHardwareSnapshot
    ? sessionManager?.getSession(selectedHardwareSnapshot.id)
    : undefined
  const sourceSessionId = selectedHardwareSnapshot?.id ?? GENERATOR_SESSION_ID
  const snapshot = selectedHardwareSnapshot?.analyzer ?? generatorSnapshot
  const selectedController = selectedHardwareSession?.controller ?? generatorController
  const selectedFrames = selectedController.frames
  const activeConfig = selectedHardwareSnapshot?.config ?? generatorConfig
  const detectionConfig = selectedHardwareSnapshot?.detectionConfig ?? generatorDetectionConfig
  const sourceCenterFrequencyHz = activeConfig.centerFrequencyHz
  const running = snapshot.state === 'running'
  const sourceBusy = snapshot.state === 'connecting' || running
  const hardwareBusy = managerSnapshot.sessions.some(
    (session) => session.analyzer.state === 'connecting' || session.analyzer.state === 'running',
  )
  const generatorRunning = generatorSnapshot.state === 'running'
  const ready = selectedHardwareSnapshot
    ? selectedHardwareSnapshot.analyzer.state !== 'booting'
    : generatorReady

  const sourceWindows = useMemo(() => {
    const windows: Record<SourceSessionId, {
      label: string
      available: boolean
      running: boolean
      centerFrequencyHz: number
      sampleRateHz: number
    }> = {
      [GENERATOR_SESSION_ID]: {
        label: 'Generator',
        available: true,
        running: generatorRunning,
        centerFrequencyHz: generatorConfig.centerFrequencyHz,
        sampleRateHz: generatorConfig.sampleRateHz,
      },
    }
    for (const session of managerSnapshot.sessions) {
      windows[session.id] = {
        label: session.label,
        available: session.deviceConnected,
        running: session.analyzer.state === 'running',
        centerFrequencyHz: session.config.centerFrequencyHz,
        sampleRateHz: session.config.sampleRateHz,
      }
    }
    return windows
  }, [
    generatorConfig.centerFrequencyHz,
    generatorConfig.sampleRateHz,
    generatorRunning,
    managerSnapshot.sessions,
  ])

  useEffect(() => {
    let active = true
    const unsubscribe = generatorController.subscribeStatus((next) => {
      if (active) setGeneratorSnapshot({ ...next })
    })
    const metricsTimer = window.setInterval(() => {
      if (active) setGeneratorSnapshot({ ...generatorController.snapshot })
    }, 250)
    generatorController.initialize().then(
      () => {
        if (active) setGeneratorReady(true)
      },
      (error: unknown) => {
        if (!active) return
        setGeneratorSnapshot({
          ...generatorController.snapshot,
          state: 'error',
          detail: error instanceof Error ? error.message : String(error),
        })
      },
    )
    return () => {
      active = false
      window.clearInterval(metricsTimer)
      unsubscribe()
      generatorController.dispose()
    }
  }, [generatorController])

  useEffect(() => {
    if (!sessionManager) return
    const lifecycleGeneration = managerLifecycle.begin()
    let active = true
    const unsubscribe = sessionManager.subscribe((next) => {
      if (active) setManagerSnapshot({
        selectedSessionId: next.selectedSessionId,
        sessions: [...next.sessions],
      })
    })
    sessionManager.startSampling()
    return () => {
      active = false
      unsubscribe()
      sessionManager.stopSampling()
      queueMicrotask(() => {
        if (managerLifecycle.isCurrent(lifecycleGeneration)) {
          void sessionManager.dispose()
        }
      })
    }
  }, [managerLifecycle, sessionManager])

  useEffect(() => {
    const unsubscribe = audioController.subscribe((next) => {
      setAudioSnapshot({ ...next })
    })
    return () => {
      unsubscribe()
      void audioController.dispose()
    }
  }, [audioController])

  useEffect(() => {
    generatorController.configureVfos(
      vfoState.vfos.filter((vfo) => vfo.sourceSessionId === GENERATOR_SESSION_ID),
    )
    sessionManager?.configureVfos(vfoState.vfos)
    audioController.configureVfos(
      vfoState.vfos.map((vfo) => {
        const source = sourceWindows[vfo.sourceSessionId]
        return {
          id: vfo.id,
          sourceSessionId: vfo.sourceSessionId,
          revision: vfo.revision,
          gainDb: vfo.gainDb,
          muted: vfo.muted,
          solo: vfo.solo,
          active: Boolean(source?.running && isVfoInPassband(vfo, source)),
        }
      }),
    )
  }, [
    audioController,
    generatorController,
    sessionManager,
    sourceWindows,
    vfoState.vfos,
  ])

  useEffect(() => {
    audioController.configureMaster(masterGainDb, masterMuted)
  }, [audioController, masterGainDb, masterMuted])

  useEffect(() => {
    if (!generatorReady) return
    audioController.flush(GENERATOR_SESSION_ID)
    generatorController.configure(generatorConfig)
  }, [audioController, generatorConfig, generatorController, generatorReady])

  useEffect(() => {
    if (generatorReady) generatorController.configureDetection(generatorDetectionConfig)
  }, [generatorController, generatorDetectionConfig, generatorReady])

  useEffect(() => {
    const playing = audioSnapshot.state === 'running' && audioSnapshot.sampleRateHz !== null
    const desired = new Set<SourceSessionId>()
    if (playing) {
      if (
        generatorRunning &&
        vfoState.vfos.some((vfo) => vfo.sourceSessionId === GENERATOR_SESSION_ID)
      ) desired.add(GENERATOR_SESSION_ID)
      for (const session of managerSnapshot.sessions) {
        if (
          session.analyzer.state === 'running' &&
          vfoState.vfos.some((vfo) => vfo.sourceSessionId === session.id)
        ) desired.add(session.id)
      }
    }

    for (const id of desired) {
      if (attachedAudioSessions.current.has(id)) continue
      const controller = id === GENERATOR_SESSION_ID
        ? generatorController
        : sessionManager?.getSession(id)?.controller
      if (!controller || audioSnapshot.sampleRateHz === null) continue
      try {
        controller.startVfoAudio(
          audioSnapshot.sampleRateHz,
          (ownerId) => audioController.createProducerPort(ownerId),
        )
        attachedAudioSessions.current.add(id)
      } catch {
        audioController.detachProducerPort(id)
      }
    }
    for (const id of [...attachedAudioSessions.current]) {
      if (desired.has(id)) continue
      const controller = id === GENERATOR_SESSION_ID
        ? generatorController
        : sessionManager?.getSession(id)?.controller
      controller?.stopVfoAudio()
      audioController.flush(id)
      audioController.detachProducerPort(id)
      attachedAudioSessions.current.delete(id)
    }
  }, [
    audioController,
    audioSnapshot.sampleRateHz,
    audioSnapshot.state,
    generatorController,
    generatorRunning,
    managerSnapshot.sessions,
    sessionManager,
    vfoState.vfos,
  ])

  useEffect(() => {
    const liveIds = new Set<SourceSessionId>()
    for (const session of managerSnapshot.sessions) {
      liveIds.add(session.id)
      const previous = discontinuityRevisions.current.get(session.id)
      if (previous !== undefined && session.discontinuityRevision > previous) {
        audioController.flush(session.id)
      }
      discontinuityRevisions.current.set(session.id, session.discontinuityRevision)
    }
    for (const id of discontinuityRevisions.current.keys()) {
      if (!liveIds.has(id)) discontinuityRevisions.current.delete(id)
    }
  }, [audioController, managerSnapshot.sessions])

  const addDevice = async (authorizedDevice?: AuthorizedUsbDevice) => {
    setAuthorizedDevices([])
    try {
      await sessionManager!.addDevice(authorizedDevice)
      setViewRevision((revision) => revision + 1)
    } catch (error) {
      setAddDeviceError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleAddDevice = async () => {
    if (!sessionManager) {
      setAddDeviceError('WebUSB is unavailable. Use a secure-context desktop Chromium browser.')
      return
    }
    if (generatorRunning) {
      setAddDeviceError('Stop the generator before adding hardware.')
      return
    }
    setAddDeviceError(null)
    try {
      const available = await sessionManager.getAuthorizedDevices()
      if (available.length > 0) {
        setAuthorizedDevices(available)
        return
      }
      await addDevice()
    } catch (error) {
      setAddDeviceError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleRemoveSession = async (id: SourceSessionId) => {
    const session = sessionManager?.getSession(id)
    if (!session) return
    if (!window.confirm(`Remove ${session.snapshot.label} and its receivers?`)) return
    session.stopVfoAudio()
    audioController.flush(id)
    audioController.detachProducerPort(id)
    attachedAudioSessions.current.delete(id)
    await sessionManager!.removeSession(id)
    dispatchVfo({ type: 'remove-source', sourceSessionId: id })
    setViewRevision((revision) => revision + 1)
  }

  const handleSelectSession = (id: SourceSessionId | null) => {
    sessionManager?.selectSession(id)
    setAddDeviceError(null)
    setAuthorizedDevices([])
    setViewRevision((revision) => revision + 1)
  }

  const handleReset = async () => {
    if (selectedHardwareSession) {
      selectedHardwareSession.setAutoOptimizeEnabled(false)
      selectedHardwareSession.setAutoOptimizeTarget(null)
      audioController.flush(selectedHardwareSession.id)
      await selectedHardwareSession.reset()
    } else {
      audioController.flush(GENERATOR_SESSION_ID)
      await generatorController.reset()
      setGeneratorSnapshot({ ...generatorController.snapshot })
    }
    setViewRevision((revision) => revision + 1)
  }

  const handleHardwareToggle = async () => {
    if (!selectedHardwareSession || !sessionManager) return
    setAddDeviceError(null)
    if (sourceBusy) {
      selectedHardwareSession.stopVfoAudio()
      audioController.flush(selectedHardwareSession.id)
      audioController.detachProducerPort(selectedHardwareSession.id)
      attachedAudioSessions.current.delete(selectedHardwareSession.id)
      await sessionManager.stopSession(selectedHardwareSession.id)
      return
    }
    if (generatorRunning) {
      setAddDeviceError('Stop the generator before connecting hardware.')
      return
    }
    try {
      sessionManager.connectSession(selectedHardwareSession.id)
    } catch (error) {
      setAddDeviceError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleGeneratorToggle = () => {
    if (generatorRunning) {
      generatorController.stopVfoAudio()
      audioController.flush(GENERATOR_SESSION_ID)
      audioController.detachProducerPort(GENERATOR_SESSION_ID)
      attachedAudioSessions.current.delete(GENERATOR_SESSION_ID)
      void generatorController.stop()
      return
    }
    if (hardwareBusy) {
      setAddDeviceError('Stop all hardware sessions before starting the generator.')
      return
    }
    generatorController.startGenerated()
  }

  const handleDetectionConfigChange = (next: DetectionConfig) => {
    if (selectedHardwareSession) {
      if (!next.enabled) selectedHardwareSession.setAutoOptimizeEnabled(false)
      selectedHardwareSession.setDetectionConfig(next)
    } else {
      setGeneratorDetectionConfig(next)
    }
  }

  const handleRtlRuntimeCommand = (command: RtlSdrRuntimeCommand) => {
    if (!selectedHardwareSession || selectedHardwareSession.kind !== 'rtl-sdr') return
    void selectedHardwareSession.applyRtlSdrRuntimeCommand(command).catch(() => undefined)
  }

  const handleAudioToggle = async () => {
    if (audioSnapshot.state === 'running' || audioSnapshot.state === 'starting') {
      for (const id of attachedAudioSessions.current) {
        if (id === GENERATOR_SESSION_ID) generatorController.stopVfoAudio()
        else sessionManager?.getSession(id)?.stopVfoAudio()
      }
      attachedAudioSessions.current.clear()
      await audioController.suspend()
      return
    }
    await audioController.start().catch(() => undefined)
  }

  const defaultVfoMode: VfoMode = !selectedHardwareSession && generatorConfig.mode === 'fm-rds'
    ? 'wbfm'
    : !selectedHardwareSession && generatorConfig.mode === 'am'
      ? 'am'
      : 'nbfm'

  const addManualVfo = () => {
    if (vfoState.vfos.length >= MAX_VFOS) return
    dispatchVfo({
      type: 'add',
      input: {
        sourceSessionId,
        frequencyHz: Math.round(
          selectedHardwareSession
            ? sourceCenterFrequencyHz
            : sourceCenterFrequencyHz + generatorConfig.toneFrequencyHz,
        ),
        mode: defaultVfoMode,
      },
    })
  }

  const addVfoAtFrequency = (frequencyHz: number) => {
    if (vfoState.vfos.length >= MAX_VFOS || !Number.isFinite(frequencyHz)) return
    const rounded = Math.round(frequencyHz)
    if (rounded < 0 || rounded > 6_000_000_000) return
    dispatchVfo({
      type: 'add',
      input: { sourceSessionId, frequencyHz: rounded, mode: defaultVfoMode },
    })
  }

  const addSignalVfo = (signal: TrackedSignal) => {
    if (vfoState.vfos.length >= MAX_VFOS) return
    const suggestion = suggestVfoFromSignal(signal)
    if (!suggestion) return
    if (vfoState.vfos.some((vfo) =>
      vfo.sourceSessionId === sourceSessionId &&
      vfo.frequencyHz === suggestion.frequencyHz
    )) return
    dispatchVfo({ type: 'add', input: { sourceSessionId, ...suggestion } })
  }

  const selectedAutoOptimize = selectedHardwareSnapshot?.autoOptimize

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">BASEBAND SIGNAL LAB</p>
            <h1>rad.io</h1>
          </div>
        </div>
        <div className="topbar-context" aria-label="Analyzer configuration">
          <span>{selectedHardwareSnapshot?.label.toUpperCase() ?? 'GENERATED IQ'}</span>
          <strong>
            {activeConfig.centerFrequencyHz > 0
              ? `${(activeConfig.centerFrequencyHz / 1_000_000).toFixed(3)} MHz`
              : 'BASEBAND'}
          </strong>
          <span>{(activeConfig.sampleRateHz / 1_000_000).toFixed(2)} MS/s</span>
          <span>FFT {activeConfig.fftSize.toLocaleString()}</span>
        </div>
        <div className={`engine-status engine-status--${snapshot.state}`}>
          <span className="status-light" aria-hidden="true" />
          <div>
            <strong>
              {snapshot.state === 'running'
                ? 'Analyzing'
                : snapshot.state === 'connecting'
                  ? 'Connecting'
                  : snapshot.state === 'error'
                    ? 'DSP error'
                    : ready
                      ? 'DSP online'
                      : 'DSP bootstrap'}
            </strong>
            <span role="status">{snapshot.detail}</span>
          </div>
        </div>
      </header>

      <div className="analyzer-layout">
        <aside className="control-rail" aria-label="Signal source controls">
          <SourceSessionsPanel
            sessions={managerSnapshot.sessions}
            selectedSessionId={managerSnapshot.selectedSessionId}
            addDisabled={!sessionManager || managerSnapshot.sessions.length >= 2 || generatorRunning}
            addError={addDeviceError ?? (!sessionManager
              ? 'WebUSB is unavailable. Use a secure-context desktop Chromium browser.'
              : null)}
            authorizedDevices={authorizedDevices}
            onSelect={handleSelectSession}
            onAdd={() => void handleAddDevice()}
            onAddAuthorized={(device) => void addDevice(device)}
            onPairNew={() => void addDevice()}
            onRemove={(id) => void handleRemoveSession(id)}
          />
          {!selectedHardwareSnapshot ? (
            <GeneratorControls
              config={generatorConfig}
              ready={generatorReady && !hardwareBusy}
              running={generatorRunning}
              onChange={setGeneratorConfig}
              onToggle={handleGeneratorToggle}
              onReset={() => void handleReset()}
            />
          ) : selectedHardwareSnapshot.kind === 'hackrf' ? (
            <HackRFControls
              config={selectedHardwareSnapshot.config as HackRfConfig}
              ready={ready && !generatorRunning}
              state={snapshot.state}
              onChange={(next) => {
                try {
                  selectedHardwareSession?.setConfig(next)
                } catch (error) {
                  setAddDeviceError(error instanceof Error ? error.message : String(error))
                }
              }}
              onStart={() => void handleHardwareToggle()}
              onStop={() => void handleHardwareToggle()}
              onReset={() => void handleReset()}
              autoOptimizeEnabled={selectedAutoOptimize?.enabled}
              autoOptimizeDisabled={!detectionConfig.enabled}
              autoOptimizeStatus={selectedAutoOptimize?.status}
              autoOptimizeDetail={selectedAutoOptimize?.detail}
              autoOptimizeTargetFrequencyHz={selectedAutoOptimize?.targetFrequencyHz}
              onAutoOptimizeChange={(enabled) =>
                selectedHardwareSession?.setAutoOptimizeEnabled(enabled)
              }
            />
          ) : (
            <RtlSdrControls
              config={selectedHardwareSnapshot.config as RtlSdrConfig}
              ready={ready && !generatorRunning}
              state={snapshot.state}
              runtimePending={selectedHardwareSnapshot.runtimePending}
              runtimeError={selectedHardwareSnapshot.runtimeError}
              autoOptimizeEnabled={selectedAutoOptimize?.enabled}
              autoOptimizeDisabled={!detectionConfig.enabled}
              autoOptimizeStatus={selectedAutoOptimize?.status}
              autoOptimizeDetail={selectedAutoOptimize?.detail}
              autoOptimizeTargetFrequencyHz={selectedAutoOptimize?.targetFrequencyHz}
              onChange={(next) => {
                try {
                  selectedHardwareSession?.setConfig(next)
                } catch (error) {
                  setAddDeviceError(error instanceof Error ? error.message : String(error))
                }
              }}
              onRuntimeCommand={handleRtlRuntimeCommand}
              onAutoOptimizeChange={(enabled) =>
                selectedHardwareSession?.setAutoOptimizeEnabled(enabled)
              }
              onStart={() => void handleHardwareToggle()}
              onStop={() => void handleHardwareToggle()}
              onReset={() => void handleReset()}
            />
          )}
        </aside>

        <section className="plot-workspace" aria-labelledby="workspace-heading">
          <header className="workspace-header">
            <div>
              <p className="section-label">02 / ANALYZER</p>
              <h2 id="workspace-heading">Live baseband</h2>
            </div>
            <AnalyzerStatus snapshot={snapshot} />
          </header>

          <div className="plot-grid" key={`${sourceSessionId}-${viewRevision}`}>
            <AnalyzerCanvas
              frames={selectedFrames}
              title="Spectrum"
              eyebrow="POWER · dBFS"
              ariaLabel="FFT spectrum from negative to positive Nyquist frequency"
              className="spectrum-panel"
              renderer={SpectrumRenderer}
              onFrequencySelect={addVfoAtFrequency}
            />
            <AnalyzerCanvas
              frames={selectedFrames}
              title="Waterfall"
              eyebrow="FREQUENCY · HISTORY"
              ariaLabel="Scrolling frequency waterfall with newest samples at the top"
              className="waterfall-panel"
              renderer={WaterfallRenderer}
            />
            <AnalyzerCanvas
              frames={selectedFrames}
              title="I / Q waveform"
              eyebrow="AMPLITUDE · SAMPLES"
              ariaLabel="Time-domain in-phase and quadrature waveform"
              className="waveform-panel"
              renderer={WaveformRenderer}
            />
          </div>

          <VfoMixerPanel
            vfos={vfoState.vfos}
            sourceWindows={sourceWindows}
            audio={audioSnapshot}
            masterGainDb={masterGainDb}
            masterMuted={masterMuted}
            onAdd={addManualVfo}
            onUpdateDsp={(id, change) => dispatchVfo({ type: 'update-dsp', id, change })}
            onUpdateMixer={(id, change) => dispatchVfo({ type: 'update-mixer', id, change })}
            onRemove={(id) => dispatchVfo({ type: 'remove', id })}
            onTogglePlayback={() => void handleAudioToggle()}
            onMasterGainChange={setMasterGainDb}
            onMasterMutedChange={setMasterMuted}
          />

          <DetectedSignalsPanel
            config={detectionConfig}
            signals={snapshot.trackedSignals}
            centerFrequencyHz={snapshot.centerFrequencyHz}
            onConfigChange={handleDetectionConfigChange}
            optimizationTargetFrequencyHz={
              selectedAutoOptimize?.enabled
                ? selectedAutoOptimize.targetFrequencyHz
                : null
            }
            onSignalSelect={(signal) => {
              selectedHardwareSession?.setAutoOptimizeTarget(signalDisplayFrequencyHz(signal))
            }}
            onAddVfo={addSignalVfo}
            vfoFrequenciesHz={vfoState.vfos
              .filter((vfo) => vfo.sourceSessionId === sourceSessionId)
              .map((vfo) => vfo.frequencyHz)}
            vfoCapacityAvailable={vfoState.vfos.length < MAX_VFOS}
          />
        </section>
      </div>
    </main>
  )
}

export default App
