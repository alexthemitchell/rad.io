const fnv1a = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export type BridgeTokenPayload = {
  peerId: string;
  issuedAtUnixMs: number;
  expiresAtUnixMs: number;
  nonce: string;
  signature: string;
};

export type IssueBridgeTokenOptions = {
  peerId: string;
  nowUnixMs: number;
  ttlMs: number;
  secret: string;
  nonce?: string;
};

const canonical = (payload: Omit<BridgeTokenPayload, 'signature'>, secret: string): string =>
  `${payload.peerId}|${payload.issuedAtUnixMs}|${payload.expiresAtUnixMs}|${payload.nonce}|${secret}`;

export const issueBridgeToken = (options: IssueBridgeTokenOptions): BridgeTokenPayload => {
  const nonce = options.nonce ?? `${options.nowUnixMs.toString(36)}-${options.peerId}`;
  const unsigned = {
    peerId: options.peerId,
    issuedAtUnixMs: options.nowUnixMs,
    expiresAtUnixMs: options.nowUnixMs + Math.max(1, options.ttlMs),
    nonce
  };

  return {
    ...unsigned,
    signature: fnv1a(canonical(unsigned, options.secret))
  };
};

export const validateBridgeToken = (
  token: BridgeTokenPayload,
  nowUnixMs: number,
  secret: string
): { valid: boolean; reason?: string } => {
  if (token.expiresAtUnixMs <= nowUnixMs) {
    return { valid: false, reason: 'expired' };
  }

  if (token.issuedAtUnixMs > nowUnixMs + 5_000) {
    return { valid: false, reason: 'issued-in-future' };
  }

  const expectedSignature = fnv1a(
    canonical(
      {
        peerId: token.peerId,
        issuedAtUnixMs: token.issuedAtUnixMs,
        expiresAtUnixMs: token.expiresAtUnixMs,
        nonce: token.nonce
      },
      secret
    )
  );

  if (token.signature !== expectedSignature) {
    return { valid: false, reason: 'bad-signature' };
  }

  return { valid: true };
};
