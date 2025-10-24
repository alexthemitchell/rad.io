/**
 * TMC (Traffic Message Channel) Data Types
 *
 * Implements data structures for RDS-TMC (Radio Data System - Traffic Message Channel)
 * traffic and travel information messages transmitted via RDS Group 8A.
 *
 * References:
 * - ISO 14819-1: RDS-TMC coding protocol (ALERT-C)
 * - ISO 14819-2: Event and location codes
 * - https://en.wikipedia.org/wiki/Traffic_message_channel
 *
 * Note: Numeric keys in event code maps are from TMC specification and are intentional.
 */

/* eslint-disable @typescript-eslint/naming-convention */
 */

/**
 * TMC Event Categories (simplified from ISO 14819-2)
 */
export enum TMCEventCategory {
  TRAFFIC_JAM = 0,
  ACCIDENT = 1,
  ROADWORKS = 2,
  WEATHER = 3,
  ROAD_CLOSURE = 4,
  WARNING = 5,
  DELAY = 6,
  OTHER = 7,
}

/**
 * TMC Event Severity Levels
 */
export enum TMCEventSeverity {
  NONE = 0,
  MINOR = 1,
  MODERATE = 2,
  SEVERE = 3,
  CRITICAL = 4,
}

/**
 * Direction of traffic affected
 */
export enum TMCDirection {
  POSITIVE = 0, // Increasing location code direction
  NEGATIVE = 1, // Decreasing location code direction
  BOTH = 2, // Both directions
}

/**
 * TMC Duration codes (3 bits)
 */
export enum TMCDuration {
  NO_DURATION = 0,
  MINUTES_15 = 1,
  MINUTES_30 = 2,
  HOUR_1 = 3,
  HOURS_2 = 4,
  HOURS_3_TO_4 = 5,
  HOURS_4_TO_8 = 6,
  LONGER_THAN_8_HOURS = 7,
}

/**
 * TMC Extent codes (3 bits) - length of affected road segment
 */
export enum TMCExtent {
  LOCATION_ONLY = 0,
  PLUS_1_LOCATION = 1,
  PLUS_2_LOCATIONS = 2,
  PLUS_3_LOCATIONS = 3,
  PLUS_4_LOCATIONS = 4,
  PLUS_5_LOCATIONS = 5,
  PLUS_6_LOCATIONS = 6,
  PLUS_7_OR_MORE = 7,
}

/**
 * Core TMC Message structure from RDS Group 8A
 */
export interface TMCMessage {
  // Message identification
  messageId: number; // Unique ID for this message (from continuity index)

  // Event information
  eventCode: number; // 11-bit event code (ISO 14819-2)
  eventText: string; // Human-readable event description
  category: TMCEventCategory;
  severity: TMCEventSeverity;

  // Location information
  locationCode: number; // 16-bit location code
  locationText: string; // Human-readable location (if available)
  direction: TMCDirection;

  // Extent and duration
  extent: TMCExtent; // How far the event extends
  extentText: string; // Human-readable extent
  duration: TMCDuration; // How long the event will last
  durationText: string; // Human-readable duration

  // Additional flags
  diversionAdvice: boolean; // Diversion recommended
  urgency: number; // Urgency level (0-3)

  // Metadata
  receivedAt: number; // Timestamp when message was received
  expiresAt: number | null; // Estimated expiration time
  updateCount: number; // How many times this message was updated
}

/**
 * TMC Decoder Statistics
 */
export interface TMCDecoderStats {
  messagesReceived: number; // Total messages parsed
  messagesActive: number; // Currently active messages
  lastMessageAt: number; // Timestamp of last message
  group8ACount: number; // Number of Group 8A blocks processed
  parseErrors: number; // Number of parse errors
}

/**
 * Event code mapping (simplified subset of ISO 14819-2)
 * Full implementation would include ~2000 codes from the standard
 */
export const TMC_EVENT_CODES: Record<
  number,
  { text: string; category: TMCEventCategory; severity: TMCEventSeverity }
> = {
  // Traffic flow (0-99)
  1: {
    text: "Traffic congestion",
    category: TMCEventCategory.TRAFFIC_JAM,
    severity: TMCEventSeverity.MODERATE,
  },
  2: {
    text: "Queue forming",
    category: TMCEventCategory.TRAFFIC_JAM,
    severity: TMCEventSeverity.MINOR,
  },
  3: {
    text: "Slow traffic",
    category: TMCEventCategory.TRAFFIC_JAM,
    severity: TMCEventSeverity.MINOR,
  },
  4: {
    text: "Heavy traffic",
    category: TMCEventCategory.TRAFFIC_JAM,
    severity: TMCEventSeverity.MODERATE,
  },
  5: {
    text: "Stationary traffic",
    category: TMCEventCategory.TRAFFIC_JAM,
    severity: TMCEventSeverity.SEVERE,
  },

  // Accidents (100-199)
  101: {
    text: "Accident",
    category: TMCEventCategory.ACCIDENT,
    severity: TMCEventSeverity.SEVERE,
  },
  102: {
    text: "Serious accident",
    category: TMCEventCategory.ACCIDENT,
    severity: TMCEventSeverity.CRITICAL,
  },
  103: {
    text: "Multi-vehicle accident",
    category: TMCEventCategory.ACCIDENT,
    severity: TMCEventSeverity.CRITICAL,
  },
  104: {
    text: "Vehicle on fire",
    category: TMCEventCategory.ACCIDENT,
    severity: TMCEventSeverity.CRITICAL,
  },

  // Roadworks (200-299)
  201: {
    text: "Roadworks",
    category: TMCEventCategory.ROADWORKS,
    severity: TMCEventSeverity.MINOR,
  },
  202: {
    text: "Long-term roadworks",
    category: TMCEventCategory.ROADWORKS,
    severity: TMCEventSeverity.MODERATE,
  },
  203: {
    text: "Lane closure",
    category: TMCEventCategory.ROADWORKS,
    severity: TMCEventSeverity.MODERATE,
  },

  // Weather (300-399)
  301: {
    text: "Poor visibility",
    category: TMCEventCategory.WEATHER,
    severity: TMCEventSeverity.MODERATE,
  },
  302: {
    text: "Heavy rain",
    category: TMCEventCategory.WEATHER,
    severity: TMCEventSeverity.MODERATE,
  },
  303: {
    text: "Snow",
    category: TMCEventCategory.WEATHER,
    severity: TMCEventSeverity.MODERATE,
  },
  304: {
    text: "Ice",
    category: TMCEventCategory.WEATHER,
    severity: TMCEventSeverity.SEVERE,
  },
  305: {
    text: "Fog",
    category: TMCEventCategory.WEATHER,
    severity: TMCEventSeverity.MODERATE,
  },

  // Road closures (400-499)
  401: {
    text: "Road closed",
    category: TMCEventCategory.ROAD_CLOSURE,
    severity: TMCEventSeverity.CRITICAL,
  },
  402: {
    text: "Carriageway closed",
    category: TMCEventCategory.ROAD_CLOSURE,
    severity: TMCEventSeverity.SEVERE,
  },

  // Warnings (500-599)
  501: {
    text: "Traffic warning",
    category: TMCEventCategory.WARNING,
    severity: TMCEventSeverity.MINOR,
  },
  502: {
    text: "Danger",
    category: TMCEventCategory.WARNING,
    severity: TMCEventSeverity.SEVERE,
  },

  // Delays (600-699)
  601: {
    text: "Long delays",
    category: TMCEventCategory.DELAY,
    severity: TMCEventSeverity.MODERATE,
  },
  602: {
    text: "Very long delays",
    category: TMCEventCategory.DELAY,
    severity: TMCEventSeverity.SEVERE,
  },
};

/**
 * Get event information from event code
 */
export function getEventInfo(eventCode: number): {
  text: string;
  category: TMCEventCategory;
  severity: TMCEventSeverity;
} {
  return (
    TMC_EVENT_CODES[eventCode] || {
      text: `Unknown event (${eventCode})`,
      category: TMCEventCategory.OTHER,
      severity: TMCEventSeverity.NONE,
    }
  );
}

/**
 * Format duration code into human-readable text
 */
export function formatDuration(duration: TMCDuration): string {
  switch (duration) {
    case TMCDuration.NO_DURATION:
      return "Duration unknown";
    case TMCDuration.MINUTES_15:
      return "~15 minutes";
    case TMCDuration.MINUTES_30:
      return "~30 minutes";
    case TMCDuration.HOUR_1:
      return "~1 hour";
    case TMCDuration.HOURS_2:
      return "~2 hours";
    case TMCDuration.HOURS_3_TO_4:
      return "3-4 hours";
    case TMCDuration.HOURS_4_TO_8:
      return "4-8 hours";
    case TMCDuration.LONGER_THAN_8_HOURS:
      return ">8 hours";
    default:
      return "Unknown";
  }
}

/**
 * Format extent code into human-readable text
 */
export function formatExtent(extent: TMCExtent): string {
  switch (extent) {
    case TMCExtent.LOCATION_ONLY:
      return "At location";
    case TMCExtent.PLUS_1_LOCATION:
      return "+1 location";
    case TMCExtent.PLUS_2_LOCATIONS:
      return "+2 locations";
    case TMCExtent.PLUS_3_LOCATIONS:
      return "+3 locations";
    case TMCExtent.PLUS_4_LOCATIONS:
      return "+4 locations";
    case TMCExtent.PLUS_5_LOCATIONS:
      return "+5 locations";
    case TMCExtent.PLUS_6_LOCATIONS:
      return "+6 locations";
    case TMCExtent.PLUS_7_OR_MORE:
      return "+7 or more locations";
    default:
      return "Unknown";
  }
}

/**
 * Format direction into human-readable text
 */
export function formatDirection(direction: TMCDirection): string {
  switch (direction) {
    case TMCDirection.POSITIVE:
      return "Positive direction";
    case TMCDirection.NEGATIVE:
      return "Negative direction";
    case TMCDirection.BOTH:
      return "Both directions";
    default:
      return "Unknown";
  }
}

/**
 * Get severity color for UI display
 */
export function getSeverityColor(severity: TMCEventSeverity): string {
  switch (severity) {
    case TMCEventSeverity.NONE:
      return "#888";
    case TMCEventSeverity.MINOR:
      return "#3498db"; // Blue
    case TMCEventSeverity.MODERATE:
      return "#f39c12"; // Orange
    case TMCEventSeverity.SEVERE:
      return "#e74c3c"; // Red
    case TMCEventSeverity.CRITICAL:
      return "#c0392b"; // Dark red
    default:
      return "#888";
  }
}

/**
 * Create an empty TMC statistics object
 */
export function createEmptyTMCStats(): TMCDecoderStats {
  return {
    messagesReceived: 0,
    messagesActive: 0,
    lastMessageAt: 0,
    group8ACount: 0,
    parseErrors: 0,
  };
}
