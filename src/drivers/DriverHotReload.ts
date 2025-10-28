/**
 * Driver Hot Reload Utilities
 *
 * Provides runtime driver registration and unregistration capabilities,
 * enabling dynamic driver updates without application restart.
 */

import {
  SDRDriverRegistry,
  type SDRDriverRegistration,
} from "./SDRDriverRegistry";

/**
 * Result of a hot reload operation
 */
export interface HotReloadResult {
  /** Whether the operation was successful */
  success: boolean;

  /** Driver ID that was reloaded */
  driverId: string;

  /** Previous driver registration (if any) */
  previousDriver?: SDRDriverRegistration;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Options for hot reload operations
 */
export interface HotReloadOptions {
  /** Whether to force reload even if driver is currently in use */
  force?: boolean;

  /** Callback invoked before unloading old driver */
  beforeUnload?: (driverId: string) => void;

  /** Callback invoked after loading new driver */
  afterLoad?: (driverId: string) => void;
}

/**
 * Driver Hot Reload Manager
 *
 * Enables runtime driver updates without application restart. Useful for:
 * - Development and testing of new drivers
 * - Updating driver versions without redeployment
 * - A/B testing different driver implementations
 *
 * Example usage:
 * ```typescript
 * const hotReload = new DriverHotReload();
 *
 * // Reload a specific driver
 * const result = await hotReload.reloadDriver("hackrf-one", newDriverRegistration);
 *
 * if (result.success) {
 *   console.log("Driver reloaded successfully");
 * }
 * ```
 */
export class DriverHotReload {
  /**
   * Reload a driver with a new registration
   *
   * Unregisters the existing driver (if present) and registers the new one.
   * This allows updating driver implementations at runtime.
   *
   * @param driverId - ID of the driver to reload
   * @param newRegistration - New driver registration
   * @param options - Hot reload options
   * @returns Result of the reload operation
   */
  reloadDriver(
    driverId: string,
    newRegistration: SDRDriverRegistration,
    options: HotReloadOptions = {},
  ): HotReloadResult {
    const result: HotReloadResult = {
      success: false,
      driverId,
    };

    try {
      // Validate that registration ID matches the driver ID
      if (newRegistration.metadata.id !== driverId) {
        result.error = `Registration ID "${newRegistration.metadata.id}" does not match driver ID "${driverId}"`;
        return result;
      }

      // Check if driver exists
      const existingMetadata = SDRDriverRegistry.getDriverMetadata(driverId);

      if (existingMetadata) {
        // Driver exists, need to unregister first
        result.previousDriver = SDRDriverRegistry.getAllDrivers().find(
          (d) => d.metadata.id === driverId,
        );

        // Invoke beforeUnload callback
        if (options.beforeUnload) {
          options.beforeUnload(driverId);
        }

        // Unregister old driver
        const unregistered = SDRDriverRegistry.unregister(driverId);

        if (!unregistered) {
          result.error = `Failed to unregister existing driver "${driverId}"`;
          return result;
        }
      }

      // Register new driver
      SDRDriverRegistry.register(newRegistration);

      // Invoke afterLoad callback
      if (options.afterLoad) {
        options.afterLoad(driverId);
      }

      result.success = true;
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : String(error);

      // Try to restore previous driver if reload failed
      if (result.previousDriver) {
        try {
          SDRDriverRegistry.register(result.previousDriver);
        } catch (restoreError: unknown) {
          const errorMsg =
            restoreError instanceof Error
              ? restoreError.message
              : String(restoreError);
          result.error += ` | Failed to restore previous driver: ${errorMsg}`;
        }
      }
    }

    return result;
  }

  /**
   * Unload a driver
   *
   * Removes a driver from the registry. Use with caution as this may break
   * existing code that relies on the driver.
   *
   * @param driverId - ID of the driver to unload
   * @param options - Hot reload options
   * @returns Result of the unload operation
   */
  unloadDriver(
    driverId: string,
    options: HotReloadOptions = {},
  ): HotReloadResult {
    const result: HotReloadResult = {
      success: false,
      driverId,
    };

    try {
      // Get driver before unloading
      result.previousDriver = SDRDriverRegistry.getAllDrivers().find(
        (d) => d.metadata.id === driverId,
      );

      if (!result.previousDriver) {
        result.error = `Driver "${driverId}" not found`;
        return result;
      }

      // Invoke beforeUnload callback
      if (options.beforeUnload) {
        options.beforeUnload(driverId);
      }

      // Unregister driver
      const unregistered = SDRDriverRegistry.unregister(driverId);

      if (!unregistered) {
        result.error = `Failed to unregister driver "${driverId}"`;
        return result;
      }

      result.success = true;
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Get list of all currently loaded drivers
   *
   * @returns Array of driver IDs
   */
  getLoadedDrivers(): string[] {
    return SDRDriverRegistry.getAllDrivers().map((d) => d.metadata.id);
  }

  /**
   * Check if a driver is currently loaded
   *
   * @param driverId - ID of the driver to check
   * @returns true if driver is loaded
   */
  isDriverLoaded(driverId: string): boolean {
    return SDRDriverRegistry.getDriverMetadata(driverId) !== undefined;
  }

  /**
   * Reload all drivers
   *
   * Useful for bulk updates or development scenarios.
   *
   * @param newDrivers - Map of driver IDs to new registrations
   * @param options - Hot reload options
   * @returns Array of results for each driver
   */
  reloadAllDrivers(
    newDrivers: Map<string, SDRDriverRegistration>,
    options: HotReloadOptions = {},
  ): HotReloadResult[] {
    const results: HotReloadResult[] = [];

    for (const [driverId, registration] of newDrivers) {
      results.push(this.reloadDriver(driverId, registration, options));
    }

    return results;
  }
}
