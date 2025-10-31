// Global DOM type augmentations for non-standard properties exposed in automation
declare global {
  interface Navigator {
    /** True when running under browser automation (e.g., Playwright sets this) */
    webdriver?: boolean;
  }
}

export {};
