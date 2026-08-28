import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  AnalyzerController,
  type AnalyzerSnapshot,
} from './analyzer/AnalyzerController'
import { useHackRfAutoOptimize } from './analyzer/useHackRfAutoOptimize'
import { AnalyzerCanvas } from './components/AnalyzerCanvas'
import { AnalyzerStatus } from './components/AnalyzerStatus'
import { DetectedSignalsPanel } from './components/DetectedSignalsPanel'
import { GeneratorControls } from './components/GeneratorControls'
import { HackRFControls } from './components/HackRFControls'
import { SourceControls, type SourceMode } from './components/SourceControls'
import { SpectrumRenderer } from './renderers/SpectrumRenderer'
import { HackRFSource } from './sources/HackRFSource'
import {
  DEFAULT_HACKRF_CONFIG,
  type HackRfConfig,
  type HackRfRuntimeCommand,
} from './sources/hackrfProtocol'
import { WaterfallRenderer } from './renderers/WaterfallRenderer'
import { WaveformRenderer } from './renderers/WaveformRenderer'
import {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_GENERATOR_CONFIG,
  type DetectionConfig,
  type GeneratorConfig,
  type TrackedSignal,
} from './workers/protocol'

function analyzerConfigForHackRf(
  generatorConfig: GeneratorConfig,
  hackRfConfig: Pick<
    HackRfConfig,
    'sampleRateHz' | 'centerFrequencyHz' | 'fftSize' | 'frameRate'
  >,
): GeneratorConfig {
  return {
    ...generatorConfig,
    sampleRateHz: hackRfConfig.sampleRateHz,
    centerFrequencyHz: hackRfConfig.centerFrequencyHz,
    fftSize: hackRfConfig.fftSize,
    frameRate: hackRfConfig.frameRate,
  }
}

function signalTargetFrequencyHz(signal: TrackedSignal): number | null {
  return signal.classification.primary.channelCenterHz ?? signal.absoluteFrequencyHz
}

const DEFAULT_DETECTION_CONFIGS: Record<SourceMode, DetectionConfig> = {
  generator: DEFAULT_DETECTION_CONFIG,
  hackrf: { ...DEFAULT_DETECTION_CONFIG, minimumSnrDb: 25 },
}

function App() {
  const [controller] = useState(() => new AnalyzerController())
  const [sourceMode, setSourceMode] = useState<SourceMode>('generator')
  const [config, setConfig] = useState<GeneratorConfig>(DEFAULT_GENERATOR_CONFIG)
  const [hackRfConfig, setHackRfConfig] = useState<HackRfConfig>(DEFAULT_HACKRF_CONFIG)
  const [detectionConfigs, setDetectionConfigs] = useState(DEFAULT_DETECTION_CONFIGS)
  const detectionConfig = detectionConfigs[sourceMode]
  const [snapshot, setSnapshot] = useState<AnalyzerSnapshot>(controller.snapshot)
  const [ready, setReady] = useState(false)
  const [viewRevision, setViewRevision] = useState(0)
  const [activeHackRfSource, setActiveHackRfSource] = useState<HackRFSource | null>(null)
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(false)
  const [autoOptimizeError, setAutoOptimizeError] = useState<string | null>(null)
  const [selectedTargetFrequencyHz, setSelectedTargetFrequencyHz] = useState<number | null>(
    null,
  )
  const skipConfiguredHackRfCenterHz = useRef<number | null>(null)
  const running = snapshot.state === 'running'
  const sourceBusy = snapshot.state === 'connecting' || running
  const hackRfSampleRateHz = hackRfConfig.sampleRateHz
  const hackRfCenterFrequencyHz = hackRfConfig.centerFrequencyHz
  const hackRfFftSize = hackRfConfig.fftSize
  const hackRfFrameRate = hackRfConfig.frameRate

  useEffect(() => {
    let active = true
    const unsubscribe = controller.subscribeStatus((next) => {
      if (active) setSnapshot({ ...next })
    })
    const metricsTimer = window.setInterval(() => {
      if (active) setSnapshot({ ...controller.snapshot })
    }, 250)
    controller.initialize().then(
      () => {
        if (active) setReady(true)
      },
      (error: unknown) => {
        if (active) {
          setSnapshot({
            ...controller.snapshot,
            state: 'error',
            detail: error instanceof Error ? error.message : String(error),
          })
        }
      },
    )

    return () => {
      active = false
      window.clearInterval(metricsTimer)
      unsubscribe()
      controller.dispose()
    }
  }, [controller])

  useEffect(() => {
    if (!ready) return
    if (
      sourceMode === 'hackrf' &&
      skipConfiguredHackRfCenterHz.current === hackRfCenterFrequencyHz
    ) {
      skipConfiguredHackRfCenterHz.current = null
      return
    }
    controller.configure(
      sourceMode === 'generator'
        ? config
        : analyzerConfigForHackRf(config, {
            sampleRateHz: hackRfSampleRateHz,
            centerFrequencyHz: hackRfCenterFrequencyHz,
            fftSize: hackRfFftSize,
            frameRate: hackRfFrameRate,
          }),
    )
  }, [
    config,
    controller,
    hackRfCenterFrequencyHz,
    hackRfFftSize,
    hackRfFrameRate,
    hackRfSampleRateHz,
    ready,
    sourceMode,
  ])

  useEffect(() => {
    if (ready) controller.configureDetection(detectionConfig)
  }, [controller, detectionConfig, ready])

  const autoOptimize = useHackRfAutoOptimize({
    enabled:
      autoOptimizeEnabled && sourceMode === 'hackrf' && detectionConfig.enabled,
    running,
    source: activeHackRfSource,
    config: hackRfConfig,
    signals: snapshot.trackedSignals,
    selectedTargetFrequencyHz,
    peakPowerDbfs: snapshot.peakPowerDbfs,
    onApplied: (appliedConfig: HackRfConfig, command: HackRfRuntimeCommand) => {
      setHackRfConfig(appliedConfig)
      if (command.type === 'set-center-frequency') {
        skipConfiguredHackRfCenterHz.current = appliedConfig.centerFrequencyHz
        controller.configure(analyzerConfigForHackRf(config, appliedConfig))
      }
    },
    onFailure: (message: string) => {
      setAutoOptimizeError(message)
      setAutoOptimizeEnabled(false)
    },
  })

  const activeConfig = sourceMode === 'generator' ? config : hackRfConfig
  const handleReset = async () => {
    setAutoOptimizeEnabled(false)
    setAutoOptimizeError(null)
    setSelectedTargetFrequencyHz(null)
    await controller.reset()
    setSnapshot({ ...controller.snapshot })
    setViewRevision((revision) => revision + 1)
  }

  const handleSourceChange = (mode: SourceMode) => {
    setAutoOptimizeEnabled(false)
    setAutoOptimizeError(null)
    setSelectedTargetFrequencyHz(null)
    void controller.stop()
    setActiveHackRfSource(null)
    setSourceMode(mode)
  }

  const startHackRf = () => {
    setAutoOptimizeError(null)
    setSelectedTargetFrequencyHz(null)
    controller.configure(analyzerConfigForHackRf(config, hackRfConfig))
    const source = new HackRFSource(hackRfConfig)
    setActiveHackRfSource(source)
    void controller.startExternal(source).finally(() => {
      setActiveHackRfSource((active) => active === source ? null : active)
    })
  }

  const stopHackRf = () => {
    setAutoOptimizeEnabled(false)
    setAutoOptimizeError(null)
    setSelectedTargetFrequencyHz(null)
    void controller.stop().finally(() => setActiveHackRfSource(null))
  }

  const handleHackRfConfigChange = (next: HackRfConfig) => {
    if (
      next.centerFrequencyHz !== hackRfConfig.centerFrequencyHz ||
      next.lnaGainDb !== hackRfConfig.lnaGainDb ||
      next.vgaGainDb !== hackRfConfig.vgaGainDb
    ) {
      setAutoOptimizeEnabled(false)
      setAutoOptimizeError(null)
    }
    setHackRfConfig(next)
  }

  const handleDetectionConfigChange = (next: DetectionConfig) => {
    if (!next.enabled) {
      setAutoOptimizeEnabled(false)
      setAutoOptimizeError(null)
    }
    setDetectionConfigs((current) => ({ ...current, [sourceMode]: next }))
  }

  const displayedAutoOptimizeStatus = autoOptimizeError
    ? 'error'
    : autoOptimizeEnabled
      ? autoOptimize.status
      : 'off'
  const displayedAutoOptimizeDetail = autoOptimizeError ??
    (autoOptimizeEnabled ? autoOptimize.detail : 'Manual control.')

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
          <span>{sourceMode === 'generator' ? 'GENERATED IQ' : 'HACKRF ONE'}</span>
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
          <SourceControls
            mode={sourceMode}
            disabled={sourceBusy}
            onChange={handleSourceChange}
          />
          {sourceMode === 'generator' ? (
            <GeneratorControls
              config={config}
              ready={ready}
              running={running}
              onChange={setConfig}
              onToggle={() =>
                running ? void controller.stop() : controller.startGenerated()
              }
              onReset={() => void handleReset()}
            />
          ) : (
            <HackRFControls
              config={hackRfConfig}
              ready={ready}
              state={snapshot.state}
              onChange={handleHackRfConfigChange}
              onStart={startHackRf}
              onStop={stopHackRf}
              onReset={() => void handleReset()}
              autoOptimizeEnabled={autoOptimizeEnabled}
              autoOptimizeDisabled={!detectionConfig.enabled}
              autoOptimizeStatus={displayedAutoOptimizeStatus}
              autoOptimizeDetail={displayedAutoOptimizeDetail}
              autoOptimizeTargetFrequencyHz={autoOptimize.targetFrequencyHz}
              onAutoOptimizeChange={(enabled) => {
                setAutoOptimizeError(null)
                setAutoOptimizeEnabled(enabled)
              }}
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

          <div className="plot-grid" key={viewRevision}>
            <AnalyzerCanvas
              frames={controller.frames}
              title="Spectrum"
              eyebrow="POWER · dBFS"
              ariaLabel="FFT spectrum from negative to positive Nyquist frequency"
              className="spectrum-panel"
              renderer={SpectrumRenderer}
            />
            <AnalyzerCanvas
              frames={controller.frames}
              title="Waterfall"
              eyebrow="FREQUENCY · HISTORY"
              ariaLabel="Scrolling frequency waterfall with newest samples at the top"
              className="waterfall-panel"
              renderer={WaterfallRenderer}
            />
            <AnalyzerCanvas
              frames={controller.frames}
              title="I / Q waveform"
              eyebrow="AMPLITUDE · SAMPLES"
              ariaLabel="Time-domain in-phase and quadrature waveform"
              className="waveform-panel"
              renderer={WaveformRenderer}
            />
          </div>

          <DetectedSignalsPanel
            config={detectionConfig}
            signals={snapshot.trackedSignals}
            centerFrequencyHz={snapshot.centerFrequencyHz}
            onConfigChange={handleDetectionConfigChange}
            optimizationTargetFrequencyHz={
              autoOptimizeEnabled ? autoOptimize.targetFrequencyHz : null
            }
            onSignalSelect={(signal) => {
              setSelectedTargetFrequencyHz(signalTargetFrequencyHz(signal))
            }}
          />
        </section>
      </div>
    </main>
  )
}

export default App
