/**
 * Frequency Scanning Module
 * Implements ADR-0014: Automatic Frequency Scanning
 */

export { LinearScanner } from "./linear-scanner";
export { AdaptiveScanner } from "./adaptive-scanner";
export { PriorityScanner } from "./priority-scanner";
export { ScanManager, scanManager } from "./scan-manager";
export { TalkgroupPriorityScanner } from "./talkgroup-priority-scanner";
export type {
  TalkgroupActivity,
  PrioritySwitchEvent,
} from "./talkgroup-priority-scanner";

export type {
  ScanStrategy,
  ScanConfig,
  ScanResult,
  ScanProgress,
  ScanComplete,
  IScanner,
} from "./types";
