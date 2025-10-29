/**
 * Plugin System Type Definitions
 *
 * This module defines the core plugin architecture for rad.io.
 * It provides interfaces for creating extensible SDR features including
 * demodulators, visualizations, and device drivers.
 */

import type { ISDRDevice, IQSample } from "../models/SDRDevice";
import type { DataSource } from "../visualization/interfaces";

/**
 * Plugin metadata and lifecycle information
 */
export interface PluginMetadata {
  /** Unique identifier for the plugin */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Plugin version (semver format) */
  version: string;

  /** Plugin author information */
  author: string;

  /** Brief description of plugin functionality */
  description: string;

  /** Plugin type category */
  type: PluginType;

  /** Optional homepage or documentation URL */
  homepage?: string;

  /** Plugin dependencies (other plugin IDs required) */
  dependencies?: string[];

  /** Minimum rad.io version required */
  minRadioVersion?: string;
}

/**
 * Plugin types supported by the system
 */
export enum PluginType {
  /** Signal demodulator plugin */
  DEMODULATOR = "demodulator",

  /** Visualization component plugin */
  VISUALIZATION = "visualization",

  /** SDR device driver plugin */
  DEVICE_DRIVER = "device-driver",

  /** General utility/integration plugin */
  UTILITY = "utility",
}

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  /** Plugin is registered but not initialized */
  REGISTERED = "registered",

  /** Plugin is initialized and ready */
  INITIALIZED = "initialized",

  /** Plugin is currently active/running */
  ACTIVE = "active",

  /** Plugin encountered an error */
  ERROR = "error",

  /** Plugin is disabled */
  DISABLED = "disabled",
}

/**
 * Base plugin interface that all plugins must implement
 */
export interface Plugin {
  /** Plugin metadata */
  readonly metadata: PluginMetadata;

  /** Current plugin state */
  readonly state: PluginState;

  /**
   * Initialize the plugin
   * Called once when the plugin is registered
   */
  initialize(): Promise<void>;

  /**
   * Activate the plugin
   * Called when the plugin should start its functionality
   */
  activate(): Promise<void>;

  /**
   * Deactivate the plugin
   * Called when the plugin should stop its functionality
   */
  deactivate(): Promise<void>;

  /**
   * Clean up plugin resources
   * Called when the plugin is being unloaded
   */
  dispose(): Promise<void>;

  /**
   * Get plugin configuration schema (optional)
   */
  getConfigSchema?(): PluginConfigSchema;

  /**
   * Update plugin configuration (optional)
   */
  updateConfig?(config: Record<string, unknown>): Promise<void>;
}

/**
 * Configuration schema for plugin settings
 */
export interface PluginConfigSchema {
  /** Schema properties */
  properties: Record<
    string,
    {
      type: "string" | "number" | "boolean" | "object" | "array";
      description?: string;
      default?: unknown;
      enum?: unknown[];
      minimum?: number;
      maximum?: number;
    }
  >;

  /** Required property keys */
  required?: string[];
}

/**
 * Demodulator plugin interface
 *
 * Demodulator plugins process IQ samples to extract audio or data signals.
 */
export interface DemodulatorPlugin extends Plugin {
  metadata: PluginMetadata & { type: PluginType.DEMODULATOR };

  /**
   * Demodulate IQ samples to audio
   * @param samples - Input IQ samples
   * @returns Audio samples (mono, typically 48kHz)
   */
  demodulate(samples: IQSample[]): Float32Array;

  /**
   * Get supported modulation types
   */
  getSupportedModes(): string[];

  /**
   * Set demodulation mode
   */
  setMode(mode: string): void;

  /**
   * Get current demodulation parameters
   */
  getParameters(): DemodulatorParameters;

  /**
   * Update demodulation parameters
   */
  setParameters(params: Partial<DemodulatorParameters>): void;
}

/**
 * Common demodulator parameters
 */
export interface DemodulatorParameters {
  /** Audio output sample rate in Hz */
  audioSampleRate: number;

  /** Demodulation bandwidth in Hz */
  bandwidth: number;

  /** Squelch threshold (0-100) */
  squelch?: number;

  /** Automatic Frequency Control enabled */
  afcEnabled?: boolean;

  /** Additional mode-specific parameters */
  [key: string]: unknown;
}

/**
 * Visualization plugin interface
 *
 * Visualization plugins create custom displays for signal analysis.
 */
export interface VisualizationPlugin extends Plugin {
  metadata: PluginMetadata & { type: PluginType.VISUALIZATION };

  /**
   * Render visualization to canvas
   * @param canvas - Target canvas element
   * @param dataSource - Data source to visualize
   */
  render(canvas: HTMLCanvasElement, dataSource: DataSource): void;

  /**
   * Update visualization with new data
   * @param samples - New IQ samples to display
   */
  update(samples: IQSample[]): void;

  /**
   * Resize visualization
   * @param width - New width in pixels
   * @param height - New height in pixels
   */
  resize(width: number, height: number): void;

  /**
   * Get visualization capabilities
   */
  getCapabilities(): VisualizationCapabilities;

  /**
   * Take a snapshot of the current visualization
   * @returns Data URL of the snapshot image
   */
  takeSnapshot?(): string | Promise<string>;
}

/**
 * Visualization plugin capabilities
 */
export interface VisualizationCapabilities {
  /** Supports real-time updates */
  supportsRealtime: boolean;

  /** Supports offline/recorded data */
  supportsOffline: boolean;

  /** Supports WebGL acceleration */
  supportsWebGL: boolean;

  /** Minimum update rate in Hz */
  minUpdateRate: number;

  /** Maximum update rate in Hz */
  maxUpdateRate: number;

  /** Preferred aspect ratio (width/height) */
  preferredAspectRatio?: number;
}

/**
 * Device driver plugin interface
 *
 * Device driver plugins add support for new SDR hardware.
 */
export interface DeviceDriverPlugin extends Plugin {
  metadata: PluginMetadata & { type: PluginType.DEVICE_DRIVER };

  /**
   * Create a device instance
   * @param usbDevice - WebUSB device to wrap
   * @returns SDR device instance
   */
  createDevice(usbDevice: USBDevice): Promise<ISDRDevice>;

  /**
   * Get USB device filters for device detection
   */
  getUSBFilters(): USBDeviceFilter[];

  /**
   * Check if a USB device is supported
   * @param device - USB device to check
   */
  supportsDevice(device: USBDevice): boolean;

  /**
   * Get device information from USB device
   */
  getDeviceInfo(device: USBDevice): Promise<{
    manufacturer: string;
    model: string;
    serialNumber?: string;
  }>;
}

/**
 * Plugin registry event types
 */
export enum PluginEvent {
  /** Plugin was registered */
  REGISTERED = "registered",

  /** Plugin was unregistered */
  UNREGISTERED = "unregistered",

  /** Plugin state changed */
  STATE_CHANGED = "state-changed",

  /** Plugin error occurred */
  ERROR = "error",
}

/**
 * Plugin event data
 */
export interface PluginEventData {
  plugin: Plugin;
  event: PluginEvent;
  timestamp: number;
  error?: Error;
  previousState?: PluginState;
  newState?: PluginState;
}

/**
 * Plugin event listener function
 */
export type PluginEventListener = (event: PluginEventData) => void;

/**
 * Plugin registry interface
 */
export interface PluginRegistry {
  /**
   * Register a plugin
   */
  register(plugin: Plugin): Promise<void>;

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): Promise<void>;

  /**
   * Get a registered plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined;

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[];

  /**
   * Get plugins by type
   */
  getPluginsByType(type: PluginType): Plugin[];

  /**
   * Check if a plugin is registered
   */
  hasPlugin(pluginId: string): boolean;

  /**
   * Add event listener
   */
  addEventListener(listener: PluginEventListener): void;

  /**
   * Remove event listener
   */
  removeEventListener(listener: PluginEventListener): void;

  /**
   * Clear all plugins
   */
  clear(): Promise<void>;
}
