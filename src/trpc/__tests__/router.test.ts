/**
 * tRPC Router Tests
 */

import { appRouter } from '../router';
import { createTRPCContext } from '../context';
import type { ISDRDevice } from '../../models/SDRDevice';
import { SDRDeviceType } from '../../models/SDRDevice';

describe('tRPC Router', () => {
  let mockDevice: jest.Mocked<ISDRDevice>;

  beforeEach(() => {
    mockDevice = {
      getDeviceInfo: jest.fn().mockResolvedValue({
        type: SDRDeviceType.HACKRF_ONE,
        vendorId: 0x1d50,
        productId: 0x6089,
        serialNumber: '0000000000000000',
        firmwareVersion: '2023.01.1',
        hardwareRevision: 'r9',
      }),
      getCapabilities: jest.fn().mockReturnValue({
        minFrequency: 1e6,
        maxFrequency: 6e9,
        supportedSampleRates: [8e6, 10e6, 12.5e6, 16e6, 20e6],
        maxLNAGain: 40,
        maxVGAGain: 62,
        supportsAmpControl: true,
        supportsAntennaControl: false,
        maxBandwidth: 20e6,
      }),
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      isOpen: jest.fn().mockReturnValue(true),
      setFrequency: jest.fn().mockResolvedValue(undefined),
      getFrequency: jest.fn().mockResolvedValue(100e6),
      setSampleRate: jest.fn().mockResolvedValue(undefined),
      getSampleRate: jest.fn().mockResolvedValue(20e6),
      getUsableBandwidth: jest.fn().mockResolvedValue(20e6),
      setLNAGain: jest.fn().mockResolvedValue(undefined),
      setVGAGain: jest.fn().mockResolvedValue(undefined),
      setAmpEnable: jest.fn().mockResolvedValue(undefined),
      setBandwidth: jest.fn().mockResolvedValue(undefined),
      receive: jest.fn().mockResolvedValue(undefined),
      stopRx: jest.fn().mockResolvedValue(undefined),
      isReceiving: jest.fn().mockReturnValue(false),
      parseSamples: jest.fn().mockReturnValue([]),
      getMemoryInfo: jest.fn().mockReturnValue({
        totalBufferSize: 1024 * 1024,
        usedBufferSize: 0,
        activeBuffers: 0,
        maxSamples: 1024,
        currentSamples: 0,
      }),
      clearBuffers: jest.fn(),
      reset: jest.fn().mockResolvedValue(undefined),
      fastRecovery: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ISDRDevice>;
  });

  describe('device procedures', () => {
    it('should get device info', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.device.getDeviceInfo();

      expect(result).toEqual({
        type: SDRDeviceType.HACKRF_ONE,
        vendorId: 0x1d50,
        productId: 0x6089,
        serialNumber: '0000000000000000',
        firmwareVersion: '2023.01.1',
        hardwareRevision: 'r9',
      });
      expect(mockDevice.getDeviceInfo).toHaveBeenCalled();
    });

    it('should get capabilities', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.device.getCapabilities();

      expect(result).toEqual({
        minFrequency: 1e6,
        maxFrequency: 6e9,
        supportedSampleRates: [8e6, 10e6, 12.5e6, 16e6, 20e6],
        maxLNAGain: 40,
        maxVGAGain: 62,
        supportsAmpControl: true,
        supportsAntennaControl: false,
        maxBandwidth: 20e6,
      });
      expect(mockDevice.getCapabilities).toHaveBeenCalled();
    });

    it('should open device', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.open();

      expect(mockDevice.open).toHaveBeenCalled();
    });

    it('should close device', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.close();

      expect(mockDevice.close).toHaveBeenCalled();
    });

    it('should check if device is open', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.device.isOpen();

      expect(result).toBe(true);
      expect(mockDevice.isOpen).toHaveBeenCalled();
    });

    it('should set frequency', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.setFrequency({ frequencyHz: 100e6 });

      expect(mockDevice.setFrequency).toHaveBeenCalledWith(100e6);
    });

    it('should get frequency', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.device.getFrequency();

      expect(result).toBe(100e6);
      expect(mockDevice.getFrequency).toHaveBeenCalled();
    });

    it('should set sample rate', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.setSampleRate({ sampleRateHz: 20e6 });

      expect(mockDevice.setSampleRate).toHaveBeenCalledWith(20e6);
    });

    it('should get sample rate', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.device.getSampleRate();

      expect(result).toBe(20e6);
      expect(mockDevice.getSampleRate).toHaveBeenCalled();
    });

    it('should get usable bandwidth', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.device.getUsableBandwidth();

      expect(result).toBe(20e6);
      expect(mockDevice.getUsableBandwidth).toHaveBeenCalled();
    });

    it('should set LNA gain', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.setLNAGain({ gainDb: 20 });

      expect(mockDevice.setLNAGain).toHaveBeenCalledWith(20);
    });

    it('should set VGA gain', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.setVGAGain({ gainDb: 30 });

      expect(mockDevice.setVGAGain).toHaveBeenCalledWith(30);
    });

    it('should set amplifier enable', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.setAmpEnable({ enabled: true });

      expect(mockDevice.setAmpEnable).toHaveBeenCalledWith(true);
    });

    it('should set bandwidth', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.setBandwidth({ bandwidthHz: 10e6 });

      expect(mockDevice.setBandwidth).toHaveBeenCalledWith(10e6);
    });

    it('should stop receiving', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.stopRx();

      expect(mockDevice.stopRx).toHaveBeenCalled();
    });

    it('should check if receiving', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.device.isReceiving();

      expect(result).toBe(false);
      expect(mockDevice.isReceiving).toHaveBeenCalled();
    });

    it('should get memory info', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.device.getMemoryInfo();

      expect(result).toEqual({
        totalBufferSize: 1024 * 1024,
        usedBufferSize: 0,
        activeBuffers: 0,
        maxSamples: 1024,
        currentSamples: 0,
      });
      expect(mockDevice.getMemoryInfo).toHaveBeenCalled();
    });

    it('should clear buffers', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.clearBuffers();

      expect(mockDevice.clearBuffers).toHaveBeenCalled();
    });

    it('should reset device', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.reset();

      expect(mockDevice.reset).toHaveBeenCalled();
    });

    it('should perform fast recovery', async () => {
      const ctx = createTRPCContext(mockDevice);
      const caller = appRouter.createCaller(ctx);

      await caller.device.fastRecovery();

      expect(mockDevice.fastRecovery).toHaveBeenCalled();
    });

    it('should throw error when device is not connected', async () => {
      const ctx = createTRPCContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.device.getDeviceInfo()).rejects.toThrow('No device connected');
    });

    it('should throw error when VGA gain is not supported', async () => {
      const deviceWithoutVGA = { ...mockDevice, setVGAGain: undefined };
      const ctx = createTRPCContext(deviceWithoutVGA as unknown as ISDRDevice);
      const caller = appRouter.createCaller(ctx);

      await expect(caller.device.setVGAGain({ gainDb: 30 })).rejects.toThrow(
        'Device does not support VGA gain control'
      );
    });

    it('should throw error when bandwidth control is not supported', async () => {
      const deviceWithoutBandwidth = { ...mockDevice, setBandwidth: undefined };
      const ctx = createTRPCContext(deviceWithoutBandwidth as unknown as ISDRDevice);
      const caller = appRouter.createCaller(ctx);

      await expect(caller.device.setBandwidth({ bandwidthHz: 10e6 })).rejects.toThrow(
        'Device does not support bandwidth control'
      );
    });

    it('should throw error when fast recovery is not supported', async () => {
      const deviceWithoutFastRecovery = { ...mockDevice, fastRecovery: undefined };
      const ctx = createTRPCContext(deviceWithoutFastRecovery as unknown as ISDRDevice);
      const caller = appRouter.createCaller(ctx);

      await expect(caller.device.fastRecovery()).rejects.toThrow(
        'Device does not support fast recovery'
      );
    });
  });
});
