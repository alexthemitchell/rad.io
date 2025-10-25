/**
 * Calibration Manager
 * Handles frequency, power, and IQ calibration profiles
 */

import type {
  CalibrationProfile,
  FrequencyCalibration,
  PowerCalibration,
  IQCalibration,
} from "./types";

/**
 * Manages device calibration profiles
 */
export class CalibrationManager {
  private profiles = new Map<string, CalibrationProfile>();
  private storageKey = "rad.io:calibration-profiles";

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Get calibration profile for a device
   */
  getProfile(deviceId: string): CalibrationProfile | undefined {
    return this.profiles.get(deviceId);
  }

  /**
   * Create or update calibration profile
   */
  setProfile(profile: CalibrationProfile): void {
    const updatedProfile = { ...profile, lastUpdated: Date.now() };
    this.profiles.set(updatedProfile.deviceId, updatedProfile);
    this.saveToStorage();
  }

  /**
   * Set frequency calibration for a device
   */
  setFrequencyCalibration(
    deviceId: string,
    calibration: FrequencyCalibration,
  ): void {
    let profile = this.profiles.get(deviceId);
    profile ??= {
        deviceId,
        lastUpdated: Date.now(),
        version: 1,
      };

    profile.frequency = calibration;
    this.setProfile({ ...profile, version: profile.version + 1 });
  }

  /**
   * Set power calibration for a device
   */
  setPowerCalibration(
    deviceId: string,
    calibration: PowerCalibration,
  ): void {
    let profile = this.profiles.get(deviceId);
    profile ??= {
        deviceId,
        lastUpdated: Date.now(),
        version: 1,
      };

    profile.power = calibration;
    this.setProfile({ ...profile, version: profile.version + 1 });
  }

  /**
   * Set IQ calibration for a device
   */
  setIQCalibration(
    deviceId: string,
    calibration: IQCalibration,
  ): void {
    let profile = this.profiles.get(deviceId);
    profile ??= {
        deviceId,
        lastUpdated: Date.now(),
        version: 1,
      };

    profile.iq = calibration;
    this.setProfile({ ...profile, version: profile.version + 1 });
  }

  /**
   * Apply frequency calibration to a measured frequency
   */
  applyFrequencyCalibration(
    deviceId: string,
    measuredFrequency: number,
  ): number {
    const profile = this.profiles.get(deviceId);
    if (!profile?.frequency) {
      return measuredFrequency;
    }

    const correction =
      (profile.frequency.ppmOffset / 1_000_000) * measuredFrequency;
    return measuredFrequency - correction;
  }

  /**
   * Apply power calibration to a measured power
   */
  applyPowerCalibration(
    deviceId: string,
    measuredPower: number,
    frequency?: number,
  ): number {
    const profile = this.profiles.get(deviceId);
    if (!profile?.power) {
      return measuredPower;
    }

    let correction = profile.power.gainOffset;

    // Apply frequency-dependent correction if available
    if (
      frequency &&
      profile.power.calibrationPoints &&
      profile.power.calibrationPoints.length > 0
    ) {
      correction += this.interpolatePowerCorrection(
        frequency,
        profile.power.calibrationPoints,
      );
    }

    return measuredPower + correction;
  }

  /**
   * Apply IQ calibration to IQ samples
   */
  applyIQCalibration(
    deviceId: string,
    iqSamples: Array<{ I: number; Q: number }>,
  ): Array<{ I: number; Q: number }> {
    const profile = this.profiles.get(deviceId);
    if (!profile?.iq) {
      return iqSamples;
    }

    const { dcOffsetI, dcOffsetQ, gainImbalance, phaseImbalance } =
      profile.iq;

    // Convert phase to radians
    const phaseRad = (phaseImbalance * Math.PI) / 180;

    return iqSamples.map((sample) => {
      // Remove DC offset
      const I = sample.I - dcOffsetI;
      let Q = sample.Q - dcOffsetQ;

      // Correct gain imbalance
      Q *= gainImbalance;

      // Correct phase imbalance
      const ICorrected = I;
      const QCorrected = Q * Math.cos(phaseRad) - I * Math.sin(phaseRad);

      return {
        I: ICorrected,
        Q: QCorrected,
      };
    });
  }

  /**
   * Calculate frequency calibration from reference measurement
   */
  calculateFrequencyCalibration(
    deviceId: string,
    referenceFrequency: number,
    measuredFrequency: number,
    temperature?: number,
    notes?: string,
  ): FrequencyCalibration {
    const error = measuredFrequency - referenceFrequency;
    const ppmOffset = (error / referenceFrequency) * 1_000_000;

    return {
      deviceId,
      ppmOffset,
      referenceFrequency,
      measuredFrequency,
      calibrationDate: Date.now(),
      temperature,
      notes,
    };
  }

  /**
   * Calculate power calibration from reference measurement
   */
  calculatePowerCalibration(
    deviceId: string,
    referenceLevel: number,
    measuredLevel: number,
    frequency?: number,
    equipmentUsed?: string,
    notes?: string,
  ): PowerCalibration {
    const gainOffset = referenceLevel - measuredLevel;

    const calibration: PowerCalibration = {
      deviceId,
      gainOffset,
      referenceLevel,
      calibrationDate: Date.now(),
      equipmentUsed,
      notes,
    };

    if (frequency) {
      calibration.calibrationPoints = [
        {
          frequency,
          offsetDb: gainOffset,
        },
      ];
    }

    return calibration;
  }

  /**
   * Add calibration point to power calibration
   */
  addPowerCalibrationPoint(
    deviceId: string,
    frequency: number,
    offsetDb: number,
  ): void {
    const profile = this.profiles.get(deviceId);
    if (!profile?.power) {
      throw new Error(
        "No power calibration exists for this device",
      );
    }

    profile.power.calibrationPoints ??= [];

    // Remove existing point at this frequency
    profile.power.calibrationPoints =
      profile.power.calibrationPoints.filter(
        (p) => p.frequency !== frequency,
      );

    // Add new point
    profile.power.calibrationPoints.push({ frequency, offsetDb });

    // Sort by frequency
    profile.power.calibrationPoints.sort(
      (a, b) => a.frequency - b.frequency,
    );

    this.setProfile({ ...profile, version: profile.version + 1 });
  }

  /**
   * Interpolate power correction for a frequency
   */
  private interpolatePowerCorrection(
    frequency: number,
    calibrationPoints: Array<{ frequency: number; offsetDb: number }>,
  ): number {
    if (calibrationPoints.length === 0) {
      return 0;
    }

    // If frequency is outside range, use nearest point
    if (frequency <= (calibrationPoints[0]?.frequency ?? 0)) {
      return calibrationPoints[0]?.offsetDb ?? 0;
    }
    if (
      frequency >=
      (calibrationPoints[calibrationPoints.length - 1]?.frequency ?? 0)
    ) {
      return (
        calibrationPoints[calibrationPoints.length - 1]?.offsetDb ?? 0
      );
    }

    // Find surrounding points
    for (let i = 0; i < calibrationPoints.length - 1; i++) {
      const point1 = calibrationPoints[i];
      const point2 = calibrationPoints[i + 1];
      if (!point1 || !point2) {continue;}

      if (
        frequency >= point1.frequency &&
        frequency <= point2.frequency
      ) {
        // Linear interpolation
        const ratio =
          (frequency - point1.frequency) /
          (point2.frequency - point1.frequency);
        return (
          point1.offsetDb +
          ratio * (point2.offsetDb - point1.offsetDb)
        );
      }
    }

    return 0;
  }

  /**
   * Delete calibration profile
   */
  deleteProfile(deviceId: string): boolean {
    const deleted = this.profiles.delete(deviceId);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Clear all profiles
   */
  clearAllProfiles(): void {
    this.profiles.clear();
    this.saveToStorage();
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): CalibrationProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Export profiles to JSON
   */
  exportProfiles(): string {
    return JSON.stringify(
      Array.from(this.profiles.values()),
      null,
      2,
    );
  }

  /**
   * Import profiles from JSON
   */
  importProfiles(json: string): boolean {
    try {
      const profiles = JSON.parse(json) as CalibrationProfile[];
      for (const profile of profiles) {
        this.profiles.set(profile.deviceId, profile);
      }
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save profiles to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(
        Array.from(this.profiles.values()),
      );
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      console.error("Failed to save calibration profiles:", error);
    }
  }

  /**
   * Load profiles from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const profiles = JSON.parse(data) as CalibrationProfile[];
        for (const profile of profiles) {
          this.profiles.set(profile.deviceId, profile);
        }
      }
    } catch (error) {
      console.error(
        "Failed to load calibration profiles:",
        error,
      );
    }
  }

  /**
   * Check if calibration is expired (older than 1 year)
   */
  isCalibrationExpired(
    deviceId: string,
    maxAgeMs: number = 365 * 24 * 60 * 60 * 1000,
  ): boolean {
    const profile = this.profiles.get(deviceId);
    if (!profile) {
      return true;
    }

    const age = Date.now() - profile.lastUpdated;
    return age > maxAgeMs;
  }
}
