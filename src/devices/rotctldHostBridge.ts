export const ROTCTLD_BRIDGE_CAPABILITY_ID = 'rotctld-control';

export type RotctldHostBridgeRequest = {
  command: string;
  timeoutMs: number;
};

export type RotctldHostBridgeResponse = {
  ok: boolean;
  responseText?: string;
  diagnostics?: string[];
};

export type RotctldBridgeProbe = {
  available: boolean;
  providerLabel?: string;
  reason?: string;
};

export type RotctldHostBridgeApi = {
  providerLabel?: string;
  protocolVersion: number;
  capabilities: readonly string[];
  runRotctldCommand: (request: RotctldHostBridgeRequest) => Promise<RotctldHostBridgeResponse>;
};

type HostWindowLike = {
  __RADIO_HOST_BRIDGE__?: unknown;
};

const asBridgeApi = (candidate: unknown): RotctldHostBridgeApi | null => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const bridge = candidate as Partial<RotctldHostBridgeApi>;
  if (typeof bridge.runRotctldCommand !== 'function') {
    return null;
  }

  if (!Number.isFinite(bridge.protocolVersion ?? NaN)) {
    return null;
  }

  if (!Array.isArray(bridge.capabilities) || !bridge.capabilities.every((entry) => typeof entry === 'string')) {
    return null;
  }

  return {
    providerLabel: bridge.providerLabel,
    protocolVersion: bridge.protocolVersion ?? 0,
    capabilities: bridge.capabilities,
    runRotctldCommand: bridge.runRotctldCommand
  };
};

export const probeRotctldHostBridge = (
  hostWindow: HostWindowLike | null = typeof window === 'undefined' ? null : (window as HostWindowLike)
): RotctldBridgeProbe & { bridge: RotctldHostBridgeApi | null } => {
  if (!hostWindow) {
    return {
      available: false,
      reason: 'Host bridge probe unavailable outside browser window context.',
      bridge: null
    };
  }

  const bridge = asBridgeApi(hostWindow.__RADIO_HOST_BRIDGE__);
  if (!bridge) {
    return {
      available: false,
      reason: 'window.__RADIO_HOST_BRIDGE__ missing or invalid for rotctld.',
      bridge: null
    };
  }

  if (bridge.protocolVersion < 1) {
    return {
      available: false,
      reason: `Unsupported host bridge protocol version ${bridge.protocolVersion}.`,
      providerLabel: bridge.providerLabel,
      bridge: null
    };
  }

  if (!bridge.capabilities.includes(ROTCTLD_BRIDGE_CAPABILITY_ID)) {
    return {
      available: false,
      reason: 'Host bridge connected but rotctld-control capability is not advertised.',
      providerLabel: bridge.providerLabel,
      bridge: null
    };
  }

  return {
    available: true,
    providerLabel: bridge.providerLabel,
    bridge
  };
};

const sanitizeCommand = (command: string): string => {
  const trimmed = command.trim();
  const withoutLineBreaks = trimmed.replace(/[\r\n]+/g, ' ');
  return withoutLineBreaks.slice(0, 256);
};

const sanitizeResponse = (response: RotctldHostBridgeResponse): RotctldHostBridgeResponse => {
  const diagnostics = Array.isArray(response.diagnostics)
    ? response.diagnostics.filter((entry) => typeof entry === 'string').slice(0, 16)
    : [];

  return {
    ok: Boolean(response.ok),
    responseText: typeof response.responseText === 'string' ? response.responseText.slice(0, 4096) : undefined,
    diagnostics
  };
};

export const runRotctldCommandViaHostBridge = async (input: {
  bridge: RotctldHostBridgeApi;
  command: string;
  timeoutMs?: number;
}): Promise<RotctldHostBridgeResponse> => {
  const command = sanitizeCommand(input.command);
  if (command.length === 0) {
    throw new Error('rotctld command cannot be empty.');
  }

  const timeoutMs = Number.isFinite(input.timeoutMs) ? Math.max(250, Math.min(30_000, Math.round(input.timeoutMs ?? 3_000))) : 3_000;

  const response = await input.bridge.runRotctldCommand({
    command,
    timeoutMs
  });

  return sanitizeResponse(response);
};
