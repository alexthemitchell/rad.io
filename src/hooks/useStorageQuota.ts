import { useEffect, useState } from "react";

export interface StorageQuotaInfo {
  usage: number; // bytes used
  quota: number; // bytes total
  percentUsed: number; // 0-100
  available: number; // bytes available
  supported: boolean; // whether StorageManager API is available
}

/**
 * Hook to monitor browser storage quota using StorageManager API.
 * Polls storage estimate every 10 seconds to keep data fresh.
 *
 * Returns storage usage information with 85% threshold warning support per PRD.
 *
 * @example
 * ```tsx
 * const storage = useStorageQuota();
 * if (storage.supported && storage.percentUsed > 85) {
 *   // Show warning
 * }
 * ```
 */
export function useStorageQuota(): StorageQuotaInfo {
  const [usage, setUsage] = useState<number>(0);
  const [quota, setQuota] = useState<number>(0);
  const [supported, setSupported] = useState<boolean>(false);

  useEffect(() => {
    // Check if StorageManager API is supported
    const isSupported =
      typeof navigator !== "undefined" &&
      "storage" in navigator &&
      typeof navigator.storage.estimate === "function";

    setSupported(isSupported);

    if (!isSupported) {
      return;
    }

    const updateStorageInfo = async (): Promise<void> => {
      try {
        const estimate = await navigator.storage.estimate();
        setUsage(estimate.usage ?? 0);
        setQuota(estimate.quota ?? 0);
      } catch {
        // Silently fail if estimate() throws
        setSupported(false);
      }
    };

    // Initial fetch
    void updateStorageInfo();

    // Poll every 10 seconds (consistent with useStatusMetrics)
    const intervalId = setInterval(() => {
      void updateStorageInfo();
    }, 10000);

    return (): void => {
      clearInterval(intervalId);
    };
  }, []);

  const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
  const available = quota > 0 ? Math.max(0, quota - usage) : 0;

  return {
    usage,
    quota,
    percentUsed,
    available,
    supported,
  };
}
