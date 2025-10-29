/**
 * Plugin Registry Implementation
 *
 * Central registry for managing plugin lifecycle and discovery.
 */

import type {
  Plugin,
  PluginRegistry as IPluginRegistry,
  PluginEventListener,
  PluginEventData,
  PluginEvent,
  PluginState,
  PluginType,
} from "../types/plugin";

/**
 * Plugin registry implementation
 */
export class PluginRegistry implements IPluginRegistry {
  private plugins: Map<string, Plugin>;
  private listeners: Set<PluginEventListener>;

  constructor() {
    this.plugins = new Map();
    this.listeners = new Set();
  }

  /**
   * Register a plugin in the registry
   */
  async register(plugin: Plugin): Promise<void> {
    const { id } = plugin.metadata;

    if (this.plugins.has(id)) {
      throw new Error(`Plugin with ID '${id}' is already registered`);
    }

    // Validate dependencies
    if (plugin.metadata.dependencies) {
      for (const depId of plugin.metadata.dependencies) {
        if (!this.plugins.has(depId)) {
          throw new Error(
            `Plugin '${id}' depends on '${depId}' which is not registered`,
          );
        }
      }
    }

    try {
      // Initialize the plugin
      await plugin.initialize();

      // Store the plugin
      this.plugins.set(id, plugin);

      // Emit registration event
      this.emitEvent({
        plugin,
        event: "registered" as PluginEvent,
        timestamp: Date.now(),
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize plugin '${id}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Unregister a plugin from the registry
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error(`Plugin '${pluginId}' is not registered`);
    }

    // Check if other plugins depend on this one
    const dependents = Array.from(this.plugins.values()).filter((p) =>
      p.metadata.dependencies?.includes(pluginId),
    );

    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister plugin '${pluginId}': ${dependents.length} plugin(s) depend on it`,
      );
    }

    try {
      // Deactivate if active
      if (plugin.state === ("active" as PluginState)) {
        await plugin.deactivate();
      }

      // Dispose the plugin
      await plugin.dispose();

      // Remove from registry
      this.plugins.delete(pluginId);

      // Emit unregistration event
      this.emitEvent({
        plugin,
        event: "unregistered" as PluginEvent,
        timestamp: Date.now(),
      });
    } catch (error) {
      throw new Error(
        `Failed to unregister plugin '${pluginId}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by type
   */
  getPluginsByType(type: PluginType): Plugin[] {
    return Array.from(this.plugins.values()).filter(
      (plugin) => plugin.metadata.type === type,
    );
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Add an event listener
   */
  addEventListener(listener: PluginEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: PluginEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Clear all plugins
   */
  async clear(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys());

    // Unregister all plugins in reverse order to handle dependencies
    for (const id of pluginIds.reverse()) {
      await this.unregister(id);
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(eventData: PluginEventData): void {
    for (const listener of this.listeners) {
      try {
        listener(eventData);
      } catch (error) {
        console.error("Error in plugin event listener:", error);
      }
    }
  }
}

/**
 * Global plugin registry instance
 */
export const pluginRegistry = new PluginRegistry();
