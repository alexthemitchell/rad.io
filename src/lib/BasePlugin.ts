/**
 * Base Plugin Implementation
 *
 * Abstract base class that provides common plugin functionality.
 * Plugin developers can extend this class to create new plugins.
 */

import { PluginState as PluginStateEnum } from "../types/plugin";
import type {
  Plugin,
  PluginMetadata,
  PluginState,
  PluginConfigSchema,
} from "../types/plugin";

/**
 * Abstract base plugin class
 */
export abstract class BasePlugin implements Plugin {
  private _state: PluginState;
  protected config: Record<string, unknown>;

  constructor(public readonly metadata: PluginMetadata) {
    this._state = PluginStateEnum.REGISTERED;
    this.config = {};
  }

  /**
   * Get current plugin state
   */
  get state(): PluginState {
    return this._state;
  }

  /**
   * Update plugin state
   */
  protected setState(newState: PluginState): void {
    this._state = newState;
  }

  /**
   * Initialize the plugin
   * Override this method to perform plugin-specific initialization
   */
  async initialize(): Promise<void> {
    try {
      await this.onInitialize();
      this.setState(PluginStateEnum.INITIALIZED);
    } catch (error) {
      this.setState(PluginStateEnum.ERROR);
      throw error;
    }
  }

  /**
   * Activate the plugin
   * Override this method to start plugin functionality
   */
  async activate(): Promise<void> {
    if (this._state !== PluginStateEnum.INITIALIZED) {
      throw new Error(
        `Cannot activate plugin in state: ${this._state}. Must be initialized first.`,
      );
    }

    try {
      await this.onActivate();
      this.setState(PluginStateEnum.ACTIVE);
    } catch (error) {
      this.setState(PluginStateEnum.ERROR);
      throw error;
    }
  }

  /**
   * Deactivate the plugin
   * Override this method to stop plugin functionality
   */
  async deactivate(): Promise<void> {
    if (this._state !== PluginStateEnum.ACTIVE) {
      return; // Already deactivated
    }

    try {
      await this.onDeactivate();
      this.setState(PluginStateEnum.INITIALIZED);
    } catch (error) {
      this.setState(PluginStateEnum.ERROR);
      throw error;
    }
  }

  /**
   * Dispose plugin resources
   * Override this method to clean up plugin resources
   */
  async dispose(): Promise<void> {
    try {
      if (this._state === PluginStateEnum.ACTIVE) {
        await this.deactivate();
      }
      await this.onDispose();
    } catch (error) {
      this.setState(PluginStateEnum.ERROR);
      throw error;
    }
  }

  /**
   * Get plugin configuration schema
   * Override to provide custom configuration schema
   */
  getConfigSchema?(): PluginConfigSchema;

  /**
   * Update plugin configuration
   * Override to handle configuration updates
   */
  async updateConfig(config: Record<string, unknown>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.onConfigUpdate(config);
  }

  /**
   * Hook called during initialization
   * Override this in subclasses
   */
  protected abstract onInitialize(): void | Promise<void>;

  /**
   * Hook called during activation
   * Override this in subclasses
   */
  protected abstract onActivate(): void | Promise<void>;

  /**
   * Hook called during deactivation
   * Override this in subclasses
   */
  protected abstract onDeactivate(): void | Promise<void>;

  /**
   * Hook called during disposal
   * Override this in subclasses
   */
  protected abstract onDispose(): void | Promise<void>;

  /**
   * Hook called when configuration is updated
   * Override this in subclasses if configuration is supported
   */
  protected onConfigUpdate(
    config: Record<string, unknown>,
  ): void | Promise<void> {
    // Default implementation does nothing
    void config;
  }
}
