/// <reference lib="webworker" />

import { HackRfDeviceSession } from './HackRfDeviceSession'
import { RdsWasmDecoder } from '../rds/RdsWasmDecoder'
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
let rdsDecoder: RdsWasmDecoder | undefined
let rdsTargets: RdsDecodeTarget[] = []
let lastRdsEmissionUs: bigint | undefined

function postEvent(event: HackRfWorkerEvent, transfer: Transferable[] = []): void {
  workerScope.postMessage(event, transfer)
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
  if (starting || session) {
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

    rdsDecoder = await RdsWasmDecoder.create(request.config.sampleRateHz)
    rdsDecoder.setTargets(rdsTargets)

    session = new HackRfDeviceSession(device, request.config, {
      onConfigured: (info) => postEvent({ type: 'configured', info }),
      onRawSamples: ({ iq, timestampUs }) => {
        const receptions = rdsDecoder?.process(iq, timestampUs)
        if (
          receptions &&
          (lastRdsEmissionUs === undefined || timestampUs - lastRdsEmissionUs >= 250_000n)
        ) {
          lastRdsEmissionUs = timestampUs
          postEvent({ type: 'rds-update', receptions })
        }
      },
      onDiscontinuity: () => rdsDecoder?.reset(),
      onSamples: ({ iq, sourceSequence, timestampUs }) => {
        postEvent(
          { type: 'samples', iq, sourceSequence, timestampUs },
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
    rdsDecoder?.dispose()
    rdsDecoder = undefined
    lastRdsEmissionUs = undefined
    postEvent({ type: 'stopped' })
  }
}

workerScope.onmessage = (event: MessageEvent<HackRfWorkerRequest>) => {
  const request = event.data
  if (request.type === 'start') {
    void start(request)
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
  } else {
    stopping = true
    void session?.stop()
  }
}

export {}
