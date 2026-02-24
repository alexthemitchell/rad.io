export type ScenarioEvent =
  | {
      atMs: number;
      type: 'retune';
      frequencyHz: number;
    }
  | {
      atMs: number;
      type: 'gain_step';
      stageName: string;
      gainValue: number;
    }
  | {
      atMs: number;
      type: 'clock_step';
      wallClockJumpMs: number;
    }
  | {
      atMs: number;
      type: 'sample_rate_step';
      sampleRateHz: number;
    }
  | {
      atMs: number;
      type: 'backpressure';
      wallClockJumpMs: number;
    }
  | {
      atMs: number;
      type: 'usb_stall_storm';
      bursts: number;
      wallClockJumpMsPerBurst: number;
    }
  | {
      atMs: number;
      type: 'usb_short_packet_burst';
      bursts: number;
      wallClockJumpMsPerBurst: number;
    }
  | {
      atMs: number;
      type: 'usb_reset_mid_stream';
    };

export type ScriptedRfScenario = {
  scenarioId: string;
  title: string;
  events: ScenarioEvent[];
};

const byAtMs = (a: ScenarioEvent, b: ScenarioEvent): number => {
  return a.atMs - b.atMs;
};

export const createRetuneGainClockBackpressureScenario = (): ScriptedRfScenario => {
  const events: ScenarioEvent[] = [
    { atMs: 20, type: 'retune', frequencyHz: 99_900_000 },
    { atMs: 30, type: 'gain_step', stageName: 'MAIN', gainValue: 62 },
    { atMs: 45, type: 'sample_rate_step', sampleRateHz: 1_000_000 },
    { atMs: 60, type: 'clock_step', wallClockJumpMs: 85 },
    { atMs: 75, type: 'backpressure', wallClockJumpMs: 220 }
  ];

  return {
    scenarioId: 'retune-gain-clock-backpressure-v1',
    title: 'Retune + Gain + Clock + Backpressure deterministic script',
    events: events.sort(byAtMs)
  };
};

export const createUsbChaosFaultScenario = (): ScriptedRfScenario => {
  const events: ScenarioEvent[] = [
    { atMs: 20, type: 'usb_short_packet_burst', bursts: 3, wallClockJumpMsPerBurst: 55 },
    { atMs: 45, type: 'usb_stall_storm', bursts: 4, wallClockJumpMsPerBurst: 120 },
    { atMs: 70, type: 'usb_reset_mid_stream' },
    { atMs: 85, type: 'usb_short_packet_burst', bursts: 2, wallClockJumpMsPerBurst: 90 }
  ];

  return {
    scenarioId: 'usb-chaos-fault-injection-v1',
    title: 'USB chaos simulation: short packets, stall storms, reset mid-stream',
    events: events.sort(byAtMs)
  };
};
