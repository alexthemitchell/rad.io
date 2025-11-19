/**
 * Unit tests for HackRFOne control transfer formatting.
 */

import { HackRFOne } from "../HackRFOne";
import { VendorRequest } from "../constants";
import { createMockUSBDevice } from "../test-helpers/mockUSBDevice";

describe("HackRFOne control formatting", () => {
  it("formats frequency command per HackRF protocol", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const frequency = 123_456_789; // Hz

    await hackRF.setFrequency(frequency);

    expect(controlTransferOut).toHaveBeenCalledTimes(1);
    const [options, data] = controlTransferOut.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      requestType: "vendor",
      recipient: "device",
      request: VendorRequest.SET_FREQ,
    });
    expect(data).toBeInstanceOf(ArrayBuffer);

    const view = new DataView(data as ArrayBuffer);
    expect(view.getUint32(0, true)).toBe(123);
    expect(view.getUint32(4, true)).toBe(456_789);
  });

  it("formats sample rate with divider", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const sampleRate = 12_500_000; // Hz

    await hackRF.setSampleRate(sampleRate);

    // There may be a preceding SET_TRANSCEIVER_MODE(OFF) call; instead of
    // asserting exact call count, verify that a SAMPLE_RATE_SET control with
    // the expected payload was issued.
    const matching = controlTransferOut.mock.calls.filter(
      ([opts]) => (opts?.request as number) === VendorRequest.SAMPLE_RATE_SET,
    );
    expect(matching.length).toBeGreaterThanOrEqual(1);
    const [, data] = matching[0] ?? [];
    expect(data).toBeInstanceOf(ArrayBuffer);

    const view = new DataView(data as ArrayBuffer);
    expect(view.getUint32(0, true)).toBe(12_500_000);
    expect(view.getUint32(4, true)).toBe(1);
  });

  it("splits bandwidth into value/index words", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const bandwidth = 20_000_000; // Hz

    await hackRF.setBandwidth(bandwidth);

    expect(controlTransferOut).toHaveBeenCalledTimes(1);
    const [options, data] = controlTransferOut.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      request: VendorRequest.BASEBAND_FILTER_BANDWIDTH_SET,
      value: bandwidth & 0xffff,
      index: bandwidth >>> 16,
    });
    expect(data).toBeUndefined();
  });

  it("throws error when receive() called without sample rate", async () => {
    // Per HackRF requirements, sample rate MUST be configured before streaming
    // Reference: https://github.com/greatscottgadgets/hackrf/wiki/HackRF-One
    // Without sample rate, the device will hang in transferIn() waiting for data
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    // Try to receive without setting sample rate first
    await expect(hackRF.receive()).rejects.toThrow(
      /Sample rate not configured/,
    );

    // Verify the error message includes helpful guidance
    let errorCaught = false;
    try {
      await hackRF.receive();
    } catch (error) {
      errorCaught = true;
      const err = error as Error;
      expect(err.message).toContain("setSampleRate()");
      expect(err.message).toContain("transferIn()");
      expect(err.message).toContain("hang");
    }
    expect(errorCaught).toBe(true);
  });

  it("allows receive() after sample rate is configured", async () => {
    const { device, controlTransferOut } = createMockUSBDevice({
      transferInScript: ["success", "stall"],
    });
    const hackRF = new HackRFOne(device);

    // Set sample rate first (required)
    await hackRF.setSampleRate(20_000_000);

    // Start receive in background
    const receivePromise = hackRF.receive();

    // Give it time to start and process one buffer
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify that transceiver mode was set to RECEIVE
    const setTransceiverCalls = controlTransferOut.mock.calls.filter(
      (call) => call[0].request === VendorRequest.SET_TRANSCEIVER_MODE,
    );
    expect(setTransceiverCalls.length).toBeGreaterThan(0);
    // The driver may set OFF before switching to RECEIVE; assert the last
    // mode command is RECEIVE rather than the first.
    const lastModeCall = [...setTransceiverCalls]
      .reverse()
      .find(
        ([opts]) =>
          (opts?.request as number) === VendorRequest.SET_TRANSCEIVER_MODE,
      );
    expect(lastModeCall?.[0]).toMatchObject({
      request: VendorRequest.SET_TRANSCEIVER_MODE,
      value: 1, // RECEIVE mode
    });

    // Stop the receive loop
    await hackRF.stopRx();

    // Wait for the promise to complete
    await expect(receivePromise).resolves.toBeUndefined();
  });

  it("validates sample rate range", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    // Too low
    await expect(hackRF.setSampleRate(1_000_000)).rejects.toThrow(
      /out of range/,
    );

    // Too high
    await expect(hackRF.setSampleRate(30_000_000)).rejects.toThrow(
      /out of range/,
    );

    // Valid range (2-20 MSPS)
    await expect(hackRF.setSampleRate(10_000_000)).resolves.toBeUndefined();
  });

  it("validates frequency range", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    // Too low (< 1 MHz)
    await expect(hackRF.setFrequency(500_000)).rejects.toThrow(/out of range/);

    // Too high (> 6 GHz)
    await expect(hackRF.setFrequency(7_000_000_000)).rejects.toThrow(
      /out of range/,
    );

    // Valid range
    await expect(hackRF.setFrequency(100_000_000)).resolves.toBeUndefined();
  });

  it("sets bandwidth correctly", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const bandwidth = 10_000_000; // 10 MHz

    await hackRF.setBandwidth(bandwidth);

    expect(controlTransferOut).toHaveBeenCalledWith(
      expect.objectContaining({
        request: VendorRequest.BASEBAND_FILTER_BANDWIDTH_SET,
        value: bandwidth & 0xffff,
        index: bandwidth >>> 16,
      }),
      undefined,
    );
  });

  it("sets LNA gain correctly", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    await hackRF.setLNAGain(24);

    expect(controlTransferOut).toHaveBeenCalledWith(
      expect.objectContaining({
        request: VendorRequest.SET_LNA_GAIN,
        value: 24,
      }),
      undefined,
    );
  });

  it("sets amp enable correctly", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    await hackRF.setAmpEnable(true);

    expect(controlTransferOut).toHaveBeenCalledWith(
      expect.objectContaining({
        request: VendorRequest.AMP_ENABLE,
        value: 1,
      }),
      undefined,
    );

    await hackRF.setAmpEnable(false);

    expect(controlTransferOut).toHaveBeenCalledWith(
      expect.objectContaining({
        request: VendorRequest.AMP_ENABLE,
        value: 0,
      }),
      undefined,
    );
  });

  it("stops receive correctly", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    await expect(hackRF.stopRx()).resolves.toBeUndefined();
  });

  it("returns memory info", () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    const memInfo = hackRF.getMemoryInfo();

    expect(memInfo).toHaveProperty("totalBufferSize");
    expect(memInfo).toHaveProperty("usedBufferSize");
    expect(memInfo).toHaveProperty("activeBuffers");
  });

  it("clears buffers", () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    expect(() => hackRF.clearBuffers()).not.toThrow();
  });

  it("resets device", async () => {
    const { device, controlTransferOut } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);

    await hackRF.reset();
    // Reset no longer issues vendor RESET; ensure no request 30 was sent.
    const resetCall = (controlTransferOut as jest.Mock).mock.calls.find(
      (call) => call[0].request === VendorRequest.RESET,
    );
    expect(resetCall).toBeUndefined();
  });

  it("logs configuration in development mode for setSampleRate", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const originalEnv = process.env["NODE_ENV"];
    const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

    try {
      process.env["NODE_ENV"] = "development";
      await hackRF.setSampleRate(10_000_000);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("setSampleRate"),
        expect.objectContaining({
          sampleRate: 10_000_000,
          sampleRateMSPS: "10.000",
        }),
      );
    } finally {
      process.env["NODE_ENV"] = originalEnv;
      consoleSpy.mockRestore();
    }
  });

  it("logs configuration in development mode for setFrequency", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const originalEnv = process.env["NODE_ENV"];
    const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

    try {
      process.env["NODE_ENV"] = "development";
      await hackRF.setFrequency(100_000_000);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("setFrequency"),
        expect.objectContaining({
          frequency: 100_000_000,
          frequencyMHz: "100.000",
        }),
      );
    } finally {
      process.env["NODE_ENV"] = originalEnv;
      consoleSpy.mockRestore();
    }
  });

  it("does not log in non-development mode", async () => {
    const { device } = createMockUSBDevice();
    const hackRF = new HackRFOne(device);
    const originalEnv = process.env["NODE_ENV"];
    const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

    try {
      process.env["NODE_ENV"] = "production";
      await hackRF.setSampleRate(10_000_000);
      await hackRF.setFrequency(100_000_000);

      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      process.env["NODE_ENV"] = originalEnv;
      consoleSpy.mockRestore();
    }
  });
});
