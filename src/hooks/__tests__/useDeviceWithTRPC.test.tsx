/**
 * Tests for tRPC device hooks
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import React from 'react';
import { TRPCProvider } from '../../trpc/react';
import { useDeviceInfo, useSetFrequency } from '../useDeviceWithTRPC';
import type { ISDRDevice } from '../../models/SDRDevice';
import { SDRDeviceType } from '../../models/SDRDevice';

describe('useDeviceWithTRPC hooks', () => {
  let mockDevice: jest.Mocked<ISDRDevice>;
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockDevice = {
      getDeviceInfo: jest.fn().mockResolvedValue({
        type: SDRDeviceType.HACKRF_ONE,
        vendorId: 0x1d50,
        productId: 0x6089,
        serialNumber: '0000000000000000',
        firmwareVersion: '2023.01.1',
        hardwareRevision: 'r9',
      }),
      setFrequency: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ISDRDevice>;
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TRPCProvider device={mockDevice} queryClient={queryClient}>
      {children}
    </TRPCProvider>
  );

  describe('useDeviceInfo', () => {
    it('should fetch device info', async () => {
      const { result } = renderHook(() => useDeviceInfo(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({
        type: SDRDeviceType.HACKRF_ONE,
        vendorId: 0x1d50,
        productId: 0x6089,
        serialNumber: '0000000000000000',
        firmwareVersion: '2023.01.1',
        hardwareRevision: 'r9',
      });
      expect(mockDevice.getDeviceInfo).toHaveBeenCalled();
    });
  });

  describe('useSetFrequency', () => {
    it('should set frequency', async () => {
      const { result } = renderHook(() => useSetFrequency(), { wrapper });

      result.current.mutate({ frequencyHz: 100e6 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDevice.setFrequency).toHaveBeenCalledWith(100e6);
    });
  });
});
