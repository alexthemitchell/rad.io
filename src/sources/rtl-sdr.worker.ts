/// <reference lib="webworker" />

import type { RtlDevice } from '@jtarrio/webrtlsdr/rtlsdr.js'
import { ExternalIqProcessor } from './ExternalIqProcessor'
import { RtlSdrDeviceSession } from './RtlSdrDeviceSession'
import { openRtlSdrDevice } from './rtlSdrDevice'
import type {
  RtlSdrDeviceIdentity,
  RtlSdrWorkerEvent,
  RtlSdrWorkerRequest,
} from './rtlSdrWorkerProtocol'
import type { RdsDecodeTarget } from '../workers/protocol'
import type { VfoDspConfig } from '../vfo/types'
import { webUsbFromNavigator, type UsbDevice } from './webUsb'

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope
let session: RtlSdrDeviceSession | undefined
let openedDevice: RtlDevice | undefined
let processor: ExternalIqProcessor | undefined
let stopping = false
let starting = false
let processingOnly = false
let rdsTargets: RdsDecodeTarget[] = []
let vfos: VfoDspConfig[] = []
let vfoOutputSampleRateHz = 48_000

function postEvent(event: RtlSdrWorkerEvent, transfer: Transferable[] = []): void {
  workerScope.postMessage(event, transfer)
}

function matchesIdentity(device: UsbDevice, identity: RtlSdrDeviceIdentity): boolean {
  return device.vendorId === identity.vendorId &&
    device.productId === identity.productId &&
    (identity.serialNumber === null || device.serialNumber === identity.serialNumber)
}

function configureVfos(): void {
  processor?.setVfos(vfoOutputSampleRateHz, vfos)
}

function disposeProcessing(): void {
  processor?.dispose()
  processor = undefined
}

async function createProcessor(config: Extract<RtlSdrWorkerRequest, { type: 'start' }>['config']): Promise<void> {
  processor = await ExternalIqProcessor.create(config, {
    onRdsUpdate: (receptions) => postEvent({ type: 'rds-update', receptions: [...receptions] }),
  })
  processor.setRdsTargets(rdsTargets)
  configureVfos()
}

async function start(request: Extract<RtlSdrWorkerRequest, { type: 'start' }>): Promise<void> {
  if (starting || session || processingOnly) {
    postEvent({ type: 'error', code: 'DEVICE_FAILURE', message: 'RTL-SDR worker is already active.' })
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
        message: 'WebUSB is unavailable in the RTL-SDR acquisition worker.',
      })
      return
    }
    const devices = await usb.getDevices()
    const usbDevice = devices.find((candidate) => matchesIdentity(candidate, request.identity))
    if (!usbDevice) {
      postEvent({
        type: 'error',
        code: 'DEVICE_NOT_FOUND',
        message: 'The newly authorized RTL-SDR is not visible in this acquisition worker.',
      })
      return
    }
    if (stopping) return

    await createProcessor(request.config)
    if (stopping) return
    openedDevice = await openRtlSdrDevice(
      usbDevice as unknown as Parameters<typeof openRtlSdrDevice>[0],
    )
    if (stopping) return
    const deviceSession = new RtlSdrDeviceSession(openedDevice, request.config, {
      onConfigured: (info) => postEvent({ type: 'configured', info }),
      onRawSamples: ({ iq, timestampUs }) => processor?.process(iq, timestampUs),
      onDiscontinuity: () => processor?.reset(),
      onSamples: ({ iq, sampleRateHz, centerFrequencyHz, sourceSequence, timestampUs }) => {
        postEvent({
          type: 'samples',
          iq,
          sampleRateHz,
          centerFrequencyHz,
          sourceSequence,
          timestampUs,
        }, [iq.buffer as ArrayBuffer])
      },
    }, request.identity)
    session = deviceSession
    openedDevice = undefined
    await deviceSession.start()
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
    if (openedDevice) {
      try {
        await openedDevice.close()
      } catch {
        // The session may already have closed or lost the device.
      }
      openedDevice = undefined
    }
    disposeProcessing()
    postEvent({ type: 'stopped' })
  }
}

async function startProcessing(
  request: Extract<RtlSdrWorkerRequest, { type: 'start-processing' }>,
): Promise<void> {
  if (starting || session || processingOnly) {
    postEvent({ type: 'error', code: 'DEVICE_FAILURE', message: 'RTL-SDR worker is already active.' })
    return
  }
  starting = true
  stopping = false
  try {
    await createProcessor(request.config)
    if (stopping) return
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

function commandResetsDsp(
  command: Extract<RtlSdrWorkerRequest, { type: 'apply-runtime-command' }>['command'],
): boolean {
  return command.type === 'set-center-frequency' ||
    command.type === 'set-frequency-correction' ||
    command.type === 'set-direct-sampling'
}

workerScope.onmessage = (event: MessageEvent<RtlSdrWorkerRequest>) => {
  const request = event.data
  if (request.type === 'start') {
    void start(request)
  } else if (request.type === 'start-processing') {
    void startProcessing(request)
  } else if (request.type === 'configure-processing') {
    processor?.configure(request.config)
    configureVfos()
  } else if (request.type === 'process-iq') {
    if (!processingOnly) return
    try {
      processor?.process(request.iq, request.timestampUs)
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
        message: 'RTL-SDR receiver is not running.',
      })
      return
    }
    if (commandResetsDsp(request.command)) {
      rdsTargets = []
      processor?.setRdsTargets([])
      vfos = []
      configureVfos()
    }
    void activeSession.applyRuntimeCommand(request.command).then(
      (config) => {
        if (commandResetsDsp(request.command)) processor?.configure(config)
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
      processor?.setRdsTargets(rdsTargets)
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
    processor?.attachVfoAudioPort(request.port)
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