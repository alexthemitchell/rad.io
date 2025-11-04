// Global DOM type augmentations for non-standard properties exposed in automation
declare global {
  interface Navigator {
    /** True when running under browser automation (e.g., Playwright sets this) */
    webdriver?: boolean;
  }

  interface Window {
    /** Debug property: current reception state (set by useReception hook) */
    dbgReceiving?: boolean;
  }
}

export {};
