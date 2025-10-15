/**
 * Tests for Serena MCP Tools Demonstration
 */

import { SerenaToolsDemo, createSerenaToolsDemo } from '../serenaToolsDemo';

describe('SerenaToolsDemo', () => {
  describe('Initialization', () => {
    it('should create instance with all capabilities enabled', () => {
      const demo = new SerenaToolsDemo();
      const capabilities = demo.getCapabilities();

      expect(capabilities.codeNavigation).toBe(true);
      expect(capabilities.symbolManipulation).toBe(true);
      expect(capabilities.patternSearching).toBe(true);
      expect(capabilities.fileOperations).toBe(true);
      expect(capabilities.memoryManagement).toBe(true);
      expect(capabilities.testingIntegration).toBe(true);
    });

    it('should create instance using factory function', () => {
      const demo = createSerenaToolsDemo();
      expect(demo).toBeInstanceOf(SerenaToolsDemo);
    });
  });

  describe('Tool Verification', () => {
    it('should verify all tools are working', () => {
      const demo = new SerenaToolsDemo();
      const result = demo.verifyTools();

      expect(result).toBe(true);
    });

    it('should list all enabled capabilities', () => {
      const demo = new SerenaToolsDemo();
      const enabled = demo.getEnabledCapabilities();

      expect(enabled).toContain('codeNavigation');
      expect(enabled).toContain('symbolManipulation');
      expect(enabled).toContain('patternSearching');
      expect(enabled).toContain('fileOperations');
      expect(enabled).toContain('memoryManagement');
      expect(enabled).toContain('testingIntegration');
      expect(enabled).toHaveLength(6);
    });
  });

  describe('Capabilities', () => {
    let demo: SerenaToolsDemo;

    beforeEach(() => {
      demo = new SerenaToolsDemo();
    });

    it('should have code navigation capability', () => {
      const capabilities = demo.getCapabilities();
      expect(capabilities.codeNavigation).toBe(true);
    });

    it('should have symbol manipulation capability', () => {
      const capabilities = demo.getCapabilities();
      expect(capabilities.symbolManipulation).toBe(true);
    });

    it('should have pattern searching capability', () => {
      const capabilities = demo.getCapabilities();
      expect(capabilities.patternSearching).toBe(true);
    });

    it('should have file operations capability', () => {
      const capabilities = demo.getCapabilities();
      expect(capabilities.fileOperations).toBe(true);
    });

    it('should have memory management capability', () => {
      const capabilities = demo.getCapabilities();
      expect(capabilities.memoryManagement).toBe(true);
    });

    it('should have testing integration capability', () => {
      const capabilities = demo.getCapabilities();
      expect(capabilities.testingIntegration).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should demonstrate complete workflow', () => {
      // Create instance
      const demo = createSerenaToolsDemo();

      // Verify all tools
      expect(demo.verifyTools()).toBe(true);

      // Get capabilities
      const capabilities = demo.getCapabilities();
      expect(capabilities).toBeDefined();

      // Get enabled capabilities
      const enabled = demo.getEnabledCapabilities();
      expect(enabled.length).toBeGreaterThan(0);
    });
  });
});
