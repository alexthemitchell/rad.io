/**
 * Plugin Registry Implementation
 *
 * Central registry for managing plugin lifecycle and discovery.
 */

import { PluginEvent, PluginState } from "../types/plugin";
import type {
  Plugin,
  PluginRegistry as IPluginRegistry,
  PluginEventListener,
  PluginEventData,
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
        event: PluginEvent.REGISTERED,
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
      if (plugin.state === PluginState.ACTIVE) {
        await plugin.deactivate();
      }

      // Dispose the plugin
      await plugin.dispose();

      // Remove from registry
      this.plugins.delete(pluginId);

      // Emit unregistration event
      this.emitEvent({
        plugin,
        event: PluginEvent.UNREGISTERED,
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
   * Topologically sort plugin IDs so that dependents come before dependencies.
   * Throws an error if there is a cyclic dependency.
   */
  private getTopologicalPluginOrder(): string[] {
    // Build dependency graph: pluginId -> Set of dependencies
    const graph = new Map<string, Set<string>>();
    for (const [id, plugin] of this.plugins.entries()) {
      graph.set(id, new Set(plugin.metadata.dependencies ?? []));
    }

    // Kahn's algorithm for topological sort
    const sorted: string[] = [];
    const noDeps: string[] = Array.from(graph.entries())
      .filter(([, deps]) => deps.size === 0)
      .map(([id]) => id);

    const graphCopy = new Map<string, Set<string>>(
      Array.from(graph.entries()).map(([id, deps]) => [id, new Set(deps)]),
    );

    while (noDeps.length > 0) {
      const id = noDeps.pop();
      if (!id) {
        break;
      }
      sorted.push(id);
      for (const [otherId, deps] of graphCopy.entries()) {
        if (deps.has(id)) {
          deps.delete(id);
          if (deps.size === 0) {
            noDeps.push(otherId);
          }
        }
      }
      graphCopy.delete(id);
    }

    if (graphCopy.size > 0) {
      throw new Error(
        "Cyclic plugin dependencies detected; cannot clear registry safely.",
      );
    }
    return sorted.reverse(); // dependents before dependencies
  }

  /**
   * Clear all plugins
   */
  async clear(): Promise<void> {
    const pluginIds = this.getTopologicalPluginOrder();
    for (const id of pluginIds) {
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
