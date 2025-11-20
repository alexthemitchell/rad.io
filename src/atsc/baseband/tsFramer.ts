// Placeholder for MPEG-2 TS framing from decoded RS packets.
export function frameTransportStream(_rsPackets: Uint8Array): Uint8Array {
  // Future: extract 188-byte packets, verify sync byte 0x47 alignment.
  return new Uint8Array(0);
}
