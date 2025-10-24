/**
 * Minimal branch bump for rdsDecoder: expire a TMC message via private map and call getTMCMessages
 */

import { createRDSDecoder } from "../rdsDecoder";

// Minimal TMC message shape to satisfy usage
type MinimalTMCMessage = {
  id: number;
  eventCode: number;
  location: number;
  direction: number;
  extent: number;
  severity: number;
  startTime: number;
  expiresAt?: number;
};

describe("rdsDecoder extra branches", () => {
  it("removes expired TMC messages on access", () => {
    const dec = createRDSDecoder(228000) as any;

    // Inject an expired message into private map, then call getTMCMessages to trigger cleanup branch
    const expired: MinimalTMCMessage = {
      id: 1,
      eventCode: 42,
      location: 100,
      direction: 0,
      extent: 1,
      severity: 3,
      startTime: Date.now() - 10_000,
      expiresAt: Date.now() - 1,
    };

    if (!dec.tmcMessages) {
      dec.tmcMessages = new Map<number, MinimalTMCMessage>();
    }
    dec.tmcMessages.set(1, expired);

    const msgs = dec.getTMCMessages();
    // Should be empty after cleanup of expired
    expect(Array.isArray(msgs)).toBe(true);
    expect(msgs.length).toBe(0);
  });
});
