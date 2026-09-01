import { describe, expect, it, vi } from 'vitest'
import { UsbDeviceRegistry } from './UsbDeviceRegistry'
import type { Usb, UsbDevice } from './webUsb'

function device(
  vendorId: number,
  productId: number,
  serialNumber: string | null,
  productName: string,
): UsbDevice {
  return { vendorId, productId, serialNumber, productName } as UsbDevice
}

function usbHarness(devices: UsbDevice[]) {
  let requestIndex = 0
  const usb = new EventTarget() as Usb
  usb.requestDevice = vi.fn(async () => devices[requestIndex++])
  usb.getDevices = vi.fn(async () => devices.slice(0, requestIndex))
  return usb
}

describe('UsbDeviceRegistry', () => {
  it('activates host listeners lazily and only once', async () => {
    const hackrf = device(0x1d50, 0x6089, 'hackrf-a', 'HackRF One')
    const rtl = device(0x0bda, 0x2838, 'rtl-a', 'RTL2838UHIDIR')
    const usb = usbHarness([hackrf, rtl])
    const addEventListener = vi.spyOn(usb, 'addEventListener')
    const removeEventListener = vi.spyOn(usb, 'removeEventListener')

    const registry = new UsbDeviceRegistry(usb)
    expect(addEventListener).not.toHaveBeenCalled()

    await registry.addDevice()
    await registry.addDevice()
    expect(addEventListener.mock.calls.map(([type]) => type)).toEqual([
      'connect',
      'disconnect',
    ])

    registry.dispose()
    expect(removeEventListener.mock.calls.map(([type]) => type)).toEqual([
      'connect',
      'disconnect',
    ])
  })

  it('adds an authorized device without reopening the chooser', async () => {
    const hackrf = device(0x1d50, 0x6089, 'hackrf-a', 'HackRF One')
    const usb = new EventTarget() as Usb
    usb.getDevices = vi.fn(async () => [hackrf])
    usb.requestDevice = vi.fn(async () => {
      throw new Error('chooser should not open')
    })
    const registry = new UsbDeviceRegistry(usb)

    const [authorized] = await registry.getAuthorizedDevices()
    const selection = await registry.addDevice(authorized)

    expect(selection).toMatchObject({ kind: 'hackrf', serialNumber: 'hackrf-a' })
    expect(usb.requestDevice).not.toHaveBeenCalled()
    expect(await registry.getAuthorizedDevices()).toEqual([])
  })

  it('pairs either supported source with combined filters and enforces two sessions', async () => {
    const hackrf = device(0x1d50, 0x6089, 'hackrf-a', 'HackRF One')
    const rtl = device(0x0bda, 0x2838, 'rtl-a', 'RTL2838UHIDIR')
    const usb = usbHarness([hackrf, rtl])
    const registry = new UsbDeviceRegistry(usb)

    const first = await registry.addDevice()
    const second = await registry.addDevice()

    expect(first).toMatchObject({ kind: 'hackrf', acquisitionOwner: 'worker' })
    expect(second).toMatchObject({ kind: 'rtl-sdr', acquisitionOwner: 'worker' })
    expect(usb.requestDevice).toHaveBeenCalledWith({
      filters: [
        { vendorId: 0x1d50, productId: 0x6089 },
        { vendorId: 0x0bda, productId: 0x2832 },
        { vendorId: 0x0bda, productId: 0x2838 },
      ],
    })
    await expect(registry.addDevice()).rejects.toThrow('At most 2')
  })

  it('rejects selecting the same concrete device twice', async () => {
    const hackrf = device(0x1d50, 0x6089, 'hackrf-a', 'HackRF One')
    const usb = usbHarness([hackrf, hackrf])
    const registry = new UsbDeviceRegistry(usb)

    await registry.addDevice()
    await expect(registry.addDevice()).rejects.toThrow('already has a session')
  })

  it('forces page acquisition for missing or duplicate serials', async () => {
    const firstRtl = device(0x0bda, 0x2838, 'duplicate', 'RTL A')
    const secondRtl = device(0x0bda, 0x2838, 'duplicate', 'RTL B')
    const seriallessHackRf = device(0x1d50, 0x6089, null, 'HackRF One')
    const duplicateUsb = usbHarness([firstRtl, secondRtl])
    const duplicateRegistry = new UsbDeviceRegistry(duplicateUsb)

    await duplicateRegistry.addDevice()
    await duplicateRegistry.addDevice()
    expect(duplicateRegistry.selections.map((selection) => selection.acquisitionOwner))
      .toEqual(['page', 'page'])

    const seriallessRegistry = new UsbDeviceRegistry(usbHarness([seriallessHackRf]))
    expect((await seriallessRegistry.addDevice()).acquisitionOwner).toBe('page')
  })

  it('tracks disconnect and refreshes a uniquely identified device on reconnect', async () => {
    const original = device(0x0bda, 0x2838, 'rtl-a', 'RTL2838UHIDIR')
    const usb = usbHarness([original])
    const registry = new UsbDeviceRegistry(usb)
    const selection = await registry.addDevice()
    const snapshots: boolean[] = []
    registry.subscribe((selections) => snapshots.push(selections[0]?.connected ?? false))

    usb.dispatchEvent(Object.assign(new Event('disconnect'), { device: original }))
    const replacement = device(0x0bda, 0x2838, 'rtl-a', 'RTL2838UHIDIR')
    usb.dispatchEvent(Object.assign(new Event('connect'), { device: replacement }))

    expect(snapshots).toEqual([true, false, true])
    expect(registry.get(selection.id)?.device).toBe(replacement)
  })

  it('reconnects the only disconnected selection when serials are duplicated', async () => {
    const first = device(0x0bda, 0x2838, 'duplicate', 'RTL A')
    const second = device(0x0bda, 0x2838, 'duplicate', 'RTL B')
    const usb = usbHarness([first, second])
    const registry = new UsbDeviceRegistry(usb)
    const firstSelection = await registry.addDevice()
    const secondSelection = await registry.addDevice()

    usb.dispatchEvent(Object.assign(new Event('disconnect'), { device: first }))
    const replacement = device(0x0bda, 0x2838, 'duplicate', 'RTL A')
    usb.dispatchEvent(Object.assign(new Event('connect'), { device: replacement }))

    expect(registry.get(firstSelection.id)).toMatchObject({
      device: replacement,
      connected: true,
      acquisitionOwner: 'page',
    })
    expect(registry.get(secondSelection.id)).toMatchObject({
      device: second,
      connected: true,
      acquisitionOwner: 'page',
    })
  })
})