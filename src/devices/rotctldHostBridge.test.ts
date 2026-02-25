import { describe, expect, it, vi } from 'vitest';
import {
  ROTCTLD_BRIDGE_CAPABILITY_ID,
  probeRotctldHostBridge,
  runRotctldCommandViaHostBridge
} from './rotctldHostBridge';

describe('rotctldHostBridge', () => {
  it('probes bridge capability', () => {
    const hostWindow = {
      __RADIO_HOST_BRIDGE__: {
        protocolVersion: 1,
        capabilities: [ROTCTLD_BRIDGE_CAPABILITY_ID],
        runRotctldCommand: vi.fn(async () => ({ ok: true }))
      }
    };

    const probe = probeRotctldHostBridge(hostWindow);
    expect(probe.available).toBe(true);
    expect(probe.bridge).toBeTruthy();
  });

  it('rejects missing command and normalizes response', async () => {
    const bridge = {
      protocolVersion: 1,
      capabilities: [ROTCTLD_BRIDGE_CAPABILITY_ID],
      runRotctldCommand: vi.fn(async () => ({
        ok: 1 as unknown as boolean,
        responseText: 'RPRT 0\n',
        diagnostics: ['bridge-ok']
      }))
    };

    await expect(runRotctldCommandViaHostBridge({ bridge, command: '   ' })).rejects.toThrow('cannot be empty');

    const response = await runRotctldCommandViaHostBridge({
      bridge,
      command: 'P 180 45',
      timeoutMs: 1
    });

    expect(response.ok).toBe(true);
    expect(response.responseText).toContain('RPRT 0');
    expect(bridge.runRotctldCommand).toHaveBeenCalledWith({
      command: 'P 180 45',
      timeoutMs: 250
    });
  });
});
