import { describe, expect, it } from 'vitest';
import {
  BRIDGE_PROTOCOL_VERSION,
  buildHandshakeResponse,
  createHandshakeRequest,
  validateHandshakeRequest
} from './bridgeProtocol';

describe('bridgeProtocol', () => {
  it('creates a deduplicated handshake request', () => {
    const request = createHandshakeRequest('rad.io', ['stream', 'stream', 'diag']);
    expect(request.version).toBe(BRIDGE_PROTOCOL_VERSION);
    expect(request.requestedCapabilities).toEqual(['stream', 'diag']);
  });

  it('rejects invalid local-only remote capability request', () => {
    const request = createHandshakeRequest('client', ['remote-tcp'], 'local-only');
    expect(validateHandshakeRequest(request)).toContain(
      'local-only security mode cannot request remote transport capabilities'
    );
  });

  it('returns accepted response when request is valid', () => {
    const request = createHandshakeRequest('client', ['stream']);
    const response = buildHandshakeResponse(request, [{ id: 'stream', label: 'IQ Stream', enabled: true }]);

    expect(response.accepted).toBe(true);
    expect(response.reason).toBeUndefined();
    expect(response.requiresToken).toBe(true);
  });
});
