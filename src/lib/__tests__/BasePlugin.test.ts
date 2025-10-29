/**
 * Base Plugin Tests
 */

import { BasePlugin } from "../BasePlugin";
import type { PluginMetadata } from "../../types/plugin";
import { PluginType, PluginState } from "../../types/plugin";

// Concrete test plugin class
class TestPlugin extends BasePlugin {
  initializeCalled = false;
  activateCalled = false;
  deactivateCalled = false;
  disposeCalled = false;
  configUpdateCalled = false;

  constructor(id = "test-plugin") {
    const metadata: PluginMetadata = {
      id,
      name: "Test Plugin",
      version: "1.0.0",
      author: "Test",
      description: "Test plugin",
      type: PluginType.UTILITY,
    };
    super(metadata);
  }

  protected async onInitialize(): Promise<void> {
    this.initializeCalled = true;
  }

  protected async onActivate(): Promise<void> {
    this.activateCalled = true;
  }

  protected async onDeactivate(): Promise<void> {
    this.deactivateCalled = true;
  }

  protected async onDispose(): Promise<void> {
    this.disposeCalled = true;
  }

  protected override async onConfigUpdate(): Promise<void> {
    this.configUpdateCalled = true;
  }
}

describe("BasePlugin", () => {
  let plugin: TestPlugin;

  beforeEach(() => {
    plugin = new TestPlugin();
  });

  describe("initialization", () => {
    it("should start in REGISTERED state", () => {
      expect(plugin.state).toBe(PluginState.REGISTERED);
    });

    it("should call onInitialize and transition to INITIALIZED", async () => {
      await plugin.initialize();

      expect(plugin.initializeCalled).toBe(true);
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });

    it("should transition to ERROR state on initialization failure", async () => {
      class FailingPlugin extends TestPlugin {
        protected override async onInitialize(): Promise<void> {
          throw new Error("Initialization failed");
        }
      }

      const failingPlugin = new FailingPlugin();

      await expect(failingPlugin.initialize()).rejects.toThrow(
        "Initialization failed",
      );
      expect(failingPlugin.state).toBe(PluginState.ERROR);
    });
  });

  describe("activation", () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    it("should call onActivate and transition to ACTIVE", async () => {
      await plugin.activate();

      expect(plugin.activateCalled).toBe(true);
      expect(plugin.state).toBe(PluginState.ACTIVE);
    });

    it("should throw error if not initialized", async () => {
      const uninitializedPlugin = new TestPlugin();

      await expect(uninitializedPlugin.activate()).rejects.toThrow(
        "Cannot activate plugin",
      );
    });

    it("should transition to ERROR state on activation failure", async () => {
      class FailingPlugin extends TestPlugin {
        protected override async onActivate(): Promise<void> {
          throw new Error("Activation failed");
        }
      }

      const failingPlugin = new FailingPlugin();
      await failingPlugin.initialize();

      await expect(failingPlugin.activate()).rejects.toThrow(
        "Activation failed",
      );
      expect(failingPlugin.state).toBe(PluginState.ERROR);
    });
  });

  describe("deactivation", () => {
    beforeEach(async () => {
      await plugin.initialize();
      await plugin.activate();
    });

    it("should call onDeactivate and transition to INITIALIZED", async () => {
      await plugin.deactivate();

      expect(plugin.deactivateCalled).toBe(true);
      expect(plugin.state).toBe(PluginState.INITIALIZED);
    });

    it("should not throw if already deactivated", async () => {
      await plugin.deactivate();
      await expect(plugin.deactivate()).resolves.not.toThrow();
    });

    it("should transition to ERROR state on deactivation failure", async () => {
      class FailingPlugin extends TestPlugin {
        protected override async onDeactivate(): Promise<void> {
          throw new Error("Deactivation failed");
        }
      }

      const failingPlugin = new FailingPlugin();
      await failingPlugin.initialize();
      await failingPlugin.activate();

      await expect(failingPlugin.deactivate()).rejects.toThrow(
        "Deactivation failed",
      );
      expect(failingPlugin.state).toBe(PluginState.ERROR);
    });
  });

  describe("disposal", () => {
    it("should call onDispose", async () => {
      await plugin.initialize();
      await plugin.dispose();

      expect(plugin.disposeCalled).toBe(true);
    });

    it("should deactivate before disposing if active", async () => {
      await plugin.initialize();
      await plugin.activate();
      await plugin.dispose();

      expect(plugin.deactivateCalled).toBe(true);
      expect(plugin.disposeCalled).toBe(true);
    });

    it("should transition to ERROR state on disposal failure", async () => {
      class FailingPlugin extends TestPlugin {
        protected override async onDispose(): Promise<void> {
          throw new Error("Disposal failed");
        }
      }

      const failingPlugin = new FailingPlugin();
      await failingPlugin.initialize();

      await expect(failingPlugin.dispose()).rejects.toThrow("Disposal failed");
      expect(failingPlugin.state).toBe(PluginState.ERROR);
    });
  });

  describe("configuration", () => {
    it("should update config and call onConfigUpdate", async () => {
      const config = { setting: "value" };
      await plugin.updateConfig(config);

      expect(plugin.configUpdateCalled).toBe(true);
    });

    it("should merge config with existing config", async () => {
      await plugin.updateConfig({ setting1: "value1" });
      await plugin.updateConfig({ setting2: "value2" });

      // Access protected config via type assertion for testing
      const configAccess = plugin as unknown as {
        config: Record<string, unknown>;
      };
      expect(configAccess.config).toEqual({
        setting1: "value1",
        setting2: "value2",
      });
    });
  });

  describe("metadata", () => {
    it("should expose plugin metadata", () => {
      expect(plugin.metadata.id).toBe("test-plugin");
      expect(plugin.metadata.name).toBe("Test Plugin");
      expect(plugin.metadata.version).toBe("1.0.0");
      expect(plugin.metadata.type).toBe(PluginType.UTILITY);
    });
  });
});
