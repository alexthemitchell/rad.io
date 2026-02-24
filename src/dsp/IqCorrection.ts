export type IqCorrectionState = {
  enabled: boolean;
  dcI: number;
  dcQ: number;
  gainI: number;
  gainQ: number;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class IqCorrection {
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getState(): IqCorrectionState {
    return {
      enabled: this.enabled,
      dcI: 0,
      dcQ: 0,
      gainI: 1,
      gainQ: 1
    };
  }

  applyInPlace(interleavedIq: Float32Array): IqCorrectionState {
    if (!this.enabled || interleavedIq.length < 4) {
      return this.getState();
    }

    const complexCount = Math.floor(interleavedIq.length / 2);

    let sumI = 0;
    let sumQ = 0;
    for (let i = 0; i < complexCount; i += 1) {
      sumI += interleavedIq[i * 2];
      sumQ += interleavedIq[i * 2 + 1];
    }

    const dcI = sumI / complexCount;
    const dcQ = sumQ / complexCount;

    let energyI = 0;
    let energyQ = 0;
    for (let i = 0; i < complexCount; i += 1) {
      const idx = i * 2;
      const centeredI = interleavedIq[idx] - dcI;
      const centeredQ = interleavedIq[idx + 1] - dcQ;
      interleavedIq[idx] = centeredI;
      interleavedIq[idx + 1] = centeredQ;
      energyI += centeredI * centeredI;
      energyQ += centeredQ * centeredQ;
    }

    const rmsI = Math.sqrt(energyI / complexCount);
    const rmsQ = Math.sqrt(energyQ / complexCount);
    const target = Math.max(1e-6, (rmsI + rmsQ) * 0.5);
    const gainI = clamp(target / Math.max(1e-6, rmsI), 0.5, 2);
    const gainQ = clamp(target / Math.max(1e-6, rmsQ), 0.5, 2);

    for (let i = 0; i < complexCount; i += 1) {
      const idx = i * 2;
      interleavedIq[idx] *= gainI;
      interleavedIq[idx + 1] *= gainQ;
    }

    return {
      enabled: this.enabled,
      dcI,
      dcQ,
      gainI,
      gainQ
    };
  }
}
