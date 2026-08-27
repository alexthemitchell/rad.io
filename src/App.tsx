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
import { SpectrumRenderer } from './renderers/SpectrumRenderer'
import { WaterfallRenderer } from './renderers/WaterfallRenderer'
import { WaveformRenderer } from './renderers/WaveformRenderer'
import {
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_GENERATOR_CONFIG,
  type DetectionConfig,
  type GeneratorConfig,
} from './workers/protocol'

function App() {
  const [controller] = useState(() => new AnalyzerController())
  const [config, setConfig] = useState<GeneratorConfig>(DEFAULT_GENERATOR_CONFIG)
  const [detectionConfig, setDetectionConfig] = useState<DetectionConfig>(
    DEFAULT_DETECTION_CONFIG,
  )
  const [snapshot, setSnapshot] = useState<AnalyzerSnapshot>(controller.snapshot)
  const [ready, setReady] = useState(false)
  const [viewRevision, setViewRevision] = useState(0)

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
    if (ready) controller.configure(config)
  }, [config, controller, ready])

  useEffect(() => {
    if (ready) controller.configureDetection(detectionConfig)
  }, [controller, detectionConfig, ready])

  const running = snapshot.state === 'running'
  const handleReset = () => {
    controller.reset()
    setSnapshot({ ...controller.snapshot })
    setViewRevision((revision) => revision + 1)
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
          <span>GENERATED IQ</span>
          <strong>
            {config.centerFrequencyHz > 0
              ? `${(config.centerFrequencyHz / 1_000_000).toFixed(3)} MHz`
              : 'BASEBAND'}
          </strong>
          <span>{(config.sampleRateHz / 1_000_000).toFixed(2)} MS/s</span>
          <span>FFT {config.fftSize.toLocaleString()}</span>
        </div>
        <div className={`engine-status engine-status--${snapshot.state}`}>
          <span className="status-light" aria-hidden="true" />
          <div>
            <strong>
              {snapshot.state === 'running'
                ? 'Analyzing'
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
        <GeneratorControls
          config={config}
          ready={ready}
          running={running}
          onChange={setConfig}
          onToggle={() => (running ? controller.stop() : controller.start())}
          onReset={handleReset}
        />

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
            onConfigChange={setDetectionConfig}
          />
        </section>
      </div>
    </main>
  )
}

export default App
