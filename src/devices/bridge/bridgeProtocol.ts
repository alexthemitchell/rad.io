export const BRIDGE_PROTOCOL_VERSION = 1;

export type BridgeTransportSecurityMode = 'local-only' | 'paired-token';

export type BridgeCapabilityDescriptor = {
  id: string;
  label: string;
  enabled: boolean;
};

export type BridgeHandshakeRequest = {
  version: number;
  clientName: string;
  requestedCapabilities: string[];
  securityMode: BridgeTransportSecurityMode;
};

export type BridgeHandshakeResponse = {
  version: number;
  accepted: boolean;
  reason?: string;
  capabilities: BridgeCapabilityDescriptor[];
  requiresToken: boolean;
};

export const createHandshakeRequest = (
  clientName: string,
  requestedCapabilities: string[],
  securityMode: BridgeTransportSecurityMode = 'paired-token'
): BridgeHandshakeRequest => ({
  version: BRIDGE_PROTOCOL_VERSION,
  clientName,
  requestedCapabilities: [...new Set(requestedCapabilities)],
  securityMode
});

export const validateHandshakeRequest = (request: BridgeHandshakeRequest): string[] => {
  const issues: string[] = [];

  if (request.version !== BRIDGE_PROTOCOL_VERSION) {
    issues.push(`unsupported protocol version ${request.version}`);
  }

  if (!request.clientName.trim()) {
    issues.push('client name is required');
  }

  if (request.securityMode === 'local-only' && request.requestedCapabilities.includes('remote-tcp')) {
    issues.push('local-only security mode cannot request remote transport capabilities');
  }

  return issues;
};

export const buildHandshakeResponse = (
  request: BridgeHandshakeRequest,
  capabilities: BridgeCapabilityDescriptor[]
): BridgeHandshakeResponse => {
  const issues = validateHandshakeRequest(request);
  if (issues.length > 0) {
    return {
      version: BRIDGE_PROTOCOL_VERSION,
      accepted: false,
      reason: issues.join('; '),
      capabilities: [],
      requiresToken: request.securityMode === 'paired-token'
    };
  }

  return {
    version: BRIDGE_PROTOCOL_VERSION,
    accepted: true,
    capabilities,
    requiresToken: request.securityMode === 'paired-token'
  };
};
