import { RTL2832U } from '@jtarrio/webrtlsdr/rtlsdr.js'
import type { RtlCom } from '@jtarrio/webrtlsdr/rtlsdr/rtlcom.js'
import type { Tuner } from '@jtarrio/webrtlsdr/rtlsdr/tuner.js'
import { E4000Tuner } from './E4000Tuner'

type Rtl2832UInternals = {
  _findTuner(com: RtlCom): Promise<Tuner>
}

let e4000ProbeInstalled = false

export function installE4000TunerProbe(): void {
  if (e4000ProbeInstalled) return
  const internals = RTL2832U as unknown as Rtl2832UInternals
  internals._findTuner = async (com) => {
    const tuner = await E4000Tuner.maybeInit(com)
    if (!tuner) {
      throw new Error('This RTL-SDR source currently supports the Elonics E4000 tuner only.')
    }
    return tuner
  }
  e4000ProbeInstalled = true
}

export async function openRtlSdrDevice(
  device: Parameters<typeof RTL2832U.open>[0],
): Promise<RTL2832U> {
  installE4000TunerProbe()
  if (!device.opened) await device.open()
  try {
    return await RTL2832U.open(device)
  } catch (error) {
    try {
      if (device.opened) await device.close()
    } catch {
      // Preserve the tuner or setup error.
    }
    throw error
  }
}