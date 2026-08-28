/// <reference lib="webworker" />

import { HackRfDeviceSession } from './HackRfDeviceSession'
import { RdsWasmDecoder } from '../rds/RdsWasmDecoder'
import { VfoWasmProcessor } from '../vfo/VfoWasmProcessor'
import type { VfoAudioPortMessage, VfoDspConfig } from '../vfo/types'
import type {
  HackRfDeviceIdentity,
  HackRfWorkerEvent,
  HackRfWorkerRequest,
} from './hackrfWorkerProtocol'
import type { RdsDecodeTarget } from '../workers/protocol'
import { webUsbFromNavigator } from './webUsb'

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope
let session: HackRfDeviceSession | undefined
let stopping = false
let starting = false
let processingOnly = false
let rdsDecoder: RdsWasmDecoder | undefined
let rdsTargets: RdsDecodeTarget[] = []
let lastRdsEmissionUs: bigint | undefined
let vfoProcessor: VfoWasmProcessor | undefined
let vfoAudioPort: MessagePort | undefined
let vfos: VfoDspConfig[] = []
let vfoOutputSampleRateHz = 48_000
let activeConfig: Extract<HackRfWorkerRequest, { type: 'start' }>['config'] | undefined

function postEvent(event: HackRfWorkerEvent, transfer: Transferable[] = []): void {
  workerScope.postMessage(event, transfer)
}

function postVfoAudio(iq: Int8Array, timestampUs: bigint): void {
  const blocks = vfoProcessor?.processI8(iq, timestampUs) ?? []
  if (blocks.length === 0 || !vfoAudioPort) return
  vfoAudioPort.postMessage(
    { type: 'vfo-audio', blocks } satisfies VfoAudioPortMessage,
    blocks.map((block) => block.samples.buffer as ArrayBuffer),
  )
}

function processIq(iq: Int8Array, timestampUs: bigint): void {
  postVfoAudio(iq, timestampUs)
  const receptions = rdsDecoder?.process(iq, timestampUs)
  if (
    receptions &&
    (lastRdsEmissionUs === undefined || timestampUs - lastRdsEmissionUs >= 250_000n)
  ) {
    lastRdsEmissionUs = timestampUs
    postEvent({ type: 'rds-update', receptions })
  }
}

function disposeProcessing(): void {
  rdsDecoder?.dispose()
  rdsDecoder = undefined
  vfoProcessor?.dispose()
  vfoProcessor = undefined
  vfoAudioPort?.close()
  vfoAudioPort = undefined
  activeConfig = undefined
  lastRdsEmissionUs = undefined
}

function configureVfos(): void {
  if (!vfoProcessor || !activeConfig) return
  vfoProcessor.configure(
    activeConfig.sampleRateHz,
    activeConfig.centerFrequencyHz,
    vfoOutputSampleRateHz,
    vfos,
  )
}

function matchesIdentity(
  device: { vendorId: number; productId: number; serialNumber?: string | null },
  identity: HackRfDeviceIdentity,
): boolean {
  return (
    device.vendorId === identity.vendorId &&
    device.productId === identity.productId &&
    (identity.serialNumber === null || device.serialNumber === identity.serialNumber)
  )
}

async function start(request: Extract<HackRfWorkerRequest, { type: 'start' }>): Promise<void> {
  if (starting || session || processingOnly) {
    postEvent({ type: 'error', code: 'DEVICE_FAILURE', message: 'HackRF worker is already active.' })
    return
  }
  starting = true
  stopping = false
  try {
    const usb = webUsbFromNavigator(navigator)
    if (!usb) {
      postEvent({
        type: 'error',
        code: 'WEBUSB_UNAVAILABLE',
        message: 'WebUSB is unavailable in the acquisition worker.',
      })
      return
    }
    const devices = await usb.getDevices()
    const device = devices.find((candidate) => matchesIdentity(candidate, request.identity))
    if (!device) {
      postEvent({
        type: 'error',
        code: 'DEVICE_NOT_FOUND',
        message: 'The newly authorized HackRF is not visible in this acquisition worker.',
      })
      return
    }
    if (stopping) return

    activeConfig = { ...request.config }
    rdsDecoder = await RdsWasmDecoder.create(request.config.sampleRateHz)
    vfoProcessor = await VfoWasmProcessor.create()
    if (stopping) return
    rdsDecoder.setTargets(rdsTargets)
    configureVfos()

    session = new HackRfDeviceSession(device, request.config, {
      onConfigured: (info) => postEvent({ type: 'configured', info }),
      onRawSamples: ({ iq, timestampUs }) => processIq(iq, timestampUs),
      onDiscontinuity: () => {
        rdsDecoder?.reset()
        vfoProcessor?.reset()
      },
      onSamples: ({ iq, sampleRateHz, centerFrequencyHz, sourceSequence, timestampUs }) => {
        postEvent(
          {
            type: 'samples',
            iq,
            sampleRateHz,
            centerFrequencyHz,
            sourceSequence,
            timestampUs,
          },
          [iq.buffer as ArrayBuffer],
        )
      },
    })
    await session.start()
  } catch (error) {
    if (!stopping) {
      postEvent({
        type: 'error',
        code: 'DEVICE_FAILURE',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } finally {
    starting = false
    session = undefined
    disposeProcessing()
    postEvent({ type: 'stopped' })
  }
}

async function startProcessing(
  request: Extract<HackRfWorkerRequest, { type: 'start-processing' }>,
): Promise<void> {
  if (starting || session || processingOnly) {
    postEvent({ type: 'error', code: 'DEVICE_FAILURE', message: 'HackRF worker is already active.' })
    return
  }
  starting = true
  stopping = false
  try {
    activeConfig = { ...request.config }
    rdsDecoder = await RdsWasmDecoder.create(request.config.sampleRateHz)
    vfoProcessor = await VfoWasmProcessor.create()
    if (stopping) return
    rdsDecoder.setTargets(rdsTargets)
    configureVfos()
    processingOnly = true
    postEvent({ type: 'processing-ready' })
  } catch (error) {
    disposeProcessing()
    postEvent({
      type: 'error',
      code: 'DEVICE_FAILURE',
      message: error instanceof Error ? error.message : String(error),
    })
  } finally {
    starting = false
    if (!processingOnly && stopping) {
      disposeProcessing()
      postEvent({ type: 'stopped' })
    }
  }
}

workerScope.onmessage = (event: MessageEvent<HackRfWorkerRequest>) => {
  const request = event.data
  if (request.type === 'start') {
    void start(request)
  } else if (request.type === 'start-processing') {
    void startProcessing(request)
  } else if (request.type === 'configure-processing') {
    activeConfig = { ...request.config }
    rdsDecoder?.reset()
    vfoProcessor?.reset()
    configureVfos()
  } else if (request.type === 'process-iq') {
    if (!processingOnly) return
    try {
      processIq(request.iq, request.timestampUs)
    } catch (error) {
      postEvent({
        type: 'error',
        code: 'DEVICE_FAILURE',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } else if (request.type === 'apply-runtime-command') {
    const activeSession = session
    if (!activeSession) {
      postEvent({
        type: 'runtime-command-error',
        requestId: request.requestId,
        message: 'HackRF receiver is not running.',
      })
      return
    }
    if (request.command.type === 'set-center-frequency') {
      rdsTargets = []
      rdsDecoder?.setTargets([])
      vfos = []
      configureVfos()
    }
    void activeSession.applyRuntimeCommand(request.command).then(
      (config) => {
        activeConfig = { ...config }
        if (request.command.type === 'set-center-frequency') {
          rdsTargets = []
          rdsDecoder?.setTargets([])
        }
        postEvent({
          type: 'runtime-command-applied',
          requestId: request.requestId,
          config,
        })
      },
      (error: unknown) => postEvent({
        type: 'runtime-command-error',
        requestId: request.requestId,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  } else if (request.type === 'set-rds-targets') {
    rdsTargets = request.targets
    try {
      rdsDecoder?.setTargets(rdsTargets)
    } catch (error) {
      postEvent({
        type: 'error',
        code: 'DEVICE_FAILURE',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } else if (request.type === 'set-vfos') {
    vfoOutputSampleRateHz = request.outputSampleRateHz
    vfos = request.vfos
    try {
      configureVfos()
    } catch (error) {
      postEvent({
        type: 'error',
        code: 'DEVICE_FAILURE',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } else if (request.type === 'attach-vfo-audio-port') {
    vfoAudioPort?.close()
    vfoAudioPort = request.port
    vfoAudioPort.start()
  } else if (request.type === 'return-buffer') {
    try {
      session?.returnBuffer(request.buffer)
    } catch (error) {
      postEvent({
        type: 'error',
        code: 'DEVICE_FAILURE',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  } else if (processingOnly) {
    stopping = true
    processingOnly = false
    disposeProcessing()
    postEvent({ type: 'stopped' })
  } else {
    stopping = true
    if (session) void session.stop()
    else if (!starting) {
      disposeProcessing()
      postEvent({ type: 'stopped' })
    }
  }
}

export {}
