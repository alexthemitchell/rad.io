/**
 * HackRF calibration service
 * Centralizes how HackRF adapters apply calibration without exposing
 * calibration math to the underlying device implementation.
 */

import { CalibrationManager } from "../../lib/measurement/calibration";
import type { CalibrationProfile } from "../../lib/measurement/types";

export interface CalibrationBackend {
  getProfile(deviceId: string): CalibrationProfile | undefined;
  applyFrequencyCalibration(
    deviceId: string,
    measuredFrequency: number,
  ): number;
}

export interface CalibrationRequest {
  centerFrequencyHz: number;
  bandwidthHz?: number;
  lnaGainDb?: number;
  vgaGainDb?: number;
}

export interface FrequencyCalibrationPlan {
  requestedHz: number;
  correctedHz: number;
  ppmOffset: number;
  calibrationDate?: number;
  referenceFrequency?: number;
  measuredFrequency?: number;
}

export interface HackRFCalibrationPlan {
  frequency: FrequencyCalibrationPlan;
  // Future gain/power/IQ calibration plans can be added here without
  // modifying adapter call sites.
}

export interface HackRFCalibrationPort {
  buildPlan(
    deviceId: string,
    request: CalibrationRequest,
  ): HackRFCalibrationPlan;
}

export class HackRFCalibrationService implements HackRFCalibrationPort {
  constructor(
    private readonly backend: CalibrationBackend = new CalibrationManager(),
  ) {}

  buildPlan(
    deviceId: string,
    request: CalibrationRequest,
  ): HackRFCalibrationPlan {
    const profile = this.backend.getProfile(deviceId);
    const correctedHz = this.backend.applyFrequencyCalibration(
      deviceId,
      request.centerFrequencyHz,
    );

    return {
      frequency: {
        requestedHz: request.centerFrequencyHz,
        correctedHz,
        ppmOffset: profile?.frequency?.ppmOffset ?? 0,
        calibrationDate: profile?.frequency?.calibrationDate,
        referenceFrequency: profile?.frequency?.referenceFrequency,
        measuredFrequency: profile?.frequency?.measuredFrequency,
      },
    };
  }
}

export const hackRfCalibrationService = new HackRFCalibrationService();
