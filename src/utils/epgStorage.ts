/**
 * EPG Data Storage
 *
 * Manages storage and retrieval of Electronic Program Guide data
 * extracted from ATSC PSIP tables (EIT and ETT).
 */

import {
  decodeMultipleStringStructure,
  gpsTimeToDate,
} from "./psipTextDecoder";
import type {
  EventInformationTable,
  ExtendedTextTable,
  VirtualChannel,
} from "../parsers/TransportStreamParser";

/**
 * Represents a single program in the EPG
 */
export interface EPGProgram {
  eventId: number;
  channelSourceId: number;
  channelNumber: string; // e.g., "7.1"
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  genres: string[];
  rating: string | null;
  isHD: boolean;
  languageCode: string;
}

/**
 * EPG data organized by channel
 */
export interface EPGChannelData {
  sourceId: number;
  channelNumber: string;
  channelName: string;
  programs: EPGProgram[];
}

/**
 * EPG Storage Manager
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class EPGStorage {
  private static readonly STORAGE_KEY = "rad_io_epg_data";
  private static readonly MAX_AGE_HOURS = 24; // Keep EPG data for 24 hours

  /**
   * Store EPG data from EIT/ETT tables
   *
   * @param eit - Event Information Table
   * @param ett - Extended Text Table (optional)
   * @param channel - Virtual Channel information
   */
  public static storeEPGData(
    eit: EventInformationTable,
    ett: ExtendedTextTable | null,
    channel: VirtualChannel,
  ): void {
    const channelNumber = `${channel.majorChannelNumber}.${channel.minorChannelNumber}`;
    const programs: EPGProgram[] = eit.events.map((event) => {
      const startTime = gpsTimeToDate(event.startTime);
      const endTime = new Date(
        startTime.getTime() + event.lengthInSeconds * 1000,
      );

      // Decode title
      const title = decodeMultipleStringStructure(event.title) || "Unknown";

      // Try to get extended description from ETT
      let description = "";
      if (ett && ett.ettTableIdExtension === event.eventid) {
        description = decodeMultipleStringStructure(ett.extendedTextMessage);
      }

      // Parse genre and rating from descriptors
      const { genres, rating } = parseDescriptors(event.descriptors);

      return {
        eventId: event.eventid,
        channelSourceId: eit.sourceid,
        channelNumber,
        title,
        description,
        startTime,
        endTime,
        durationSeconds: event.lengthInSeconds,
        genres,
        rating,
        isHD: channel.serviceType === 0x02, // ATSC Digital Television
        languageCode: event.title[0]?.iso639LanguageCode ?? "eng",
      };
    });

    // Get existing EPG data
    const existingData = this.getAllEPGData();

    // Update or add channel data
    const channelIndex = existingData.findIndex(
      (ch) => ch.sourceId === eit.sourceid,
    );

    const channelData: EPGChannelData = {
      sourceId: eit.sourceid,
      channelNumber,
      channelName: channel.shortName,
      programs,
    };

    if (channelIndex >= 0) {
      existingData[channelIndex] = channelData;
    } else {
      existingData.push(channelData);
    }

    // Save to localStorage
    this.saveEPGData(existingData);
  }

  /**
   * Get all stored EPG data
   *
   * @returns Array of EPG channel data
   */
  public static getAllEPGData(): EPGChannelData[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored) as {
        timestamp: number;
        data: EPGChannelData[];
      };

      // Check if data is too old
      const age = Date.now() - parsed.timestamp;
      const maxAge = this.MAX_AGE_HOURS * 60 * 60 * 1000;
      if (age > maxAge) {
        this.clearEPGData();
        return [];
      }

      // Convert date strings back to Date objects
      return parsed.data.map((channel) => ({
        ...channel,
        programs: channel.programs.map((program) => ({
          ...program,
          startTime: new Date(program.startTime),
          endTime: new Date(program.endTime),
        })),
      }));
    } catch (error) {
      console.error("Error loading EPG data:", error);
      return [];
    }
  }

  /**
   * Get EPG data for a specific channel
   *
   * @param sourceId - Channel source ID
   * @returns EPG channel data or null
   */
  public static getChannelEPGData(sourceId: number): EPGChannelData | null {
    const allData = this.getAllEPGData();
    return allData.find((ch) => ch.sourceId === sourceId) ?? null;
  }

  /**
   * Get programs currently airing
   *
   * @param now - Current time (defaults to now)
   * @returns Array of currently airing programs
   */
  public static getCurrentPrograms(now: Date = new Date()): EPGProgram[] {
    const allData = this.getAllEPGData();
    const currentPrograms: EPGProgram[] = [];

    allData.forEach((channel) => {
      const current = channel.programs.find(
        (program) => program.startTime <= now && program.endTime > now,
      );
      if (current) {
        currentPrograms.push(current);
      }
    });

    return currentPrograms;
  }

  /**
   * Search programs by title or description
   *
   * @param query - Search query
   * @returns Array of matching programs
   */
  public static searchPrograms(query: string): EPGProgram[] {
    const allData = this.getAllEPGData();
    const lowerQuery = query.toLowerCase();
    const results: EPGProgram[] = [];

    allData.forEach((channel) => {
      channel.programs.forEach((program) => {
        if (
          program.title.toLowerCase().includes(lowerQuery) ||
          program.description.toLowerCase().includes(lowerQuery)
        ) {
          results.push(program);
        }
      });
    });

    return results;
  }

  /**
   * Filter programs by genre
   *
   * @param genre - Genre to filter by
   * @returns Array of programs in the genre
   */
  public static filterByGenre(genre: string): EPGProgram[] {
    const allData = this.getAllEPGData();
    const results: EPGProgram[] = [];

    allData.forEach((channel) => {
      channel.programs.forEach((program) => {
        if (program.genres.includes(genre)) {
          results.push(program);
        }
      });
    });

    return results;
  }

  /**
   * Get all unique genres from stored programs
   *
   * @returns Array of genre strings
   */
  public static getAllGenres(): string[] {
    const allData = this.getAllEPGData();
    const genreSet = new Set<string>();

    allData.forEach((channel) => {
      channel.programs.forEach((program) => {
        program.genres.forEach((genre) => genreSet.add(genre));
      });
    });

    return Array.from(genreSet).sort();
  }

  /**
   * Clear all EPG data
   */
  public static clearEPGData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Save EPG data to localStorage
   *
   * @param data - EPG data to save
   */
  private static saveEPGData(data: EPGChannelData[]): void {
    try {
      const toStore = {
        timestamp: Date.now(),
        data,
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error("Error saving EPG data:", error);
    }
  }
}

/**
 * Parse ATSC descriptors for genre and rating information
 *
 * @param descriptors - Array of PSIP descriptors
 * @returns Object with genres and rating
 */
function parseDescriptors(
  descriptors: Array<{ tag: number; length: number; data: Uint8Array }>,
): { genres: string[]; rating: string | null } {
  const genres: string[] = [];
  let rating: string | null = null;

  descriptors.forEach((descriptor) => {
    switch (descriptor.tag) {
      case 0xa0: // Content Advisory Descriptor
        rating = parseContentAdvisoryDescriptor(descriptor.data);
        break;
      case 0xa1: // Genre Descriptor
        genres.push(...parseGenreDescriptor(descriptor.data));
        break;
      // Add more descriptor types as needed
      default:
        break;
    }
  });

  return { genres, rating };
}

/**
 * Parse Content Advisory Descriptor (ATSC A/65)
 *
 * @param data - Descriptor data
 * @returns Rating string or null
 */
function parseContentAdvisoryDescriptor(data: Uint8Array): string | null {
  // Simplified parsing - full implementation would parse rating regions
  // For now, return null; can be enhanced later
  if (data.length < 1) {
    return null;
  }

  // Rating region table parsing would go here
  return null;
}

/**
 * Parse Genre Descriptor
 *
 * @param data - Descriptor data
 * @returns Array of genre strings
 */
function parseGenreDescriptor(data: Uint8Array): string[] {
  const genres: string[] = [];

  // ATSC genre codes (simplified)
  const genreMap = new Map<number, string>([
    [0x01, "News"],
    [0x02, "Sports"],
    [0x03, "Talk Show"],
    [0x04, "Drama"],
    [0x05, "Comedy"],
    [0x06, "Documentary"],
    [0x07, "Music"],
    [0x08, "Movies"],
    [0x09, "Children"],
    [0x0a, "Educational"],
    [0x0b, "Reality"],
    [0x0c, "Game Show"],
  ]);

  for (const genreCode of data) {
    const genreName = genreMap.get(genreCode);
    if (genreName !== undefined) {
      genres.push(genreName);
    }
  }

  return genres;
}
