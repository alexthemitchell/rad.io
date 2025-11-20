import { HackRFCalibrationService } from "../calibration";
import type { CalibrationBackend, CalibrationRequest } from "../calibration";
import type { CalibrationProfile } from "../../../lib/measurement/types";

const buildService = (backendOverrides: Partial<CalibrationBackend> = {}) => {
  const backend: CalibrationBackend = {
    getProfile: jest.fn().mockReturnValue(undefined),
    applyFrequencyCalibration: jest
      .fn()
      .mockImplementation((_, measured) => measured),
    ...backendOverrides,
  };

  return {
    service: new HackRFCalibrationService(backend),
    backend,
  };
};

describe("HackRFCalibrationService", () => {
  const request: CalibrationRequest = { centerFrequencyHz: 100e6 };

  it("returns requested frequency when no profile exists", () => {
    const { service, backend } = buildService();

    const plan = service.buildPlan("device-1", request);

    expect(plan.frequency.correctedHz).toBe(request.centerFrequencyHz);
    expect(plan.frequency.ppmOffset).toBe(0);
    expect(backend.applyFrequencyCalibration).toHaveBeenCalledWith(
      "device-1",
      request.centerFrequencyHz,
    );
  });

  it("applies stored ppm metadata when available", () => {
    const calibrationDate = Date.now();
    const profile: CalibrationProfile = {
      deviceId: "device-1",
      lastUpdated: calibrationDate,
      version: 1,
      frequency: {
        deviceId: "device-1",
        ppmOffset: 9.5,
        referenceFrequency: 10e6,
        measuredFrequency: 10_000_095,
        calibrationDate,
      },
    };

    const correctedValue = request.centerFrequencyHz - 950;
    const { service } = buildService({
      getProfile: jest.fn().mockReturnValue(profile),
      applyFrequencyCalibration: jest
        .fn()
        .mockImplementation(() => correctedValue),
    });

    const plan = service.buildPlan("device-1", request);

    expect(plan.frequency.correctedHz).toBe(correctedValue);
    expect(plan.frequency.ppmOffset).toBe(profile.frequency?.ppmOffset ?? 0);
    expect(plan.frequency.referenceFrequency).toBe(
      profile.frequency?.referenceFrequency,
    );
    expect(plan.frequency.measuredFrequency).toBe(
      profile.frequency?.measuredFrequency,
    );
    expect(plan.frequency.calibrationDate).toBe(
      profile.frequency?.calibrationDate,
    );
  });
});
