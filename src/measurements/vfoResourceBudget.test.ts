import { describe, expect, it } from 'vitest';
import { evaluateVfoResourceBudget } from './vfoResourceBudget';

describe('vfoResourceBudget', () => {
  it('reports healthy budget under low load', () => {
    const advisory = evaluateVfoResourceBudget({
      activeVfoCount: 1,
      vfos: [{
        id: 'main',
        offsetHz: 0,
        groupDelaySamples: 0,
        power: 0.1,
        quality01: 0.7,
        strategy: 'direct',
        cpuMs: 2
      }],
      pipelineTotalMs: 4,
      audioUnderruns: 0,
      audioRoute: 'main',
      secondaryVfoEnabled: false
    });

    expect(advisory.severity).toBe('ok');
    expect(advisory.suggestedActions).toHaveLength(0);
  });

  it('recommends mitigation actions when budget pressure rises', () => {
    const advisory = evaluateVfoResourceBudget({
      activeVfoCount: 2,
      vfos: [{
        id: 'main',
        offsetHz: 0,
        groupDelaySamples: 0,
        power: 0.3,
        quality01: 0.6,
        strategy: 'direct',
        cpuMs: 5.5
      }],
      pipelineTotalMs: 24,
      audioUnderruns: 4,
      audioRoute: 'mix',
      secondaryVfoEnabled: true
    });

    expect(advisory.severity).toBe('critical');
    expect(advisory.suggestedActions).toContain('route-main');
    expect(advisory.suggestedActions).toContain('disable-aux');
    expect(advisory.suggestedActions).toContain('mute');
  });
});
