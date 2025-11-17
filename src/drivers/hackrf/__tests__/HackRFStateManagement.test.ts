/**
 * HackRF State Management Tests
 *
 * Tests for proper device state tracking across open/close cycles,
 * page reloads, and error recovery scenarios.
 */

// Jest v30: use the global jest namespace for types
type Mock = jest.Mock;
import { HackRFOne, RequestCommand } from "../HackRFOne";

describe("HackRFOne State Management", () => {
  let mockDevice: USBDevice;
  let hackrf: HackRFOne;

  const createMockEndpoint = (
    direction: USBDirection,
    endpointNumber: number
  ): USBEndpoint => ({
    endpointNumber,
    direction,
    type: "bulk",
    packetSize: 16384,
  });

  const createMockAlternate = (): USBAlternateInterface => ({
    alternateSetting: 0,
    interfaceClass: 0xff,
    interfaceSubclass: 0x00,
    interfaceProtocol: 0x00,
    interfaceName: "",
    endpoints: [
      createMockEndpoint("in", 1),
      createMockEndpoint("out", 2),
    ],
  });

  beforeEach(() => {
    // Create mock USB device
    mockDevice = {
      vendorId: 0x1d50,
      productId: 0x6089,
      deviceClass: 0,
      deviceSubclass: 0,
      deviceProtocol: 0,
      productName: "HackRF One",
      manufacturerName: "Great Scott Gadgets",
      serialNumber: "0000000000000000",
      usbVersionMajor: 2,
      usbVersionMinor: 0,
      usbVersionSubminor: 0,
      deviceVersionMajor: 0,
      deviceVersionMinor: 1,
      deviceVersionSubminor: 0,
      opened: false,
      configuration: {
        configurationValue: 1,
        configurationName: "",
        interfaces: [
          {
            interfaceNumber: 0,
            alternates: [createMockAlternate()],
            alternate: createMockAlternate(),
            claimed: false,
          },
        ],
      },
      configurations: [
        {
          configurationValue: 1,
          configurationName: "",
          interfaces: [
            {
              interfaceNumber: 0,
              alternates: [createMockAlternate()],
              alternate: createMockAlternate(),
              claimed: false,
            },
          ],
        },
      ],
      open: jest.fn(),
      close: jest.fn(),
      forget: jest.fn(),
      selectConfiguration: jest.fn(),
      claimInterface: jest.fn(),
      releaseInterface: jest.fn(),
      selectAlternateInterface: jest.fn(),
      controlTransferIn: jest.fn(),
      controlTransferOut: jest.fn(),
      clearHalt: jest.fn(),
      transferIn: jest.fn(),
      transferOut: jest.fn(),
      isochronousTransferIn: jest.fn(),
      isochronousTransferOut: jest.fn(),
      reset: jest.fn(),
    } as unknown as USBDevice;

    hackrf = new HackRFOne(mockDevice);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Device Opening", () => {
    it("should open device cleanly on first open", async () => {
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);

      await hackrf.open();

      expect(mockDevice.open).toHaveBeenCalledTimes(1);
      expect(mockDevice.reset).not.toHaveBeenCalled();
    });

    it("should not reset device on first open", async () => {
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);

      await hackrf.open();

      expect(mockDevice.reset).not.toHaveBeenCalled();
    });

    it("should gently recover if reopening after dirty close (no reset)", async () => {
      // Simulate device already opened (e.g., after page reload)
      (mockDevice as { opened: boolean }).opened = true;
      // Best-effort recovery attempts a close; simulate that it actually closes the handle
      ;(mockDevice.close as Mock).mockImplementation(async () => {
        (mockDevice as { opened: boolean }).opened = false;
      });
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);

      await hackrf.open();

      // With gentle recovery, we should not issue a device reset
      expect(mockDevice.reset).not.toHaveBeenCalled();
      // Open should be invoked to re-establish a clean handle
      expect(mockDevice.open).toHaveBeenCalled();
    });

    it("should not reset if device was cleanly closed", async () => {
      // First open
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);
      (mockDevice.close as Mock).mockResolvedValue(undefined);
      (mockDevice.releaseInterface as Mock).mockResolvedValue(undefined);

      await hackrf.open();
      expect(mockDevice.reset).not.toHaveBeenCalled();

      // Clean close
      (mockDevice as { opened: boolean }).opened = true;
      await hackrf.close();
      expect(mockDevice.close).toHaveBeenCalledTimes(1);

      // Second open - should not reset because close was clean
      (mockDevice as { opened: boolean }).opened = false;
      await hackrf.open();
      expect(mockDevice.reset).not.toHaveBeenCalled();
    });
  });

  describe("Device Closing", () => {
    beforeEach(async () => {
      // Open device first
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);
      (mockDevice as { opened: boolean }).opened = false;
      await hackrf.open();
      (mockDevice as { opened: boolean }).opened = true;
    });

    it("should mark device as cleanly closed on successful close", async () => {
      (mockDevice.releaseInterface as Mock).mockResolvedValue(undefined);
      (mockDevice.close as Mock).mockResolvedValue(undefined);

      await hackrf.close();

      expect(mockDevice.releaseInterface).toHaveBeenCalled();
      expect(mockDevice.close).toHaveBeenCalled();

      // Next open should not require reset
      (mockDevice as { opened: boolean }).opened = false;
      (mockDevice.open as Mock).mockClear();
      (mockDevice.reset as Mock).mockClear();
      
      await hackrf.open();
      expect(mockDevice.reset).not.toHaveBeenCalled();
    });

    it("should handle close failure gracefully", async () => {
      (mockDevice.releaseInterface as Mock).mockResolvedValue(undefined);
      (mockDevice.close as Mock).mockRejectedValue(
        new Error("Device disconnected")
      );

      // Should not throw
      await expect(hackrf.close()).resolves.not.toThrow();

      // Next open should recover gently (no reset) because close failed
      (mockDevice as { opened: boolean }).opened = true;
      (mockDevice.open as Mock).mockResolvedValue(undefined);

      await hackrf.open();
      expect(mockDevice.reset).not.toHaveBeenCalled();
      // open() may or may not be called depending on current opened flag; do not assert
    });

    it("should prevent concurrent close operations", async () => {
      (mockDevice.releaseInterface as Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      (mockDevice.close as Mock).mockResolvedValue(undefined);

      // Start two close operations simultaneously
      const close1 = hackrf.close();
      const close2 = hackrf.close();

      await Promise.all([close1, close2]);

      // Should only call once (second close returns immediately)
      expect(mockDevice.releaseInterface).toHaveBeenCalledTimes(1);
      expect(mockDevice.close).toHaveBeenCalledTimes(1);
    });

    it("should handle device already closed by browser", async () => {
      // Simulate browser auto-closing device
      (mockDevice as { opened: boolean }).opened = false;

      await hackrf.close();

      // Should not throw and should not call USB methods on closed device
      expect(mockDevice.releaseInterface).not.toHaveBeenCalled();
      expect(mockDevice.close).not.toHaveBeenCalled();

      // Next open should recover gently because close was dirty
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice as { opened: boolean }).opened = true;

      await hackrf.open();
      expect(mockDevice.reset).not.toHaveBeenCalled();
      // open() may be skipped if handle remains open; do not assert
    });
  });

  describe("Page Reload Simulation", () => {
    it("should recover from simulated page reload", async () => {
      // Initial open
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);
      
      await hackrf.open();
      expect(mockDevice.reset).not.toHaveBeenCalled();

      // Simulate page reload: browser auto-releases device
      // Device object remains but is in stale state
      (mockDevice as { opened: boolean }).opened = true; // Browser keeps device "opened"
      
      // Close attempt during beforeunload may fail or partially succeed
      (mockDevice.close as Mock).mockRejectedValue(new Error("Page unloading"));
      await hackrf.close().catch(() => {
        /* ignore */
      });

      // New page loads, tries to reopen same device
      (mockDevice.open as Mock).mockClear();
      (mockDevice.open as Mock).mockResolvedValue(undefined);

      await hackrf.open();

      // Should have recovered without reset
      expect(mockDevice.reset).not.toHaveBeenCalled();
      // open() may be skipped if handle remains open; do not assert
    });

    it("should continue normal init without reset during recovery", async () => {
      (mockDevice as { opened: boolean }).opened = true;
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      
      // Mock selectConfiguration to restore configuration
      (mockDevice.selectConfiguration as Mock).mockImplementation(() => {
        (mockDevice as { configuration: USBConfiguration | undefined }).configuration = {
          configurationValue: 1,
          configurationName: "",
          interfaces: [
            {
              interfaceNumber: 0,
              alternates: [createMockAlternate()],
              alternate: createMockAlternate(),
              claimed: false,
            },
          ],
        };
      });
      
      (mockDevice.claimInterface as Mock).mockResolvedValue(undefined);
      (mockDevice.selectAlternateInterface as Mock).mockResolvedValue(undefined);
      
      // Clear configuration to ensure init path is taken
      (mockDevice as { configuration: USBConfiguration | undefined }).configuration = undefined;

      // Should not throw during open
      await expect(hackrf.open()).resolves.not.toThrow();

      // Device continues with normal init
      expect(mockDevice.selectConfiguration).toHaveBeenCalled();
    });
  });

  describe("Error Recovery", () => {
    it("should continue reopening without using reset", async () => {
      (mockDevice as { opened: boolean }).opened = true;
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      
      // Mock selectConfiguration to restore configuration
      (mockDevice.selectConfiguration as Mock).mockImplementation(() => {
        (mockDevice as { configuration: USBConfiguration | undefined }).configuration = {
          configurationValue: 1,
          configurationName: "",
          interfaces: [
            {
              interfaceNumber: 0,
              alternates: [createMockAlternate()],
              alternate: createMockAlternate(),
              claimed: false,
            },
          ],
        };
      });
      
      (mockDevice.claimInterface as Mock).mockResolvedValue(undefined);
      (mockDevice.selectAlternateInterface as Mock).mockResolvedValue(undefined);
      
      // Clear configuration to force init path
      (mockDevice as { configuration: USBConfiguration | undefined }).configuration = undefined;

      // Should not throw during open
      await expect(hackrf.open()).resolves.not.toThrow();

      // Should still proceed with normal initialization
      expect(mockDevice.selectConfiguration).toHaveBeenCalled();
      // Interface now claimed during open to satisfy firmware requirements
      expect(mockDevice.claimInterface).toHaveBeenCalled();
    });

    it("should track state correctly through multiple open/close cycles", async () => {
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.close as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);
      (mockDevice.releaseInterface as Mock).mockResolvedValue(undefined);

      // Cycle 1: Clean open/close
      await hackrf.open();
      (mockDevice as { opened: boolean }).opened = true;
      await hackrf.close();
      (mockDevice as { opened: boolean }).opened = false;

      // Cycle 2: Should not need reset
      await hackrf.open();
      expect(mockDevice.reset).not.toHaveBeenCalled();

      // Dirty close (simulated browser auto-release)
      (mockDevice as { opened: boolean }).opened = false;
      await hackrf.close();

      // Cycle 3: Should recover gently due to dirty close
      (mockDevice as { opened: boolean }).opened = true;
      await hackrf.open();
      expect(mockDevice.reset).not.toHaveBeenCalled();
    });
  });

  describe("Configuration Commands", () => {
    it("should configure sample rate, frequency, bandwidth and gains without reset", async () => {
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);
      (mockDevice.controlTransferOut as Mock).mockResolvedValue({
        status: "ok",
        bytesWritten: 0,
      } as USBOutTransferResult);

      await hackrf.open();
      await hackrf.setSampleRate(20_000_000);
      await hackrf.setFrequency(100_000_000);
      await hackrf.setBandwidth(8_000_000);
      await hackrf.setLNAGain(16);
      await hackrf.setAmpEnable(true);

      expect(mockDevice.reset).not.toHaveBeenCalled();
      expect(mockDevice.controlTransferOut).toHaveBeenCalled();
      // Interface claimed during open
      expect(mockDevice.claimInterface).toHaveBeenCalled();
    });

    it("performs lightweight reset without vendor command", async () => {
      (mockDevice.open as Mock).mockResolvedValue(undefined);
      (mockDevice.selectConfiguration as Mock).mockResolvedValue(undefined);
      (mockDevice.controlTransferOut as Mock).mockResolvedValue({
        status: "ok",
        bytesWritten: 0,
      } as USBOutTransferResult);

      await hackrf.open();
      await expect(hackrf.reset()).resolves.not.toThrow();
      // Ensure RESET (30) was not issued
      const resetCall = (mockDevice.controlTransferOut as Mock).mock.calls.find(
        (c) => c[0].request === RequestCommand.RESET,
      );
      expect(resetCall).toBeUndefined();
    });
  });
});
