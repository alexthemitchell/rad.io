import type { VfoAudioRoute, VfoRuntimeMetric } from '../dsp/multiVfoCore';

export type VfoResourceSeverity = 'ok' | 'warn' | 'critical';

export type VfoResourceAdvisory = {
  severity: VfoResourceSeverity;
  headline: string;
  details: string[];
  suggestedActions: Array<'route-main' | 'route-aux' | 'route-mix' | 'mute' | 'disable-aux'>;
};

export type VfoResourceInputs = {
  activeVfoCount: number;
  vfos: VfoRuntimeMetric[];
  pipelineTotalMs: number;
  audioUnderruns: number;
  audioRoute: VfoAudioRoute;
  secondaryVfoEnabled: boolean;
};

export const evaluateVfoResourceBudget = (input: VfoResourceInputs): VfoResourceAdvisory => {
  const heavyCpu = input.pipelineTotalMs > 12;
  const highVfoLoad = input.activeVfoCount >= 2 && input.vfos.some((vfo) => vfo.cpuMs > 4.5);
  const underrunPressure = input.audioUnderruns > 0;

  if (!heavyCpu && !highVfoLoad && !underrunPressure) {
    return {
      severity: 'ok',
      headline: 'VFO resource budget healthy.',
      details: [
        `Pipeline ${input.pipelineTotalMs.toFixed(1)} ms`,
        `Audio route: ${input.audioRoute}`
      ],
      suggestedActions: []
    };
  }

  const details = [
    `Pipeline ${input.pipelineTotalMs.toFixed(1)} ms`,
    `Active VFOs ${input.activeVfoCount}`,
    `Audio underruns ${input.audioUnderruns}`
  ];

  const suggestedActions: Array<'route-main' | 'route-aux' | 'route-mix' | 'mute' | 'disable-aux'> = [];
  if (input.audioRoute !== 'main') {
    suggestedActions.push('route-main');
  }
  if (input.secondaryVfoEnabled) {
    suggestedActions.push('disable-aux');
  }
  if (input.audioRoute !== 'mute') {
    suggestedActions.push('mute');
  }

  const severity: VfoResourceSeverity = (input.pipelineTotalMs > 20 || input.audioUnderruns > 3) ? 'critical' : 'warn';
  return {
    severity,
    headline: severity === 'critical' ? 'VFO resource budget exceeded.' : 'VFO load is approaching budget.',
    details,
    suggestedActions
  };
};
