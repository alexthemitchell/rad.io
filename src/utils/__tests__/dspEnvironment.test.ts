/**
 * Tests for DSP environment detection
 */

import {
  detectDSPCapabilities,
  DSPMode,
  getDSPModeUserMessage,
} from "../dspEnvironment";

describe("DSP Environment Detection", () => {
  describe("detectDSPCapabilities", () => {
    it("should detect capabilities", () => {
      const capabilities = detectDSPCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities.mode).toBeDefined();
      expect(Object.values(DSPMode)).toContain(capabilities.mode);
      expect(capabilities.deploymentEnvironment).toBeDefined();
      expect(capabilities.warnings).toBeInstanceOf(Array);
      expect(capabilities.performanceImpact).toBeDefined();
    });

    it("should include all capability flags", () => {
      const capabilities = detectDSPCapabilities();

      expect(typeof capabilities.sharedArrayBufferSupported).toBe("boolean");
      expect(typeof capabilities.crossOriginIsolated).toBe("boolean");
      expect(typeof capabilities.webWorkersSupported).toBe("boolean");
      expect(typeof capabilities.wasmAvailable).toBe("boolean");
      expect(typeof capabilities.wasmSIMDSupported).toBe("boolean");
      expect(typeof capabilities.webGPUAvailable).toBe("boolean");
    });

    it("should detect deployment environment", () => {
      const capabilities = detectDSPCapabilities();

      expect(
        ["development", "github-pages", "custom-headers", "unknown"].includes(
          capabilities.deploymentEnvironment,
        ),
      ).toBe(true);
    });

    it("should select appropriate DSP mode", () => {
      const capabilities = detectDSPCapabilities();

      // Mode should be one of the valid modes
      expect(Object.values(DSPMode)).toContain(capabilities.mode);

      // If SharedArrayBuffer is not available, should fall back
      if (!capabilities.sharedArrayBufferSupported) {
        expect(capabilities.mode).not.toBe(DSPMode.SHARED_ARRAY_BUFFER);
      }

      // If cross-origin isolated is false, should fall back
      if (!capabilities.crossOriginIsolated) {
        expect(capabilities.mode).not.toBe(DSPMode.SHARED_ARRAY_BUFFER);
      }

      // If web workers not supported, should use pure JS
      if (!capabilities.webWorkersSupported) {
        expect(capabilities.mode).toBe(DSPMode.PURE_JS);
      }
    });

    it("should generate warnings for fallback modes", () => {
      const capabilities = detectDSPCapabilities();

      if (capabilities.mode === DSPMode.MESSAGE_CHANNEL) {
        expect(capabilities.warnings.length).toBeGreaterThan(0);
        expect(
          capabilities.warnings.some((w) =>
            w.includes("SharedArrayBuffer not available"),
          ),
        ).toBe(true);
      }

      if (capabilities.mode === DSPMode.PURE_JS) {
        expect(capabilities.warnings.length).toBeGreaterThan(0);
        expect(
          capabilities.warnings.some((w) => w.includes("Web Workers not supported")),
        ).toBe(true);
      }
    });

    it("should provide performance impact description", () => {
      const capabilities = detectDSPCapabilities();

      expect(capabilities.performanceImpact).toBeTruthy();
      expect(capabilities.performanceImpact.length).toBeGreaterThan(0);

      // Should mention performance characteristics
      if (capabilities.mode === DSPMode.SHARED_ARRAY_BUFFER) {
        expect(
          capabilities.performanceImpact.toLowerCase().includes("optimal"),
        ).toBe(true);
      }

      if (capabilities.mode === DSPMode.MESSAGE_CHANNEL) {
        expect(
          capabilities.performanceImpact.toLowerCase().includes("reduced"),
        ).toBe(true);
      }

      if (capabilities.mode === DSPMode.PURE_JS) {
        expect(
          capabilities.performanceImpact.toLowerCase().includes("degraded"),
        ).toBe(true);
      }
    });
  });

  describe("getDSPModeUserMessage", () => {
    it("should return message for SharedArrayBuffer mode", () => {
      const message = getDSPModeUserMessage(DSPMode.SHARED_ARRAY_BUFFER);

      expect(message.title).toBeTruthy();
      expect(message.message).toBeTruthy();
      expect(message.severity).toBe("success");
    });

    it("should return message for MessageChannel mode", () => {
      const message = getDSPModeUserMessage(DSPMode.MESSAGE_CHANNEL);

      expect(message.title).toBeTruthy();
      expect(message.message).toBeTruthy();
      expect(message.severity).toBe("warning");
    });

    it("should return message for PureJS mode", () => {
      const message = getDSPModeUserMessage(DSPMode.PURE_JS);

      expect(message.title).toBeTruthy();
      expect(message.message).toBeTruthy();
      expect(message.severity).toBe("error");
    });

    it("should include guidance in messages", () => {
      const messageChannelMsg = getDSPModeUserMessage(DSPMode.MESSAGE_CHANNEL);
      expect(
        messageChannelMsg.message.toLowerCase().includes("vercel") ||
          messageChannelMsg.message.toLowerCase().includes("netlify") ||
          messageChannelMsg.message.toLowerCase().includes("cloudflare"),
      ).toBe(true);

      const pureJsMsg = getDSPModeUserMessage(DSPMode.PURE_JS);
      expect(pureJsMsg.message.toLowerCase().includes("browser")).toBe(true);
    });
  });
});
