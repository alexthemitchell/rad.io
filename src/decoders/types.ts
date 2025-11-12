/**
 * Shared types for ATSC decoders
 */

/**
 * PES (Packetized Elementary Stream) Header
 */
export interface PESHeader {
  streamId: number;
  packetLength: number;
  pts?: number; // Presentation timestamp (33-bit, 90 kHz clock)
  dts?: number; // Decode timestamp (33-bit, 90 kHz clock)
  headerDataLength: number;
}

/**
 * Decoder state
 */
export type DecoderState =
  | "unconfigured"
  | "configured"
  | "decoding"
  | "flushing"
  | "error"
  | "closed";

/**
 * Decoder error callback
 */
export type DecoderErrorCallback = (error: Error) => void;
