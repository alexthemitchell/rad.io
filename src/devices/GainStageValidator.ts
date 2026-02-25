import type { DeviceGainStageConstraint } from './CapabilityModel';

export type GainStageValidationIssue = {
  level: 'error' | 'warn';
  message: string;
};

export const sortGainStagesByOrder = (stages: readonly DeviceGainStageConstraint[]): DeviceGainStageConstraint[] => {
  return [...stages].sort((a, b) => a.order - b.order);
};

export const clampGainValue = (value: number, stage: DeviceGainStageConstraint): number => {
  const clamped = Math.max(stage.min, Math.min(stage.max, value));
  const snapped = Math.round((clamped - stage.min) / stage.step) * stage.step + stage.min;
  return Math.max(stage.min, Math.min(stage.max, snapped));
};

export const validateGainStageDefinitions = (stages: readonly DeviceGainStageConstraint[]): GainStageValidationIssue[] => {
  const issues: GainStageValidationIssue[] = [];
  const seenNames = new Set<string>();
  const seenOrders = new Set<number>();

  for (const stage of stages) {
    if (seenNames.has(stage.name)) {
      issues.push({ level: 'error', message: `Duplicate gain stage name: ${stage.name}` });
    }
    seenNames.add(stage.name);

    if (seenOrders.has(stage.order)) {
      issues.push({ level: 'warn', message: `Duplicate gain stage order: ${stage.order}` });
    }
    seenOrders.add(stage.order);

    if (stage.min > stage.max) {
      issues.push({ level: 'error', message: `${stage.name} has min > max` });
    }

    if (stage.step <= 0) {
      issues.push({ level: 'error', message: `${stage.name} has non-positive step` });
    }
  }

  return issues;
};
