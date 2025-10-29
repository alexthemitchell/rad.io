/**
 * Plugin System Public API
 *
 * Main entry point for the rad.io plugin system.
 * This module exports all types, classes, and utilities needed to
 * create and use plugins.
 */

// Core plugin types and interfaces
export type {
  Plugin,
  PluginMetadata,
  PluginState,
  PluginConfigSchema,
  DemodulatorPlugin,
  DemodulatorParameters,
  VisualizationPlugin,
  VisualizationCapabilities,
  DeviceDriverPlugin,
  PluginRegistry,
  PluginEventData,
  PluginEventListener,
} from "../types/plugin";

export { PluginType, PluginState as PluginStateEnum, PluginEvent } from "../types/plugin";

// Plugin registry
export { PluginRegistry as PluginRegistryClass, pluginRegistry } from "../lib/PluginRegistry";

// Base plugin class
export { BasePlugin } from "../lib/BasePlugin";

// Example plugins
export { FMDemodulatorPlugin } from "./demodulators/FMDemodulatorPlugin";
export { WaterfallVisualizationPlugin } from "./visualizations/WaterfallVisualizationPlugin";
export { ExampleDeviceDriverPlugin } from "./device-drivers/ExampleDeviceDriverPlugin";
