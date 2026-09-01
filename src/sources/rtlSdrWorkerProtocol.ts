import type { RtlSdrDeviceInfo } from './RtlSdrDeviceSession'
import type { RtlSdrConfig, RtlSdrRuntimeCommand } from './rtlSdrProtocol'
import type { RdsDecodeTarget, RdsReception } from '../workers/protocol'
import type { VfoDspConfig } from '../vfo/types'

export type RtlSdrDeviceIdentity = {
  vendorId: number
  productId: number
  serialNumber: string | null
  productName: string | null
}

export type RtlSdrWorkerRequest =
  | { type: 'start'; identity: RtlSdrDeviceIdentity; config: RtlSdrConfig }
  | { type: 'start-processing'; config: RtlSdrConfig }
  | { type: 'configure-processing'; config: RtlSdrConfig }
  | { type: 'process-iq'; iq: Int8Array; timestampUs: bigint }
  | { type: 'apply-runtime-command'; requestId: number; command: RtlSdrRuntimeCommand }
  | { type: 'set-rds-targets'; targets: RdsDecodeTarget[] }
  | { type: 'set-vfos'; outputSampleRateHz: number; vfos: VfoDspConfig[] }
  | { type: 'attach-vfo-audio-port'; port: MessagePort }
  | { type: 'return-buffer'; buffer: ArrayBuffer }
  | { type: 'stop' }

export type RtlSdrWorkerEvent =
  | { type: 'configured'; info: RtlSdrDeviceInfo }
  | { type: 'processing-ready' }
  | {
      type: 'samples'
      iq: Float32Array
      sampleRateHz: number
      centerFrequencyHz: number
      sourceSequence: number
      timestampUs: bigint
    }
  | { type: 'runtime-command-applied'; requestId: number; config: RtlSdrConfig }
  | { type: 'runtime-command-error'; requestId: number; message: string }
  | { type: 'stopped' }
  | { type: 'rds-update'; receptions: RdsReception[] }
  | {
      type: 'error'
      code: 'WEBUSB_UNAVAILABLE' | 'DEVICE_NOT_FOUND' | 'DEVICE_FAILURE'
      message: string
    }