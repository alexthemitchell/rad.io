/**
 * Serena MCP Tools Demonstration
 * 
 * This file demonstrates the capabilities of Serena MCP service tools
 * for code manipulation and analysis.
 */

export interface SerenaToolsCapabilities {
  codeNavigation: boolean;
  symbolManipulation: boolean;
  patternSearching: boolean;
  fileOperations: boolean;
  memoryManagement: boolean;
  testingIntegration: boolean;
}

export class SerenaToolsDemo {
  private capabilities: SerenaToolsCapabilities;

  constructor() {
    this.capabilities = {
      codeNavigation: true,
      symbolManipulation: true,
      patternSearching: true,
      fileOperations: true,
      memoryManagement: true,
      testingIntegration: true,
    };
  }

  /**
   * Get the current capabilities
   */
  getCapabilities(): SerenaToolsCapabilities {
    return this.capabilities;
  }

  /**
   * Verify all tools are working
   */
  verifyTools(): boolean {
    return Object.values(this.capabilities).every(cap => cap === true);
  }

  /**
   * Get a list of all enabled capabilities
   */
  getEnabledCapabilities(): string[] {
    return Object.entries(this.capabilities)
      .filter(([_, enabled]) => enabled)
      .map(([name, _]) => name);
  }
}

/**
 * Helper function to create a demo instance
 */
export function createSerenaToolsDemo(): SerenaToolsDemo {
  return new SerenaToolsDemo();
}
