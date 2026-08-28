import type { HackRfConfig, HackRfRuntimeCommand } from './hackrfProtocol'
import type { HackRfDeviceInfo } from './HackRfDeviceSession'
import type { RdsDecodeTarget, RdsReception } from '../workers/protocol'

export type HackRfDeviceIdentity = {
  vendorId: number
  productId: number
  serialNumber: string | null
}

export type HackRfWorkerRequest =
  | { type: 'start'; identity: HackRfDeviceIdentity; config: HackRfConfig }
  | { type: 'apply-runtime-command'; requestId: number; command: HackRfRuntimeCommand }
  | { type: 'set-rds-targets'; targets: RdsDecodeTarget[] }
  | { type: 'return-buffer'; buffer: ArrayBuffer }
  | { type: 'stop' }

export type HackRfWorkerEvent =
  | { type: 'configured'; info: HackRfDeviceInfo }
  | {
      type: 'samples'
      iq: Float32Array
      sampleRateHz: number
      centerFrequencyHz: number
      sourceSequence: number
      timestampUs: bigint
    }
  | { type: 'runtime-command-applied'; requestId: number; config: HackRfConfig }
  | { type: 'runtime-command-error'; requestId: number; message: string }
  | { type: 'stopped' }
  | { type: 'rds-update'; receptions: RdsReception[] }
  | {
      type: 'error'
      code: 'WEBUSB_UNAVAILABLE' | 'DEVICE_NOT_FOUND' | 'DEVICE_FAILURE'
      message: string
    }
