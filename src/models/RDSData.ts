/**
 * RDS (Radio Data System) Data Types
 *
 * RDS transmits digital data on FM broadcasts via a 57 kHz subcarrier.
 * Data is organized into groups of 4 blocks, each 26 bits (16 data + 10 checkword).
 *
 * References:
 * - IEC 62106 (RDS Standard)
 * - https://en.wikipedia.org/wiki/Radio_Data_System
 * - https://digitalcommons.andrews.edu/cgi/viewcontent.cgi?article=1003&context=honors
 */

/**
 * RDS Group Types
 * Groups are identified by a 4-bit type code (0-15) and version (A/B)
 */
export enum RDSGroupType {
  BASIC_TUNING_0A = "0A", // Program Service Name (PS)
  BASIC_TUNING_0B = "0B", // Program Service Name (PS)
  RADIO_TEXT_2A = "2A", // Radio Text (RT) - 64 chars
  RADIO_TEXT_2B = "2B", // Radio Text (RT) - 32 chars
  CLOCK_TIME_4A = "4A", // Clock Time and Date
  ALTERNATIVE_FREQ_0A_0B = "0A/0B", // Alternative Frequencies
  PROGRAM_TYPE_10A = "10A", // Program Type Name
  UNKNOWN = "UNKNOWN",
}

/**
 * Program Type Codes (PTY)
 * 0-31 for different program content categories
 */
export enum RDSProgramType {
  NONE = 0,
  NEWS = 1,
  CURRENT_AFFAIRS = 2,
  INFORMATION = 3,
  SPORT = 4,
  EDUCATION = 5,
  DRAMA = 6,
  CULTURE = 7,
  SCIENCE = 8,
  VARIED = 9,
  POP_MUSIC = 10,
  ROCK_MUSIC = 11,
  EASY_LISTENING = 12,
  LIGHT_CLASSICAL = 13,
  SERIOUS_CLASSICAL = 14,
  OTHER_MUSIC = 15,
  WEATHER = 16,
  FINANCE = 17,
  CHILDRENS = 18,
  SOCIAL_AFFAIRS = 19,
  RELIGION = 20,
  PHONE_IN = 21,
  TRAVEL = 22,
  LEISURE = 23,
  JAZZ_MUSIC = 24,
  COUNTRY_MUSIC = 25,
  NATIONAL_MUSIC = 26,
  OLDIES_MUSIC = 27,
  FOLK_MUSIC = 28,
  DOCUMENTARY = 29,
  ALARM_TEST = 30,
  ALARM = 31,
}

/**
 * RDS Block - Single 26-bit block (16 data bits + 10 checkword bits)
 */
export interface RDSBlock {
  data: number; // 16-bit data
  checkword: number; // 10-bit checkword
  offsetWord: string; // A, B, C, C', or D
  valid: boolean; // Checkword validation result
  corrected: boolean; // Whether error correction was applied
  groupType?: number; // Group type code (0-15) extracted from Block B
  groupVersion?: string; // Group version ('A' or 'B') extracted from Block B
}

/**
 * RDS Group - 4 blocks of data
 */
export interface RDSGroup {
  blocks: [RDSBlock, RDSBlock, RDSBlock, RDSBlock];
  groupType: RDSGroupType;
  version: "A" | "B";
  pi: number; // Program Identification (always in Block 1)
  pty: number; // Program Type
  tp: boolean; // Traffic Program flag
  ta: boolean; // Traffic Announcement flag
  timestamp: number; // When this group was decoded
}

/**
 * Complete RDS Station Data
 */
export interface RDSStationData {
  pi: number | null; // Program Identification (country + station code)
  ps: string; // Program Service Name (8 chars)
  pty: RDSProgramType; // Program Type
  rt: string; // Radio Text (64 chars max)
  ct: Date | null; // Clock Time
  af: number[]; // Alternative Frequencies (in Hz)
  tp: boolean; // Traffic Program capability
  ta: boolean; // Traffic Announcement active
  ms: boolean; // Music/Speech flag
  di: number; // Decoder Identification
  lastUpdate: number; // Timestamp of last update
  signalQuality: number; // 0-100 quality metric
}

/**
 * RDS Decoder Statistics
 */
export interface RDSDecoderStats {
  totalGroups: number;
  validGroups: number;
  correctedBlocks: number;
  errorRate: number; // Percentage of blocks with errors
  syncLocked: boolean; // Whether we have block synchronization
  lastSync: number; // Timestamp of last successful sync
}

/**
 * Program Type to human-readable string
 */
export const PTY_NAMES: Record<RDSProgramType, string> = {
  [RDSProgramType.NONE]: "None",
  [RDSProgramType.NEWS]: "News",
  [RDSProgramType.CURRENT_AFFAIRS]: "Current Affairs",
  [RDSProgramType.INFORMATION]: "Information",
  [RDSProgramType.SPORT]: "Sport",
  [RDSProgramType.EDUCATION]: "Education",
  [RDSProgramType.DRAMA]: "Drama",
  [RDSProgramType.CULTURE]: "Culture",
  [RDSProgramType.SCIENCE]: "Science",
  [RDSProgramType.VARIED]: "Varied",
  [RDSProgramType.POP_MUSIC]: "Pop Music",
  [RDSProgramType.ROCK_MUSIC]: "Rock Music",
  [RDSProgramType.EASY_LISTENING]: "Easy Listening",
  [RDSProgramType.LIGHT_CLASSICAL]: "Light Classical",
  [RDSProgramType.SERIOUS_CLASSICAL]: "Serious Classical",
  [RDSProgramType.OTHER_MUSIC]: "Other Music",
  [RDSProgramType.WEATHER]: "Weather",
  [RDSProgramType.FINANCE]: "Finance",
  [RDSProgramType.CHILDRENS]: "Children's Programs",
  [RDSProgramType.SOCIAL_AFFAIRS]: "Social Affairs",
  [RDSProgramType.RELIGION]: "Religion",
  [RDSProgramType.PHONE_IN]: "Phone In",
  [RDSProgramType.TRAVEL]: "Travel",
  [RDSProgramType.LEISURE]: "Leisure",
  [RDSProgramType.JAZZ_MUSIC]: "Jazz Music",
  [RDSProgramType.COUNTRY_MUSIC]: "Country Music",
  [RDSProgramType.NATIONAL_MUSIC]: "National Music",
  [RDSProgramType.OLDIES_MUSIC]: "Oldies Music",
  [RDSProgramType.FOLK_MUSIC]: "Folk Music",
  [RDSProgramType.DOCUMENTARY]: "Documentary",
  [RDSProgramType.ALARM_TEST]: "Alarm Test",
  [RDSProgramType.ALARM]: "Alarm!",
};

/**
 * Create empty RDS station data
 */
export function createEmptyRDSData(): RDSStationData {
  return {
    pi: null,
    ps: "",
    pty: RDSProgramType.NONE,
    rt: "",
    ct: null,
    af: [],
    tp: false,
    ta: false,
    ms: false,
    di: 0,
    lastUpdate: Date.now(),
    signalQuality: 0,
  };
}

/**
 * Format PI code as human-readable string
 * PI code encodes country and station identification
 */
export function formatPICode(pi: number): string {
  if (pi === null || pi === undefined) {
    return "----";
  }
  return pi.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Extract country code from PI code
 * First hex digit (plus first bit of second) encodes country
 */
export function getCountryFromPI(pi: number): string {
  const countryCode = (pi >> 12) & 0xf;

  // Simplified country mapping (US/North America focused)
  if (countryCode === 0x1) {
    return "US";
  }
  if (countryCode === 0xc || countryCode === 0xd || countryCode === 0xe) {
    return "US";
  }
  if (countryCode === 0x2) {
    return "CA";
  }

  return "Unknown";
}
