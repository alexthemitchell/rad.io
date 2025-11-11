/**
 * ATSC Channel Frequency Utilities
 *
 * Provides frequency plan and channel mapping for ATSC digital television
 * broadcasts in North America (post-repack).
 *
 * Channel Bands:
 * - VHF Low (2-6): 54-88 MHz
 * - VHF High (7-13): 174-216 MHz
 * - UHF (14-36): 470-608 MHz (post-repack, no channels 37+)
 *
 * Each channel is 6 MHz wide with pilot tone at +309.44 kHz from lower edge.
 */

/**
 * ATSC channel information
 */
export interface ATSCChannel {
  /** Physical channel number */
  channel: number;
  /** Center frequency in Hz */
  frequency: number;
  /** Lower edge frequency in Hz */
  lowerEdge: number;
  /** Upper edge frequency in Hz */
  upperEdge: number;
  /** Pilot tone frequency in Hz (309.44 kHz offset from lower edge) */
  pilotFrequency: number;
  /** Band designation */
  band: "VHF-Low" | "VHF-High" | "UHF";
}

/**
 * ATSC constants
 */
export const ATSC_CONSTANTS = {
  /** Channel bandwidth in Hz */
  CHANNEL_BANDWIDTH: 6e6,
  /** Pilot tone offset from lower band edge in Hz */
  PILOT_OFFSET: 309440,
  /** Symbol rate in symbols/sec */
  SYMBOL_RATE: 10.76e6,
} as const;

/**
 * VHF Low band channels (2-6)
 * 54-88 MHz
 */
const VHF_LOW_CHANNELS: ATSCChannel[] = [
  { channel: 2, frequency: 57e6 },
  { channel: 3, frequency: 63e6 },
  { channel: 4, frequency: 69e6 },
  { channel: 5, frequency: 79e6 },
  { channel: 6, frequency: 85e6 },
].map((ch) => ({
  ...ch,
  lowerEdge: ch.frequency - ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2,
  upperEdge: ch.frequency + ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2,
  pilotFrequency:
    ch.frequency -
    ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2 +
    ATSC_CONSTANTS.PILOT_OFFSET,
  band: "VHF-Low" as const,
}));

/**
 * VHF High band channels (7-13)
 * 174-216 MHz
 */
const VHF_HIGH_CHANNELS: ATSCChannel[] = [
  { channel: 7, frequency: 177e6 },
  { channel: 8, frequency: 183e6 },
  { channel: 9, frequency: 189e6 },
  { channel: 10, frequency: 195e6 },
  { channel: 11, frequency: 201e6 },
  { channel: 12, frequency: 207e6 },
  { channel: 13, frequency: 213e6 },
].map((ch) => ({
  ...ch,
  lowerEdge: ch.frequency - ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2,
  upperEdge: ch.frequency + ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2,
  pilotFrequency:
    ch.frequency -
    ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2 +
    ATSC_CONSTANTS.PILOT_OFFSET,
  band: "VHF-High" as const,
}));

/**
 * UHF band channels (14-36, post-repack)
 * 470-608 MHz
 */
const UHF_CHANNELS: ATSCChannel[] = Array.from({ length: 23 }, (_, i) => {
  const channel = i + 14;
  const frequency = 470e6 + i * ATSC_CONSTANTS.CHANNEL_BANDWIDTH + 3e6; // Center freq
  return {
    channel,
    frequency,
    lowerEdge: frequency - ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2,
    upperEdge: frequency + ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2,
    pilotFrequency:
      frequency -
      ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2 +
      ATSC_CONSTANTS.PILOT_OFFSET,
    band: "UHF" as const,
  };
});

/**
 * Complete ATSC channel map (channels 2-36)
 */
export const ATSC_CHANNELS: ReadonlyArray<ATSCChannel> = [
  ...VHF_LOW_CHANNELS,
  ...VHF_HIGH_CHANNELS,
  ...UHF_CHANNELS,
];

/**
 * Get ATSC channel by channel number
 */
export function getATSCChannel(channel: number): ATSCChannel | undefined {
  return ATSC_CHANNELS.find((ch) => ch.channel === channel);
}

/**
 * Get ATSC channel by frequency (finds closest channel)
 */
export function getATSCChannelByFrequency(
  frequency: number,
): ATSCChannel | undefined {
  let closest: ATSCChannel | undefined;
  let minDistance = Infinity;

  for (const channel of ATSC_CHANNELS) {
    const distance = Math.abs(channel.frequency - frequency);
    if (distance < minDistance) {
      minDistance = distance;
      closest = channel;
    }
  }

  // Only return if within channel bandwidth
  if (
    closest &&
    minDistance < ATSC_CONSTANTS.CHANNEL_BANDWIDTH / 2 &&
    frequency >= closest.lowerEdge &&
    frequency <= closest.upperEdge
  ) {
    return closest;
  }

  return undefined;
}

/**
 * Get all channels in a specific band
 */
export function getATSCChannelsByBand(
  band: "VHF-Low" | "VHF-High" | "UHF",
): ATSCChannel[] {
  return ATSC_CHANNELS.filter((ch) => ch.band === band);
}

/**
 * Get frequency range for all ATSC channels
 */
export function getATSCFrequencyRange(): { min: number; max: number } {
  return {
    min: VHF_LOW_CHANNELS[0]?.lowerEdge ?? 54e6,
    max: UHF_CHANNELS[UHF_CHANNELS.length - 1]?.upperEdge ?? 608e6,
  };
}

/**
 * Check if a frequency is within an ATSC channel
 */
export function isFrequencyInATSCChannel(frequency: number): boolean {
  return getATSCChannelByFrequency(frequency) !== undefined;
}

/**
 * Format ATSC channel for display
 */
export function formatATSCChannel(channel: ATSCChannel): string {
  return `Ch ${channel.channel} (${(channel.frequency / 1e6).toFixed(1)} MHz, ${channel.band})`;
}
