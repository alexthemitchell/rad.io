/**
 * Additional tests derived from reference libhackrf implementation (hackrf.c).
 *
 * These focus on parameter validation and value quantization behaviors that
 * are explicitly guarded in libhackrf but were not yet covered here.
 */

import { HackRFOne } from "../HackRFOne";
import { createMockUSBDevice } from "./helpers/mockUSBDevice";

describe("HackRFOne frequency and sample-rate guards (libhackrf parity)", () => {
  it("rejects 0 Hz center frequency like libhackrf_set_freq", async () => {
    const { device } = createMockUSBDevice();
    const hackrf = new HackRFOne(device);

    await expect(hackrf.setFrequency(0)).rejects.toThrow(/out of range/i);
  });

  it("rejects negative center frequency", async () => {
    const { device } = createMockUSBDevice();
    const hackrf = new HackRFOne(device);

    await expect(hackrf.setFrequency(-100)).rejects.toThrow(/out of range/i);
  });

  it("rejects non-finite frequency values", async () => {
    const { device } = createMockUSBDevice();
    const hackrf = new HackRFOne(device);

    await expect(hackrf.setFrequency(Number.NaN)).rejects.toThrow(
      /non-negative finite number/,
    );
    await expect(
      hackrf.setFrequency(Number.POSITIVE_INFINITY),
    ).rejects.toThrow(/out of range/i);
  });

  it("rejects non-finite sample rates", async () => {
    const { device } = createMockUSBDevice();
    const hackrf = new HackRFOne(device);

    await expect(hackrf.setSampleRate(Number.NaN)).rejects.toThrow(
      /positive finite number/,
    );
    await expect(
      hackrf.setSampleRate(Number.NEGATIVE_INFINITY),
    ).rejects.toThrow(/out of range/i);
  });

  it("rejects sample rates outside libhackrf nominal range (2-20 MSPS)", async () => {
    const { device } = createMockUSBDevice();
    const hackrf = new HackRFOne(device);

    await expect(hackrf.setSampleRate(1_000_000)).rejects.toThrow(/out of range/);
    await expect(hackrf.setSampleRate(30_000_000)).rejects.toThrow(/out of range/);
  });

  it("accepts in-range sample rates and quantizes to uint32+divider like hackrf_set_sample_rate", async () => {
    const { device } = createMockUSBDevice();
    const hackrf = new HackRFOne(device);

    // We deliberately use a fractional rate that requires divider > 1,
    // mirroring hackrf_set_sample_rate's rational approximation logic.
    const target = 2_048_000; // 2.048 MSPS common rate
    await hackrf.setSampleRate(target);

    const mock = device.controlTransferOut as jest.Mock;
    const calls = mock.mock.calls.filter(([opts]) => opts.request === 6);
    expect(calls.length).toBeGreaterThan(0);
    const [, payload] = calls[0];
    const view = new DataView(payload as ArrayBuffer);
    const freq = view.getUint32(0, true);
    const divider = view.getUint32(4, true);
    // Must yield something close to target when divided
    expect(divider).toBeGreaterThanOrEqual(1);
    expect(divider).toBeLessThanOrEqual(32);
    expect(freq / divider).toBeCloseTo(target, -2); // within ~100 Hz
  });
});
