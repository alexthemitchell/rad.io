import { describe, expect, it, vi } from 'vitest'
import { HackRfDeviceSession } from './HackRfDeviceSession'
import { DEFAULT_HACKRF_CONFIG, HACKRF_REQUEST } from './hackrfProtocol'
import type {
  UsbConfiguration,
  UsbControlTransferParameters,
  UsbDevice,
  UsbInTransferResult,
} from './webUsb'

function createConfiguration(inEndpointNumber = 1): UsbConfiguration {
  const alternate = {
    alternateSetting: 0,
    interfaceClass: 0xff,
    interfaceSubclass: 0xff,
    interfaceProtocol: 0xff,
    endpoints: [
      {
        endpointNumber: inEndpointNumber,
        direction: 'in' as const,
        type: 'bulk' as const,
        packetSize: 512,
      },
      { endpointNumber: 2, direction: 'out' as const, type: 'bulk' as const, packetSize: 512 },
    ],
  }
  return {
    configurationValue: 1,
    interfaces: [{ interfaceNumber: 0, alternate, alternates: [alternate] }],
  }
}

function createDevice(
  transferIn?: () => Promise<UsbInTransferResult>,
  inEndpointNumber = 1,
  openGate?: Promise<void>,
): UsbDevice & {
  controlTransferIn: ReturnType<typeof vi.fn>
  controlTransferOut: ReturnType<typeof vi.fn>
  transferIn: ReturnType<typeof vi.fn>
  clearHalt: ReturnType<typeof vi.fn>
  releaseInterface: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
} {
  const configuration = createConfiguration(inEndpointNumber)
  const state = { opened: false, configuration: null as UsbConfiguration | null }
  const device = {
    vendorId: 0x1d50,
    productId: 0x6089,
    productName: 'HackRF One',
    serialNumber: 'test-radio',
    deviceVersionMajor: 1,
    deviceVersionMinor: 0,
    deviceVersionSubminor: 4,
    configurations: [configuration],
    get configuration() {
      return state.configuration
    },
    get opened() {
      return state.opened
    },
    open: vi.fn(async () => {
      await openGate
      state.opened = true
    }),
    close: vi.fn(async () => {
      state.opened = false
    }),
    selectConfiguration: vi.fn(async () => {
      state.configuration = configuration
    }),
    claimInterface: vi.fn(async () => undefined),
    releaseInterface: vi.fn(async () => undefined),
    selectAlternateInterface: vi.fn(async () => undefined),
    controlTransferIn: vi.fn(async (setup: UsbControlTransferParameters) => {
      if (setup.request === HACKRF_REQUEST.readBoardId) {
        return { status: 'ok' as const, data: new DataView(Uint8Array.of(2).buffer) }
      }
      if (setup.request === HACKRF_REQUEST.readVersionString) {
        return {
          status: 'ok' as const,
          data: new DataView(new TextEncoder().encode('2024.02.1\0').buffer),
        }
      }
      return { status: 'ok' as const, data: new DataView(Uint8Array.of(1).buffer) }
    }),
    controlTransferOut: vi.fn(async (_setup: UsbControlTransferParameters, data?: BufferSource) => ({
      status: 'ok' as const,
      bytesWritten: data?.byteLength ?? 0,
    })),
    transferIn: vi.fn(
      transferIn ??
        (async () => ({
          status: 'ok' as const,
          data: new DataView(new Int8Array(16 * 1024).fill(64).buffer),
        })),
    ),
    clearHalt: vi.fn(async () => undefined),
  }
  return device
}

describe('HackRfDeviceSession', () => {
  it('configures the receiver in order and emits normalized IQ', async () => {
    const device = createDevice()
    const samples: number[] = []
    const session = new HackRfDeviceSession(device, DEFAULT_HACKRF_CONFIG, {
      onSamples: ({ iq }) => {
        samples.push(iq[0])
        void session.stop()
      },
    })

    await session.start()

    const outRequests = device.controlTransferOut.mock.calls.map(
      ([setup]) => (setup as UsbControlTransferParameters).request,
    )
    expect(outRequests).toEqual([
      HACKRF_REQUEST.setTransceiverMode,
      HACKRF_REQUEST.setAntennaEnable,
      HACKRF_REQUEST.setAmpEnable,
      HACKRF_REQUEST.setSampleRate,
      HACKRF_REQUEST.setBasebandFilterBandwidth,
      HACKRF_REQUEST.setFrequency,
      HACKRF_REQUEST.setTransceiverMode,
      HACKRF_REQUEST.setTransceiverMode,
    ])
    expect(samples).toEqual([0.5])
    expect(device.releaseInterface).toHaveBeenCalledWith(0)
    expect(device.close).toHaveBeenCalledOnce()
  })

  it('reuses a returned output buffer without queueing frames', async () => {
    const device = createDevice()
    const config = { ...DEFAULT_HACKRF_CONFIG, frameRate: 60 }
    const buffers: ArrayBuffer[] = []
    const session = new HackRfDeviceSession(device, config, {
      onSamples: ({ iq }) => {
        buffers.push(iq.buffer as ArrayBuffer)
        if (buffers.length === 1) session.returnBuffer(iq.buffer as ArrayBuffer)
        else void session.stop()
      },
    })

    await session.start()

    expect(buffers).toHaveLength(2)
    expect(buffers[1]).toBe(buffers[0])
    expect(device.transferIn.mock.calls.length).toBeGreaterThan(1)
  })

  it('clears a stalled endpoint and resumes reception', async () => {
    let attempt = 0
    const device = createDevice(async () => {
      attempt += 1
      if (attempt === 1) return { status: 'stall' }
      return {
        status: 'ok',
        data: new DataView(new Int8Array(4096).fill(-128).buffer),
      }
    }, 5)
    let sample = 0
    const session = new HackRfDeviceSession(device, DEFAULT_HACKRF_CONFIG, {
      onSamples: ({ iq }) => {
        sample = iq[0]
        void session.stop()
      },
    })

    await session.start()

    expect(device.transferIn).toHaveBeenCalledWith(5, 16 * 1024)
    expect(device.clearHalt).toHaveBeenCalledWith('in', 5)
    expect(sample).toBe(-1)
  })

  it('cleans up when stopped before a pending device open completes', async () => {
    let finishOpening: () => void = () => undefined
    const openGate = new Promise<void>((resolve) => {
      finishOpening = resolve
    })
    const device = createDevice(undefined, 1, openGate)
    const session = new HackRfDeviceSession(device, DEFAULT_HACKRF_CONFIG, {
      onSamples: vi.fn(),
    })

    const running = session.start()
    await vi.waitFor(() => expect(device.open).toHaveBeenCalledOnce())
    const stopping = session.stop()
    finishOpening()
    await Promise.all([running, stopping])

    expect(device.claimInterface).not.toHaveBeenCalled()
    expect(device.transferIn).not.toHaveBeenCalled()
    expect(device.close).toHaveBeenCalledOnce()
  })
})