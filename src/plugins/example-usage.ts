/* eslint-disable no-console */
/**
 * Plugin System Usage Example
 *
 * This example demonstrates how to use the rad.io plugin system
 * in a real application context.
 */

import {
  pluginRegistry,
  FMDemodulatorPlugin,
  WaterfallVisualizationPlugin,
  PluginType,
} from "./index";
import type { PluginEventData } from "../types/plugin";

/**
 * Initialize and use plugins in your application
 */
async function initializePlugins(): Promise<void> {
  console.log("=== Plugin System Example ===\n");

  // 1. Create and register plugins
  console.log("1. Registering plugins...");

  const fmDemod = new FMDemodulatorPlugin();
  const waterfallViz = new WaterfallVisualizationPlugin();

  await pluginRegistry.register(fmDemod);
  await pluginRegistry.register(waterfallViz);

  console.log(`   Registered: ${fmDemod.metadata.name}`);
  console.log(`   Registered: ${waterfallViz.metadata.name}\n`);

  // 2. Listen to plugin events
  console.log("2. Setting up event listeners...");

  pluginRegistry.addEventListener((event: PluginEventData) => {
    console.log(
      `   Event: ${event.event} - Plugin: ${event.plugin.metadata.name}`,
    );
  });

  // 3. Activate plugins
  console.log("\n3. Activating plugins...");

  await fmDemod.activate();
  await waterfallViz.activate();

  console.log(`   ${fmDemod.metadata.name} is now active`);
  console.log(`   ${waterfallViz.metadata.name} is now active\n`);

  // 4. Discover plugins
  console.log("4. Discovering available plugins...");

  const allPlugins = pluginRegistry.getAllPlugins();
  console.log(`   Total plugins: ${allPlugins.length}`);

  const demodulators = pluginRegistry.getPluginsByType(PluginType.DEMODULATOR);
  console.log(`   Demodulators: ${demodulators.length}`);

  const visualizations = pluginRegistry.getPluginsByType(
    PluginType.VISUALIZATION,
  );
  console.log(`   Visualizations: ${visualizations.length}\n`);

  // 5. Use plugin functionality
  console.log("5. Using plugin functionality...");

  // Configure demodulator
  const modes = fmDemod.getSupportedModes();
  console.log(`   Supported demodulation modes: ${modes.join(", ")}`);

  fmDemod.setMode("wbfm");
  fmDemod.setParameters({ bandwidth: 200000, squelch: 10 });

  // Use demodulator (with sample data)
  const iqSamples = [
    { I: 0.5, Q: 0.5 },
    { I: 0.3, Q: 0.7 },
    { I: -0.2, Q: 0.8 },
  ];
  const audioSamples = fmDemod.demodulate(iqSamples);
  console.log(`   Demodulated ${audioSamples.length} audio samples`);

  // Use visualization (would render to canvas in real app)
  const capabilities = waterfallViz.getCapabilities();
  console.log(`   Visualization supports realtime: ${capabilities.supportsRealtime}`);
  console.log(`   Update rate range: ${capabilities.minUpdateRate}-${capabilities.maxUpdateRate} Hz\n`);

  // 6. Configure plugins
  console.log("6. Configuring plugins...");

  const schema = fmDemod.getConfigSchema();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (schema) {
    console.log(
      `   Available config options: ${Object.keys(schema.properties).join(", ")}`,
    );
  }

  await fmDemod.updateConfig({
    mode: "nbfm",
    bandwidth: 12500,
  });
  console.log("   Updated demodulator configuration\n");

  // 7. Deactivate and cleanup
  console.log("7. Cleaning up...");

  await fmDemod.deactivate();
  await waterfallViz.deactivate();

  await pluginRegistry.unregister(fmDemod.metadata.id);
  await pluginRegistry.unregister(waterfallViz.metadata.id);

  console.log("   Plugins deactivated and unregistered\n");

  console.log("=== Example Complete ===");
}

/**
 * Example: Using plugins in a React component
 */
/*
import { useEffect, useState } from 'react';
import { pluginRegistry, FMDemodulatorPlugin } from './plugins';

function DemodulatorComponent() {
  const [plugin, setPlugin] = useState<FMDemodulatorPlugin | null>(null);

  useEffect(() => {
    // Initialize plugin
    const demod = new FMDemodulatorPlugin();
    
    pluginRegistry.register(demod).then(() => {
      demod.activate().then(() => {
        setPlugin(demod);
      });
    });

    // Cleanup
    return () => {
      void (async () => {
        if (plugin) {
        plugin.deactivate().then(() => {
          pluginRegistry.unregister(plugin.metadata.id);
        });
      }
    };
  }, []);

  const handleDemodulate = (samples: IQSample[]) => {
    if (!plugin) return;
    
    const audio = plugin.demodulate(samples);
    // Use audio samples...
  };

  return (
    <div>
      <h2>Demodulator Status</h2>
      <p>Plugin: {plugin?.metadata.name}</p>
      <p>State: {plugin?.state}</p>
      <button onClick={() => handleDemodulate(testSamples)}>
        Demodulate
      </button>
    </div>
  );
}
*/

/**
 * Example: Creating a custom plugin
 */
/*
import { BasePlugin } from './lib/BasePlugin';
import type { DemodulatorPlugin, PluginMetadata } from './types/plugin';

class AMDemodulatorPlugin extends BasePlugin implements DemodulatorPlugin {
  constructor() {
    super({
      id: 'am-demodulator',
      name: 'AM Demodulator',
      version: '1.0.0',
      author: 'Your Name',
      description: 'Amplitude Modulation demodulator',
      type: PluginType.DEMODULATOR,
    });
  }

  protected onInitialize(): void {
    // Initialize plugin state
  }

  protected onActivate(): void {
    // Start plugin
  }

  protected onDeactivate(): void {
    // Stop plugin
  }

  protected onDispose(): void {
    // Cleanup resources
  }

  demodulate(samples: IQSample[]): Float32Array {
    const output = new Float32Array(samples.length);
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) continue;
      
      // AM demodulation: calculate magnitude
      output[i] = Math.sqrt(sample.I ** 2 + sample.Q ** 2);
    }
    
    return output;
  }

  getSupportedModes(): string[] {
    return ['am', 'dsb', 'usb', 'lsb'];
  }

  setMode(mode: string): void {
    // Implement mode switching
  }

  getParameters(): DemodulatorParameters {
    return {
      audioSampleRate: 48000,
      bandwidth: 10000,
    };
  }

  setParameters(params: Partial<DemodulatorParameters>): void {
    // Update parameters
  }
}

// Usage
const amPlugin = new AMDemodulatorPlugin();
await pluginRegistry.register(amPlugin);
await amPlugin.activate();
*/

// Run the example if this file is executed directly
if (require.main === module) {
  void initializePlugins();
}

export { initializePlugins };
