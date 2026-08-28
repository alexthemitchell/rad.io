export type UsbTransferStatus = 'ok' | 'stall' | 'babble'

export type UsbControlTransferParameters = {
  requestType: 'standard' | 'class' | 'vendor'
  recipient: 'device' | 'interface' | 'endpoint' | 'other'
  request: number
  value: number
  index: number
}

export type UsbEndpoint = {
  endpointNumber: number
  direction: 'in' | 'out'
  type: 'bulk' | 'interrupt' | 'isochronous'
  packetSize: number
}

export type UsbAlternateInterface = {
  alternateSetting: number
  interfaceClass: number
  interfaceSubclass: number
  interfaceProtocol: number
  endpoints: readonly UsbEndpoint[]
}

export type UsbInterface = {
  interfaceNumber: number
  alternate: UsbAlternateInterface
  alternates: readonly UsbAlternateInterface[]
  claimed?: boolean
}

export type UsbConfiguration = {
  configurationValue: number
  interfaces: readonly UsbInterface[]
}

export type UsbInTransferResult = {
  data?: DataView | null
  status: UsbTransferStatus
}

export type UsbOutTransferResult = {
  bytesWritten?: number
  status: Exclude<UsbTransferStatus, 'babble'>
}

export type UsbDevice = {
  readonly vendorId: number
  readonly productId: number
  readonly productName?: string | null
  readonly manufacturerName?: string | null
  readonly serialNumber?: string | null
  readonly deviceVersionMajor?: number
  readonly deviceVersionMinor?: number
  readonly deviceVersionSubminor?: number
  readonly configurations: readonly UsbConfiguration[]
  readonly configuration: UsbConfiguration | null
  readonly opened: boolean
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  releaseInterface(interfaceNumber: number): Promise<void>
  selectAlternateInterface(
    interfaceNumber: number,
    alternateSetting: number,
  ): Promise<void>
  controlTransferIn(
    setup: UsbControlTransferParameters,
    length: number,
  ): Promise<UsbInTransferResult>
  controlTransferOut(
    setup: UsbControlTransferParameters,
    data?: BufferSource,
  ): Promise<UsbOutTransferResult>
  transferIn(endpointNumber: number, length: number): Promise<UsbInTransferResult>
  clearHalt(direction: 'in' | 'out', endpointNumber: number): Promise<void>
}

export type UsbConnectionEvent = Event & { device: UsbDevice }

export type Usb = EventTarget & {
  getDevices(): Promise<UsbDevice[]>
  requestDevice?(options: {
    filters: ReadonlyArray<{ vendorId: number; productId?: number }>
  }): Promise<UsbDevice>
}

export type NavigatorWithUsb = Navigator & { usb?: Usb }
export type WorkerNavigatorWithUsb = WorkerNavigator & { usb?: Usb }

export function webUsbFromNavigator(
  navigatorValue: Navigator | WorkerNavigator,
): Usb | undefined {
  return (navigatorValue as NavigatorWithUsb | WorkerNavigatorWithUsb).usb
}
