import { useEffect, useState } from 'react'
import './App.css'
import {
  AnalyzerController,
  type AnalyzerSnapshot,
} from './analyzer/AnalyzerController'
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
} from './sources/hackrfProtocol'
import { WaterfallRenderer } from './renderers/WaterfallRenderer'
import { WaveformRenderer } from './renderers/WaveformRenderer'
import {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_GENERATOR_CONFIG,
  type DetectionConfig,
  type GeneratorConfig,
} from './workers/protocol'

const DEFAULT_DETECTION_CONFIGS: Record<SourceMode, DetectionConfig> = {
  generator: DEFAULT_DETECTION_CONFIG,
  hackrf: {
    ...DEFAULT_DETECTION_CONFIG,
    minimumSnrDb: 25,
  },
}

function App() {
  const [controller] = useState(() => new AnalyzerController())
  const [sourceMode, setSourceMode] = useState<SourceMode>('generator')
  const [config, setConfig] = useState<GeneratorConfig>(DEFAULT_GENERATOR_CONFIG)
  const [hackRfConfig, setHackRfConfig] = useState<HackRfConfig>(DEFAULT_HACKRF_CONFIG)
  const [detectionConfigs, setDetectionConfigs] = useState<
    Record<SourceMode, DetectionConfig>
  >(
    DEFAULT_DETECTION_CONFIGS,
  )
  const [snapshot, setSnapshot] = useState<AnalyzerSnapshot>(controller.snapshot)
  const [ready, setReady] = useState(false)
  const [viewRevision, setViewRevision] = useState(0)
  const detectionConfig = detectionConfigs[sourceMode]

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
    controller.configure(
      sourceMode === 'generator'
        ? config
        : {
            ...config,
            sampleRateHz: hackRfConfig.sampleRateHz,
            centerFrequencyHz: hackRfConfig.centerFrequencyHz,
            fftSize: hackRfConfig.fftSize,
            frameRate: hackRfConfig.frameRate,
          },
    )
  }, [config, controller, hackRfConfig, ready, sourceMode])

  useEffect(() => {
    if (ready) controller.configureDetection(detectionConfig)
  }, [controller, detectionConfig, ready])

  const running = snapshot.state === 'running'
  const sourceBusy = snapshot.state === 'connecting' || running
  const activeConfig = sourceMode === 'generator' ? config : hackRfConfig
  const handleReset = async () => {
    await controller.reset()
    setSnapshot({ ...controller.snapshot })
    setViewRevision((revision) => revision + 1)
  }

  const handleSourceChange = (mode: SourceMode) => {
    void controller.stop()
    setSourceMode(mode)
  }

  const startHackRf = () => {
    controller.configure({
      ...config,
      sampleRateHz: hackRfConfig.sampleRateHz,
      centerFrequencyHz: hackRfConfig.centerFrequencyHz,
      fftSize: hackRfConfig.fftSize,
      frameRate: hackRfConfig.frameRate,
    })
    void controller.startExternal(new HackRFSource(hackRfConfig))
  }

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
              onChange={setHackRfConfig}
              onStart={startHackRf}
              onStop={() => void controller.stop()}
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
            onConfigChange={(nextConfig) =>
              setDetectionConfigs((current) => ({
                ...current,
                [sourceMode]: nextConfig,
              }))
            }
          />
        </section>
      </div>
    </main>
  )
}

export default App
