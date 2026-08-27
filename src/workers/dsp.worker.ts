/// <reference lib="webworker" />

import initWasm, { DspEngine } from '../../crates/dsp-wasm/pkg/dsp_wasm.js'
import {
  DEFAULT_GENERATOR_CONFIG,
  PROTOCOL_VERSION,
  type AnalysisFrameEvent,
  type GeneratorConfig,
  type SampleMetadata,
  type WorkerErrorEvent,
  type WorkerReadyEvent,
  type WorkerRequest,
} from './protocol'

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope
let engine: DspEngine | undefined
let config: GeneratorConfig = DEFAULT_GENERATOR_CONFIG
let running = false
let scheduledFrame: number | undefined
let awaitingSequence: number | undefined

function postError(
  code: WorkerErrorEvent['code'],
  error: unknown,
  recoverable: boolean,
): void {
  workerScope.postMessage({
    type: 'error',
    protocolVersion: PROTOCOL_VERSION,
    code,
    message: error instanceof Error ? error.message : String(error),
    recoverable,
  } satisfies WorkerErrorEvent)
}

function postStatus(): void {
  workerScope.postMessage({
    type: 'status',
    protocolVersion: PROTOCOL_VERSION,
    state: running ? 'running' : 'idle',
  })
}

function cancelScheduledFrame(): void {
  if (scheduledFrame !== undefined) {
    workerScope.clearTimeout(scheduledFrame)
    scheduledFrame = undefined
  }
}

function scheduleGeneratedFrame(delayMs = 1000 / config.frameRate): void {
  cancelScheduledFrame()
  if (!running || awaitingSequence !== undefined) return

  scheduledFrame = workerScope.setTimeout(produceGeneratedFrame, delayMs)
}

function emitFrame(
  frame: ReturnType<DspEngine['generate_and_analyze']>,
  startedAt: number,
  sourceMetadata?: SampleMetadata,
): void {
  const waveform = frame.waveform
  const spectrumDb = frame.spectrum_db
  const sampleRateHz = frame.sample_rate_hz
  const elapsedSamples = frame.elapsed_samples
  const metadata = sourceMetadata ?? {
    sampleRateHz,
    centerFrequencyHz: frame.center_frequency_hz,
    sourceSequence: frame.sequence,
    timestampUs:
      (elapsedSamples * 1_000_000n) / BigInt(Math.round(sampleRateHz)),
    formatVersion: 1,
  }
  const message: AnalysisFrameEvent = {
    type: 'analysis-frame',
    protocolVersion: PROTOCOL_VERSION,
    sequence: frame.sequence,
    waveform,
    spectrumDb,
    sampleRateHz,
    centerFrequencyHz: frame.center_frequency_hz,
    peakFrequencyHz: frame.peak_frequency_hz,
    peakPowerDbfs: frame.peak_power_dbfs,
    elapsedSamples,
    processingTimeMs: performance.now() - startedAt,
    sourceSequence: metadata.sourceSequence,
    timestampUs: metadata.timestampUs,
    formatVersion: metadata.formatVersion,
  }
  frame.free()
  awaitingSequence = message.sequence
  workerScope.postMessage(message, [waveform.buffer, spectrumDb.buffer])
}

function produceGeneratedFrame(): void {
  scheduledFrame = undefined
  if (!running || awaitingSequence !== undefined || !engine) return

  try {
    const startedAt = performance.now()
    emitFrame(engine.generate_and_analyze(), startedAt)
  } catch (error) {
    running = false
    postStatus()
    postError('PROCESSING_FAILED', error, true)
  }
}

function requireEngine(): DspEngine | undefined {
  if (!engine) postError('NOT_READY', 'DSP engine is not initialized.', true)
  return engine
}

async function initialize(): Promise<void> {
  try {
    await initWasm()
    engine ??= new DspEngine()

    const ready: WorkerReadyEvent = {
      type: 'ready',
      protocolVersion: PROTOCOL_VERSION,
      engineSequence: engine.sequence,
    }
    workerScope.postMessage(ready)
    postStatus()
  } catch (error) {
    postError('INIT_FAILED', error, true)
  }
}

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.protocolVersion !== PROTOCOL_VERSION) {
    postError(
      'PROTOCOL_MISMATCH',
      `Expected protocol ${PROTOCOL_VERSION}.`,
      false,
    )
    return
  }

  if (request.type === 'init') {
    void initialize()
    return
  }

  const activeEngine = requireEngine()
  if (!activeEngine) return

  try {
    switch (request.type) {
      case 'configure':
        if (
          !Number.isFinite(request.config.frameRate) ||
          request.config.frameRate < 1 ||
          request.config.frameRate > 60
        ) {
          throw new Error('Frame rate must be between 1 and 60 frames per second.')
        }
        activeEngine.configure(
          request.config.sampleRateHz,
          request.config.toneFrequencyHz,
          request.config.toneLevelDbfs,
          request.config.noiseEnabled,
          request.config.noiseLevelDbfs,
          request.config.fftSize,
          BigInt(request.config.seed),
        )
        config = request.config
        workerScope.postMessage({
          type: 'configured',
          protocolVersion: PROTOCOL_VERSION,
          requestId: request.requestId,
          config,
        })
        postStatus()
        scheduleGeneratedFrame(0)
        break
      case 'start-generated':
        running = true
        postStatus()
        scheduleGeneratedFrame(0)
        break
      case 'stop':
        running = false
        cancelScheduledFrame()
        postStatus()
        break
      case 'reset':
        activeEngine.reset()
        break
      case 'frame-consumed':
        if (request.sequence === awaitingSequence) {
          awaitingSequence = undefined
          scheduleGeneratedFrame()
        }
        break
      case 'process-samples': {
        const inputBuffer = request.iq.buffer as ArrayBuffer
        if (running || awaitingSequence !== undefined) {
          workerScope.postMessage(
            {
              type: 'input-released',
              protocolVersion: PROTOCOL_VERSION,
              requestId: request.requestId,
              buffer: inputBuffer,
              dropped: true,
            },
            [inputBuffer],
          )
          break
        }

        const startedAt = performance.now()
        let frame: ReturnType<DspEngine['analyze_external']>
        try {
          if (request.metadata.formatVersion !== 1) {
            throw new Error(
              `Unsupported IQ format version ${request.metadata.formatVersion}.`,
            )
          }
          frame = activeEngine.analyze_external(
            request.iq,
            request.metadata.sampleRateHz,
            request.metadata.centerFrequencyHz,
          )
        } catch (error) {
          workerScope.postMessage(
            {
              type: 'input-released',
              protocolVersion: PROTOCOL_VERSION,
              requestId: request.requestId,
              buffer: inputBuffer,
              dropped: true,
            },
            [inputBuffer],
          )
          postError('PROCESSING_FAILED', error, true)
          break
        }
        workerScope.postMessage(
          {
            type: 'input-released',
            protocolVersion: PROTOCOL_VERSION,
            requestId: request.requestId,
            buffer: inputBuffer,
            dropped: false,
          },
          [inputBuffer],
        )
        emitFrame(frame, startedAt, request.metadata)
        break
      }
    }
  } catch (error) {
    postError('PROCESSING_FAILED', error, true)
  }
}

export {}