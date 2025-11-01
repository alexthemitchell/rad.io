/**
 * Tests for Talkgroup Priority Scanner
 */

import { TalkgroupPriorityScanner } from "../talkgroup-priority-scanner";
import type { Talkgroup } from "../../../components/TalkgroupScanner";
import type { P25DecodedData } from "../../../utils/p25decoder";
import { P25TDMASlot } from "../../../utils/p25decoder";

describe("TalkgroupPriorityScanner", () => {
  let scanner: TalkgroupPriorityScanner;
  const mockTalkgroups: Talkgroup[] = [
    {
      id: "101",
      name: "Fire Dispatch",
      category: "Fire",
      priority: 9,
      enabled: true,
    },
    {
      id: "201",
      name: "Police Dispatch",
      category: "Police",
      priority: 9,
      enabled: true,
    },
    {
      id: "301",
      name: "EMS Main",
      category: "EMS",
      priority: 8,
      enabled: true,
    },
    {
      id: "102",
      name: "Fire Tactical",
      category: "Fire",
      priority: 7,
      enabled: false, // Disabled, should not be monitored
    },
  ];

  beforeEach(() => {
    scanner = new TalkgroupPriorityScanner();
    scanner.updateTalkgroups(mockTalkgroups);
  });

  describe("updateTalkgroups", () => {
    it("should only track enabled talkgroups", () => {
      const activity = scanner.getActivityStatus();
      expect(activity.length).toBe(0); // No activity yet

      // Process some data for disabled talkgroup 102
      const decoded: P25DecodedData = {
        frames: [
          {
            slot: P25TDMASlot.SLOT_1,
            symbols: [],
            bits: createTalkgroupFrame(102),
            timestamp: Date.now(),
            signalQuality: 85,
            isValid: true,
          },
        ],
        isEncrypted: false,
        errorRate: 0.05,
      };

      scanner.processDecodedData(decoded, Date.now());
      const activityAfter = scanner.getActivityStatus();
      expect(activityAfter.length).toBe(0); // Should not track disabled talkgroup
    });
  });

  describe("processDecodedData", () => {
    it("should track activity for enabled talkgroups", () => {
      const timestamp = Date.now();
      const decoded: P25DecodedData = {
        frames: [
          {
            slot: P25TDMASlot.SLOT_1,
            symbols: [],
            bits: createTalkgroupFrame(101),
            timestamp,
            signalQuality: 85,
            isValid: true,
          },
        ],
        isEncrypted: false,
        errorRate: 0.05,
      };

      scanner.processDecodedData(decoded, timestamp);

      const activity = scanner.getTalkgroupActivity(101);
      expect(activity).toBeDefined();
      expect(activity?.isActive).toBe(true);
      expect(activity?.priority).toBe(9);
      expect(activity?.signalQuality).toBe(85);
    });

    it("should handle multiple talkgroups", () => {
      const timestamp = Date.now();
      const decoded: P25DecodedData = {
        frames: [
          {
            slot: P25TDMASlot.SLOT_1,
            symbols: [],
            bits: createTalkgroupFrame(101),
            timestamp,
            signalQuality: 85,
            isValid: true,
          },
          {
            slot: P25TDMASlot.SLOT_2,
            symbols: [],
            bits: createTalkgroupFrame(201),
            timestamp,
            signalQuality: 90,
            isValid: true,
          },
        ],
        isEncrypted: false,
        errorRate: 0.05,
      };

      scanner.processDecodedData(decoded, timestamp);

      expect(scanner.getTalkgroupActivity(101)?.isActive).toBe(true);
      expect(scanner.getTalkgroupActivity(201)?.isActive).toBe(true);
    });

    it("should mark talkgroups as inactive after timeout", () => {
      const timestamp = Date.now();
      scanner.setActivityTimeout(1000); // 1 second timeout

      const decoded: P25DecodedData = {
        frames: [
          {
            slot: P25TDMASlot.SLOT_1,
            symbols: [],
            bits: createTalkgroupFrame(101),
            timestamp,
            signalQuality: 85,
            isValid: true,
          },
        ],
        isEncrypted: false,
        errorRate: 0.05,
      };

      scanner.processDecodedData(decoded, timestamp);
      expect(scanner.getTalkgroupActivity(101)?.isActive).toBe(true);

      // Process again after timeout
      scanner.processDecodedData(
        { frames: [], isEncrypted: false, errorRate: 0 },
        timestamp + 1500,
      );
      expect(scanner.getTalkgroupActivity(101)?.isActive).toBe(false);
    });

    it("should ignore invalid frames", () => {
      const timestamp = Date.now();
      const decoded: P25DecodedData = {
        frames: [
          {
            slot: P25TDMASlot.SLOT_1,
            symbols: [],
            bits: createTalkgroupFrame(101),
            timestamp,
            signalQuality: 85,
            isValid: false, // Invalid frame
          },
        ],
        isEncrypted: false,
        errorRate: 0.05,
      };

      scanner.processDecodedData(decoded, timestamp);
      expect(scanner.getTalkgroupActivity(101)).toBeNull();
    });

    it("should ignore frames with insufficient bits", () => {
      const timestamp = Date.now();
      const decoded: P25DecodedData = {
        frames: [
          {
            slot: P25TDMASlot.SLOT_1,
            symbols: [],
            bits: [1, 0, 1], // Too short
            timestamp,
            signalQuality: 85,
            isValid: true,
          },
        ],
        isEncrypted: false,
        errorRate: 0.05,
      };

      scanner.processDecodedData(decoded, timestamp);
      const activity = scanner.getActivityStatus();
      expect(activity.length).toBe(0);
    });
  });

  describe("shouldSwitch", () => {
    it("should switch to highest priority talkgroup when none selected", () => {
      const timestamp = Date.now();

      // Activate talkgroups with different priorities
      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(301), // Priority 8
              timestamp,
              signalQuality: 85,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp,
      );

      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(101), // Priority 9
              timestamp,
              signalQuality: 90,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp,
      );

      const switchEvent = scanner.shouldSwitch(timestamp);
      expect(switchEvent).not.toBeNull();
      expect(switchEvent?.toTalkgroup).toBe(101); // Highest priority (9)
      expect(switchEvent?.reason).toBe("initial");
    });

    it("should switch to higher priority talkgroup when it becomes active", () => {
      const timestamp = Date.now();

      // Activate lower priority talkgroup
      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(301), // Priority 8
              timestamp,
              signalQuality: 85,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp,
      );

      // Select it
      const initialSwitch = scanner.shouldSwitch(timestamp);
      expect(initialSwitch?.toTalkgroup).toBe(301);
      scanner.setCurrentTalkgroup(301);

      // Now activate higher priority talkgroup
      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(101), // Priority 9
              timestamp: timestamp + 100,
              signalQuality: 90,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp + 100,
      );

      const switchEvent = scanner.shouldSwitch(timestamp + 100);
      expect(switchEvent).not.toBeNull();
      expect(switchEvent?.fromTalkgroup).toBe(301);
      expect(switchEvent?.toTalkgroup).toBe(101);
      expect(switchEvent?.reason).toBe("higher_priority");
    });

    it("should not switch when current talkgroup is highest priority", () => {
      const timestamp = Date.now();

      // Activate highest priority talkgroup
      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(101), // Priority 9
              timestamp,
              signalQuality: 90,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp,
      );

      scanner.setCurrentTalkgroup(101);

      // Activate lower priority talkgroup
      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(301), // Priority 8
              timestamp: timestamp + 100,
              signalQuality: 85,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp + 100,
      );

      const switchEvent = scanner.shouldSwitch(timestamp + 100);
      expect(switchEvent).toBeNull(); // Should stay on 101
    });

    it("should switch when current talkgroup becomes inactive", () => {
      const timestamp = Date.now();
      scanner.setActivityTimeout(1000);

      // Activate two talkgroups
      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(101),
              timestamp,
              signalQuality: 90,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp,
      );

      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(301),
              timestamp,
              signalQuality: 85,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp,
      );

      scanner.setCurrentTalkgroup(301);

      // Let current talkgroup (301) become inactive, but keep 101 active
      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(101),
              timestamp: timestamp + 500,
              signalQuality: 90,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp + 500,
      );

      // After timeout, should switch from inactive 301 to active 101
      scanner.processDecodedData(
        { frames: [], isEncrypted: false, errorRate: 0 },
        timestamp + 1500,
      );

      const switchEvent = scanner.shouldSwitch(timestamp + 1500);
      expect(switchEvent).not.toBeNull();
      expect(switchEvent?.fromTalkgroup).toBe(301);
      expect(switchEvent?.toTalkgroup).toBe(101);
      expect(switchEvent?.reason).toBe("current_ended");
    });

    it("should return null when no talkgroups are active", () => {
      const timestamp = Date.now();
      const switchEvent = scanner.shouldSwitch(timestamp);
      expect(switchEvent).toBeNull();
    });
  });

  describe("clear", () => {
    it("should clear all activity and current talkgroup", () => {
      const timestamp = Date.now();

      scanner.processDecodedData(
        {
          frames: [
            {
              slot: P25TDMASlot.SLOT_1,
              symbols: [],
              bits: createTalkgroupFrame(101),
              timestamp,
              signalQuality: 90,
              isValid: true,
            },
          ],
          isEncrypted: false,
          errorRate: 0,
        },
        timestamp,
      );

      scanner.setCurrentTalkgroup(101);

      expect(scanner.getActivityStatus().length).toBeGreaterThan(0);
      expect(scanner.getCurrentTalkgroup()).toBe(101);

      scanner.clear();

      expect(scanner.getActivityStatus().length).toBe(0);
      expect(scanner.getCurrentTalkgroup()).toBeNull();
    });
  });
});

/**
 * Helper function to create a valid P25 frame with talkgroup ID
 */
function createTalkgroupFrame(talkgroupId: number): number[] {
  const bits: number[] = [];

  // LCW format: 0x00 (Group Voice)
  for (let i = 7; i >= 0; i--) {
    bits.push(0);
  }

  // Talkgroup ID (16 bits)
  for (let i = 15; i >= 0; i--) {
    bits.push((talkgroupId >> i) & 1);
  }

  // Source ID (24 bits) - just use zeros
  for (let i = 0; i < 24; i++) {
    bits.push(0);
  }

  return bits;
}
