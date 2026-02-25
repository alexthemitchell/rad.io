import { describe, expect, it } from 'vitest';
import { issueBridgeToken, validateBridgeToken } from './bridgeAuth';

describe('bridgeAuth', () => {
  const secret = 'test-secret';
  const now = 1_000_000;

  it('issues and validates token before expiry', () => {
    const token = issueBridgeToken({
      peerId: 'peer-1',
      nowUnixMs: now,
      ttlMs: 10_000,
      secret,
      nonce: 'fixed'
    });

    const verdict = validateBridgeToken(token, now + 5_000, secret);
    expect(verdict.valid).toBe(true);
  });

  it('rejects expired token', () => {
    const token = issueBridgeToken({
      peerId: 'peer-1',
      nowUnixMs: now,
      ttlMs: 1_000,
      secret,
      nonce: 'fixed'
    });

    const verdict = validateBridgeToken(token, now + 1_500, secret);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe('expired');
  });

  it('rejects tampered token signature', () => {
    const token = issueBridgeToken({
      peerId: 'peer-1',
      nowUnixMs: now,
      ttlMs: 10_000,
      secret,
      nonce: 'fixed'
    });

    const verdict = validateBridgeToken({ ...token, peerId: 'peer-2' }, now + 100, secret);
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toBe('bad-signature');
  });
});
