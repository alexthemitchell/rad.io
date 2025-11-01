/**
 * Talkgroup Priority Scanner
 *
 * Monitors P25 talkgroups and automatically switches to higher-priority
 * talkgroups when they become active.
 */

import type { Talkgroup } from "../../components/TalkgroupScanner";
import type { P25DecodedData } from "../../utils/p25decoder";

export type TalkgroupActivity = {
  talkgroupId: number;
  priority: number;
  lastActivity: number;
  signalQuality: number;
  isActive: boolean;
};

export type PrioritySwitchEvent = {
  fromTalkgroup: number | null;
  toTalkgroup: number;
  priority: number;
  reason: "higher_priority" | "current_ended" | "initial";
};

/**
 * Talkgroup Priority Scanner
 *
 * Manages talkgroup monitoring with priority-based switching logic.
 * Higher priority talkgroups (higher number) will preempt lower priority ones.
 */
export class TalkgroupPriorityScanner {
  private talkgroups = new Map<string, Talkgroup>();
  private activity = new Map<number, TalkgroupActivity>();
  private currentTalkgroupId: number | null = null;
  private activityTimeout = 5000; // 5 seconds without activity = inactive

  /**
   * Update the list of monitored talkgroups
   */
  updateTalkgroups(talkgroups: Talkgroup[]): void {
    this.talkgroups.clear();
    for (const tg of talkgroups) {
      if (tg.enabled) {
        this.talkgroups.set(tg.id, tg);
      }
    }
  }

  /**
   * Process decoded P25 data and update activity tracking
   */
  processDecodedData(decoded: P25DecodedData, timestamp: number): void {
    // Extract talkgroup information from frames
    for (const frame of decoded.frames) {
      if (frame.isValid && frame.bits.length > 0) {
        // Try to extract talkgroup info from the frame
        // This is a simplified approach - in reality, we'd need more sophisticated parsing
        const talkgroupId = this.extractTalkgroupFromFrame(frame.bits);

        if (talkgroupId !== null && this.talkgroups.has(String(talkgroupId))) {
          this.updateActivity(talkgroupId, frame.signalQuality, timestamp);
        }
      }
    }

    // Mark inactive talkgroups
    this.markInactiveTalkgroups(timestamp);
  }

  /**
   * Extract talkgroup ID from frame bits (simplified)
   * In reality, this would parse the Link Control Word properly
   */
  private extractTalkgroupFromFrame(bits: number[]): number | null {
    if (bits.length < 48) {
      return null;
    }

    // Extract LCW format (first 8 bits)
    let lcwFormat = 0;
    for (let i = 0; i < 8; i++) {
      lcwFormat = (lcwFormat << 1) | (bits[i] ?? 0);
    }

    // Only process Group Voice formats (0x00 and 0x40)
    if (lcwFormat !== 0x00 && lcwFormat !== 0x40) {
      return null;
    }

    // Extract talkgroup ID (16 bits, following the format byte)
    let talkgroupId = 0;
    for (let i = 8; i < 24; i++) {
      talkgroupId = (talkgroupId << 1) | (bits[i] ?? 0);
    }

    return talkgroupId === 0 ? null : talkgroupId;
  }

  /**
   * Update activity for a talkgroup
   */
  private updateActivity(
    talkgroupId: number,
    signalQuality: number,
    timestamp: number,
  ): void {
    const talkgroup = this.talkgroups.get(String(talkgroupId));
    if (!talkgroup) {
      return;
    }

    const existing = this.activity.get(talkgroupId);
    this.activity.set(talkgroupId, {
      talkgroupId,
      priority: talkgroup.priority,
      lastActivity: timestamp,
      signalQuality,
      isActive: true,
    });

    // If this is new activity, log it
    if (!existing?.isActive) {
      console.info(
        `Talkgroup ${talkgroupId} (${talkgroup.name}) is now active (priority ${talkgroup.priority})`,
      );
    }
  }

  /**
   * Mark talkgroups as inactive if they haven't been heard from
   */
  private markInactiveTalkgroups(timestamp: number): void {
    for (const [talkgroupId, activity] of this.activity.entries()) {
      if (
        activity.isActive &&
        timestamp - activity.lastActivity > this.activityTimeout
      ) {
        activity.isActive = false;
        console.info(`Talkgroup ${talkgroupId} is now inactive`);
      }
    }
  }

  /**
   * Determine if we should switch to a different talkgroup
   * Returns the talkgroup ID to switch to, or null if no switch needed
   */
  shouldSwitch(_timestamp: number): PrioritySwitchEvent | null {
    // Get all active talkgroups sorted by priority (highest first)
    const activeTalkgroups = Array.from(this.activity.values())
      .filter((a) => a.isActive)
      .sort((a, b) => b.priority - a.priority);

    // If no active talkgroups and we're currently on one, stay
    if (activeTalkgroups.length === 0) {
      return null;
    }

    const highestPriority = activeTalkgroups[0];
    if (!highestPriority) {
      return null;
    }

    // If we're not on any talkgroup, switch to the highest priority one
    if (this.currentTalkgroupId === null) {
      return {
        fromTalkgroup: null,
        toTalkgroup: highestPriority.talkgroupId,
        priority: highestPriority.priority,
        reason: "initial",
      };
    }

    // If current talkgroup is inactive, switch to highest priority active
    const currentActivity = this.activity.get(this.currentTalkgroupId);
    if (!currentActivity?.isActive) {
      return {
        fromTalkgroup: this.currentTalkgroupId,
        toTalkgroup: highestPriority.talkgroupId,
        priority: highestPriority.priority,
        reason: "current_ended",
      };
    }

    // If a higher priority talkgroup becomes active, switch to it
    if (highestPriority.priority > currentActivity.priority) {
      return {
        fromTalkgroup: this.currentTalkgroupId,
        toTalkgroup: highestPriority.talkgroupId,
        priority: highestPriority.priority,
        reason: "higher_priority",
      };
    }

    // Stay on current talkgroup
    return null;
  }

  /**
   * Set the current talkgroup (e.g., after a switch)
   */
  setCurrentTalkgroup(talkgroupId: number | null): void {
    this.currentTalkgroupId = talkgroupId;
  }

  /**
   * Get the current talkgroup
   */
  getCurrentTalkgroup(): number | null {
    return this.currentTalkgroupId;
  }

  /**
   * Get current activity status for all talkgroups
   */
  getActivityStatus(): TalkgroupActivity[] {
    return Array.from(this.activity.values());
  }

  /**
   * Get activity for a specific talkgroup
   */
  getTalkgroupActivity(talkgroupId: number): TalkgroupActivity | null {
    return this.activity.get(talkgroupId) ?? null;
  }

  /**
   * Clear all activity tracking
   */
  clear(): void {
    this.activity.clear();
    this.currentTalkgroupId = null;
  }

  /**
   * Set the activity timeout (time before a talkgroup is considered inactive)
   */
  setActivityTimeout(timeoutMs: number): void {
    this.activityTimeout = timeoutMs;
  }
}
