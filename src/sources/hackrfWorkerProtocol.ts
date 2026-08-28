import type { HackRfConfig, HackRfRuntimeCommand } from './hackrfProtocol'
import type { HackRfDeviceInfo } from './HackRfDeviceSession'
import type { RdsDecodeTarget, RdsReception } from '../workers/protocol'
import type { VfoDspConfig } from '../vfo/types'

export type HackRfDeviceIdentity = {
  vendorId: number
  productId: number
  serialNumber: string | null
}

export type HackRfWorkerRequest =
  | { type: 'start'; identity: HackRfDeviceIdentity; config: HackRfConfig }
  | { type: 'start-processing'; config: HackRfConfig }
  | { type: 'configure-processing'; config: HackRfConfig }
  | { type: 'process-iq'; iq: Int8Array; timestampUs: bigint }
  | { type: 'apply-runtime-command'; requestId: number; command: HackRfRuntimeCommand }
  | { type: 'set-rds-targets'; targets: RdsDecodeTarget[] }
  | { type: 'set-vfos'; outputSampleRateHz: number; vfos: VfoDspConfig[] }
  | { type: 'attach-vfo-audio-port'; port: MessagePort }
  | { type: 'return-buffer'; buffer: ArrayBuffer }
  | { type: 'stop' }

export type HackRfWorkerEvent =
  | { type: 'configured'; info: HackRfDeviceInfo }
  | { type: 'processing-ready' }
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
