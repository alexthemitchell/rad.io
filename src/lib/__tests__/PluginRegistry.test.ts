/**
 * Plugin Registry Tests
 */

import { PluginRegistry } from "../PluginRegistry";
import type { Plugin, PluginMetadata } from "../../types/plugin";
import { PluginType, PluginState } from "../../types/plugin";

// Mock plugin for testing
class MockPlugin implements Plugin {
  readonly metadata: PluginMetadata;
  state: PluginState;

  constructor(id: string, deps: string[] = []) {
    this.metadata = {
      id,
      name: `Mock Plugin ${id}`,
      version: "1.0.0",
      author: "Test",
      description: "Test plugin",
      type: PluginType.UTILITY,
      dependencies: deps,
    };
    this.state = PluginState.REGISTERED;
  }

  async initialize(): Promise<void> {
    this.state = PluginState.INITIALIZED;
  }

  async activate(): Promise<void> {
    this.state = PluginState.ACTIVE;
  }

  async deactivate(): Promise<void> {
    this.state = PluginState.INITIALIZED;
  }

  async dispose(): Promise<void> {
    // Cleanup
  }
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  afterEach(async () => {
    await registry.clear();
  });

  describe("register", () => {
    it("should register a plugin", async () => {
      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);

      expect(registry.hasPlugin("test-plugin")).toBe(true);
      expect(registry.getPlugin("test-plugin")).toBe(plugin);
    });

    it("should initialize plugin on registration", async () => {
      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);

      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });

    it("should throw error for duplicate plugin ID", async () => {
      const plugin1 = new MockPlugin("test-plugin");
      const plugin2 = new MockPlugin("test-plugin");

      await registry.register(plugin1);

      await expect(registry.register(plugin2)).rejects.toThrow(
        "already registered",
      );
    });

    it("should validate dependencies", async () => {
      const plugin = new MockPlugin("test-plugin", ["non-existent"]);

      await expect(registry.register(plugin)).rejects.toThrow(
        "depends on 'non-existent'",
      );
    });

    it("should allow plugins with satisfied dependencies", async () => {
      const dep = new MockPlugin("dependency");
      const plugin = new MockPlugin("test-plugin", ["dependency"]);

      await registry.register(dep);
      await registry.register(plugin);

      expect(registry.hasPlugin("test-plugin")).toBe(true);
    });
  });

  describe("unregister", () => {
    it("should unregister a plugin", async () => {
      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);
      await registry.unregister("test-plugin");

      expect(registry.hasPlugin("test-plugin")).toBe(false);
    });

    it("should throw error for non-existent plugin", async () => {
      await expect(registry.unregister("non-existent")).rejects.toThrow(
        "not registered",
      );
    });

    it("should prevent unregistering plugin with dependents", async () => {
      const dep = new MockPlugin("dependency");
      const plugin = new MockPlugin("test-plugin", ["dependency"]);

      await registry.register(dep);
      await registry.register(plugin);

      await expect(registry.unregister("dependency")).rejects.toThrow(
        "depend on it",
      );
    });

    it("should deactivate active plugin before unregistering", async () => {
      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);
      await plugin.activate();

      expect(plugin.state).toBe(PluginState.ACTIVE);

      await registry.unregister("test-plugin");

      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });
  });

  describe("getPlugin", () => {
    it("should return plugin by ID", async () => {
      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);

      expect(registry.getPlugin("test-plugin")).toBe(plugin);
    });

    it("should return undefined for non-existent plugin", () => {
      expect(registry.getPlugin("non-existent")).toBeUndefined();
    });
  });

  describe("getAllPlugins", () => {
    it("should return all registered plugins", async () => {
      const plugin1 = new MockPlugin("plugin1");
      const plugin2 = new MockPlugin("plugin2");

      await registry.register(plugin1);
      await registry.register(plugin2);

      const plugins = registry.getAllPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });

    it("should return empty array when no plugins registered", () => {
      expect(registry.getAllPlugins()).toHaveLength(0);
    });
  });

  describe("getPluginsByType", () => {
    it("should return plugins of specific type", async () => {
      const demod = new MockPlugin("demod");
      demod.metadata.type = PluginType.DEMODULATOR;

      const viz = new MockPlugin("viz");
      viz.metadata.type = PluginType.VISUALIZATION;

      await registry.register(demod);
      await registry.register(viz);

      const demodPlugins = registry.getPluginsByType(PluginType.DEMODULATOR);
      expect(demodPlugins).toHaveLength(1);
      expect(demodPlugins[0]).toBe(demod);

      const vizPlugins = registry.getPluginsByType(PluginType.VISUALIZATION);
      expect(vizPlugins).toHaveLength(1);
      expect(vizPlugins[0]).toBe(viz);
    });

    it("should return empty array for type with no plugins", () => {
      const plugins = registry.getPluginsByType(PluginType.DEVICE_DRIVER);
      expect(plugins).toHaveLength(0);
    });
  });

  describe("hasPlugin", () => {
    it("should return true for registered plugin", async () => {
      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);

      expect(registry.hasPlugin("test-plugin")).toBe(true);
    });

    it("should return false for non-registered plugin", () => {
      expect(registry.hasPlugin("non-existent")).toBe(false);
    });
  });

  describe("event listeners", () => {
    it("should notify listeners on registration", async () => {
      const listener = jest.fn();
      registry.addEventListener(listener);

      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          plugin,
          event: "registered",
        }),
      );
    });

    it("should notify listeners on unregistration", async () => {
      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);

      const listener = jest.fn();
      registry.addEventListener(listener);

      await registry.unregister("test-plugin");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          plugin,
          event: "unregistered",
        }),
      );
    });

    it("should allow removing listeners", async () => {
      const listener = jest.fn();
      registry.addEventListener(listener);
      registry.removeEventListener(listener);

      const plugin = new MockPlugin("test-plugin");
      await registry.register(plugin);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should unregister all plugins", async () => {
      const plugin1 = new MockPlugin("plugin1");
      const plugin2 = new MockPlugin("plugin2");

      await registry.register(plugin1);
      await registry.register(plugin2);

      await registry.clear();

      expect(registry.getAllPlugins()).toHaveLength(0);
    });

    it("should handle dependencies correctly", async () => {
      const dep = new MockPlugin("dependency");
      const plugin = new MockPlugin("plugin", ["dependency"]);

      await registry.register(dep);
      await registry.register(plugin);

      await registry.clear();

      expect(registry.getAllPlugins()).toHaveLength(0);
    });

    it("should unregister plugins in topological order (dependents first)", async () => {
      const base = new MockPlugin("base");
      const middle = new MockPlugin("middle", ["base"]);
      const top = new MockPlugin("top", ["middle"]);

      await registry.register(base);
      await registry.register(middle);
      await registry.register(top);

      const unregisterOrder: string[] = [];
      registry.addEventListener((event) => {
        if (event.event === "unregistered") {
          unregisterOrder.push(event.plugin.metadata.id);
        }
      });

      await registry.clear();

      // Should unregister in order: top -> middle -> base
      expect(unregisterOrder).toEqual(["top", "middle", "base"]);
      expect(registry.getAllPlugins()).toHaveLength(0);
    });

    it("should handle complex dependency chains", async () => {
      // Create a multi-level dependency chain
      const level1a = new MockPlugin("level1a");
      const level1b = new MockPlugin("level1b");
      const level2 = new MockPlugin("level2", ["level1a", "level1b"]);
      const level3 = new MockPlugin("level3", ["level2"]);

      await registry.register(level1a);
      await registry.register(level1b);
      await registry.register(level2);
      await registry.register(level3);

      const unregisterOrder: string[] = [];
      registry.addEventListener((event) => {
        if (event.event === "unregistered") {
          unregisterOrder.push(event.plugin.metadata.id);
        }
      });

      await registry.clear();

      // level3 must be unregistered before level2
      const level3Index = unregisterOrder.indexOf("level3");
      const level2Index = unregisterOrder.indexOf("level2");
      expect(level3Index).toBeLessThan(level2Index);

      // level2 must be unregistered before level1a and level1b
      const level1aIndex = unregisterOrder.indexOf("level1a");
      const level1bIndex = unregisterOrder.indexOf("level1b");
      expect(level2Index).toBeLessThan(level1aIndex);
      expect(level2Index).toBeLessThan(level1bIndex);

      expect(registry.getAllPlugins()).toHaveLength(0);
    });
  });
});
