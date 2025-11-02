/**
 * Example hook demonstrating tRPC usage for device operations
 * This shows how to use the type-safe tRPC client with React Query
 */

import { trpc } from '../trpc';

/**
 * Hook for device operations using tRPC
 * 
 * @example
 * ```tsx
 * function DeviceControl() {
 *   const { data: deviceInfo } = useDeviceInfo();
 *   const { data: capabilities } = useDeviceCapabilities();
 *   const setFrequency = useSetFrequency();
 *   
 *   return (
 *     <div>
 *       <h2>{deviceInfo?.type}</h2>
 *       <button onClick={() => setFrequency.mutate({ frequencyHz: 100e6 })}>
 *         Set to 100 MHz
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

/**
 * Query device information
 */
export function useDeviceInfo() {
  return trpc.device.getDeviceInfo.useQuery();
}

/**
 * Query device capabilities
 */
export function useDeviceCapabilities() {
  return trpc.device.getCapabilities.useQuery();
}

/**
 * Query if device is open
 */
export function useIsDeviceOpen() {
  return trpc.device.isOpen.useQuery();
}

/**
 * Query current frequency
 */
export function useCurrentFrequency() {
  return trpc.device.getFrequency.useQuery();
}

/**
 * Query current sample rate
 */
export function useCurrentSampleRate() {
  return trpc.device.getSampleRate.useQuery();
}

/**
 * Query usable bandwidth
 */
export function useUsableBandwidth() {
  return trpc.device.getUsableBandwidth.useQuery();
}

/**
 * Query if receiving
 */
export function useIsReceiving() {
  return trpc.device.isReceiving.useQuery();
}

/**
 * Query memory info
 */
export function useMemoryInfo() {
  return trpc.device.getMemoryInfo.useQuery();
}

/**
 * Mutation to open device
 */
export function useOpenDevice() {
  return trpc.device.open.useMutation();
}

/**
 * Mutation to close device
 */
export function useCloseDevice() {
  return trpc.device.close.useMutation();
}

/**
 * Mutation to set frequency
 */
export function useSetFrequency() {
  return trpc.device.setFrequency.useMutation();
}

/**
 * Mutation to set sample rate
 */
export function useSetSampleRate() {
  return trpc.device.setSampleRate.useMutation();
}

/**
 * Mutation to set LNA gain
 */
export function useSetLNAGain() {
  return trpc.device.setLNAGain.useMutation();
}

/**
 * Mutation to set VGA gain
 */
export function useSetVGAGain() {
  return trpc.device.setVGAGain.useMutation();
}

/**
 * Mutation to set amplifier enable
 */
export function useSetAmpEnable() {
  return trpc.device.setAmpEnable.useMutation();
}

/**
 * Mutation to set bandwidth
 */
export function useSetBandwidth() {
  return trpc.device.setBandwidth.useMutation();
}

/**
 * Mutation to stop receiving
 */
export function useStopRx() {
  return trpc.device.stopRx.useMutation();
}

/**
 * Mutation to clear buffers
 */
export function useClearBuffers() {
  return trpc.device.clearBuffers.useMutation();
}

/**
 * Mutation to reset device
 */
export function useResetDevice() {
  return trpc.device.reset.useMutation();
}

/**
 * Mutation to perform fast recovery
 */
export function useFastRecovery() {
  return trpc.device.fastRecovery.useMutation();
}
