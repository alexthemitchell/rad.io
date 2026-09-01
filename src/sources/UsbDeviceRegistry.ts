import {
  HACKRF_ONE_USB_PRODUCT_ID,
  HACKRF_USB_VENDOR_ID,
} from './hackrfProtocol'
import {
  RTL_SDR_USB_PRODUCT_IDS,
  RTL_SDR_USB_VENDOR_ID,
} from './rtlSdrProtocol'
import type { HardwareSourceKind, SourceSessionId } from './types'
import type { Usb, UsbConnectionEvent, UsbDevice } from './webUsb'

const MAX_HARDWARE_SESSIONS = 2

export type UsbAcquisitionOwner = 'worker' | 'page'

export type UsbDeviceSelection = {
  id: SourceSessionId
  kind: HardwareSourceKind
  label: string
  device: UsbDevice
  vendorId: number
  productId: number
  serialNumber: string | null
  acquisitionOwner: UsbAcquisitionOwner
  connected: boolean
}

export type AuthorizedUsbDevice = {
  kind: HardwareSourceKind
  label: string
  device: UsbDevice
  serialNumber: string | null
}

export const SUPPORTED_SDR_USB_FILTERS = [
  { vendorId: HACKRF_USB_VENDOR_ID, productId: HACKRF_ONE_USB_PRODUCT_ID },
  ...RTL_SDR_USB_PRODUCT_IDS.map((productId) => ({
    vendorId: RTL_SDR_USB_VENDOR_ID,
    productId,
  })),
] as const

export class UsbDeviceRegistry {
  readonly #usb: Usb
  readonly #selections = new Map<SourceSessionId, UsbDeviceSelection>()
  readonly #listeners = new Set<(selections: readonly UsbDeviceSelection[]) => void>()
  #nextSessionNumber = 1
  #listening = false

  constructor(usb: Usb) {
    this.#usb = usb
  }

  get selections(): readonly UsbDeviceSelection[] {
    return [...this.#selections.values()]
  }

  get(id: SourceSessionId): UsbDeviceSelection | undefined {
    return this.#selections.get(id)
  }

  async getAuthorizedDevices(): Promise<AuthorizedUsbDevice[]> {
    this.#startListening()
    let devices: UsbDevice[]
    try {
      devices = await this.#usb.getDevices()
    } catch {
      return []
    }
    const selectedDevices = new Set(
      [...this.#selections.values()].map((selection) => selection.device),
    )
    return devices.flatMap((device) => {
      if (selectedDevices.has(device)) return []
      const kind = classifySupportedSdr(device)
      if (!kind) return []
      return [{
        kind,
        label: device.productName?.trim() || (kind === 'hackrf' ? 'HackRF One' : 'RTL-SDR'),
        device,
        serialNumber: normalizedSerial(device.serialNumber),
      }]
    })
  }

  async addDevice(authorizedDevice?: AuthorizedUsbDevice): Promise<UsbDeviceSelection> {
    this.#startListening()
    if (this.#selections.size >= MAX_HARDWARE_SESSIONS) {
      throw new Error(`At most ${MAX_HARDWARE_SESSIONS} hardware sessions can be added.`)
    }
    if (!authorizedDevice && !this.#usb.requestDevice) {
      throw new Error('WebUSB device selection is unavailable in this browser.')
    }
    const device = authorizedDevice?.device ??
      await this.#usb.requestDevice!({ filters: SUPPORTED_SDR_USB_FILTERS })
    const kind = classifySupportedSdr(device)
    if (!kind) throw new Error('The selected USB device is not a supported SDR.')
    if ([...this.#selections.values()].some((selection) => selection.device === device)) {
      throw new Error('This SDR already has a session.')
    }

    const id = `${kind}-${this.#nextSessionNumber++}`
    this.#selections.set(id, {
      id,
      kind,
      label: device.productName?.trim() || (kind === 'hackrf' ? 'HackRF One' : 'RTL-SDR'),
      device,
      vendorId: device.vendorId,
      productId: device.productId,
      serialNumber: normalizedSerial(device.serialNumber),
      acquisitionOwner: 'page',
      connected: true,
    })
    await this.#refreshAcquisitionOwners()
    this.#emit()
    return this.#selections.get(id)!
  }

  remove(id: SourceSessionId): void {
    if (!this.#selections.delete(id)) return
    void this.#refreshAcquisitionOwners().finally(() => this.#emit())
  }

  subscribe(listener: (selections: readonly UsbDeviceSelection[]) => void): () => void {
    this.#listeners.add(listener)
    listener(this.selections)
    return () => this.#listeners.delete(listener)
  }

  dispose(): void {
    if (this.#listening) {
      this.#usb.removeEventListener('connect', this.#handleConnect)
      this.#usb.removeEventListener('disconnect', this.#handleDisconnect)
      this.#listening = false
    }
    this.#listeners.clear()
  }

  #startListening(): void {
    if (this.#listening) return
    this.#usb.addEventListener('connect', this.#handleConnect)
    this.#usb.addEventListener('disconnect', this.#handleDisconnect)
    this.#listening = true
  }

  async #refreshAcquisitionOwners(): Promise<void> {
    let authorizedDevices: UsbDevice[]
    try {
      authorizedDevices = await this.#usb.getDevices()
    } catch {
      authorizedDevices = []
    }
    for (const [id, selection] of this.#selections) {
      const serialNumber = selection.serialNumber
      const matchingAuthorizedDevices = serialNumber === null
        ? []
        : authorizedDevices.filter((device) =>
            device.vendorId === selection.vendorId &&
            device.productId === selection.productId &&
            normalizedSerial(device.serialNumber) === serialNumber
          )
      const matchingSelections = serialNumber === null
        ? []
        : [...this.#selections.values()].filter((candidate) =>
            candidate.vendorId === selection.vendorId &&
            candidate.productId === selection.productId &&
            candidate.serialNumber === serialNumber
          )
      this.#selections.set(id, {
        ...selection,
        acquisitionOwner:
          matchingAuthorizedDevices.length === 1 && matchingSelections.length === 1
            ? 'worker'
            : 'page',
      })
    }
  }

  readonly #handleConnect = (event: Event): void => {
    const device = (event as UsbConnectionEvent).device
    const exact = [...this.#selections.values()].find((selection) => selection.device === device)
    const matches = exact
      ? [exact]
      : [...this.#selections.values()].filter((selection) =>
          !selection.connected && sameStableIdentity(selection, device)
        )
    if (matches.length !== 1) return
    const selection = matches[0]
    this.#selections.set(selection.id, { ...selection, device, connected: true })
    this.#emit()
  }

  readonly #handleDisconnect = (event: Event): void => {
    const device = (event as UsbConnectionEvent).device
    const exact = [...this.#selections.values()].find((selection) => selection.device === device)
    const matches = exact
      ? [exact]
      : [...this.#selections.values()].filter((selection) => sameStableIdentity(selection, device))
    if (matches.length !== 1) return
    const selection = matches[0]
    this.#selections.set(selection.id, { ...selection, connected: false })
    this.#emit()
  }

  #emit(): void {
    const selections = this.selections
    for (const listener of this.#listeners) listener(selections)
  }
}

export function classifySupportedSdr(device: Pick<UsbDevice, 'vendorId' | 'productId'>): HardwareSourceKind | null {
  if (
    device.vendorId === HACKRF_USB_VENDOR_ID &&
    device.productId === HACKRF_ONE_USB_PRODUCT_ID
  ) return 'hackrf'
  if (
    device.vendorId === RTL_SDR_USB_VENDOR_ID &&
    (RTL_SDR_USB_PRODUCT_IDS as readonly number[]).includes(device.productId)
  ) return 'rtl-sdr'
  return null
}

function normalizedSerial(serialNumber: string | null | undefined): string | null {
  const normalized = serialNumber?.trim()
  return normalized ? normalized : null
}

function sameStableIdentity(selection: UsbDeviceSelection, device: UsbDevice): boolean {
  return selection.serialNumber !== null &&
    selection.vendorId === device.vendorId &&
    selection.productId === device.productId &&
    selection.serialNumber === normalizedSerial(device.serialNumber)
}