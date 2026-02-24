import { describe, expect, it, vi } from 'vitest';
import { WorkerBridge } from './WorkerBridge';

class MockWorker {
  calls: Array<{ message: unknown; transfer: Transferable[] }> = [];
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(message: unknown, transfer: Transferable[] = []) {
    this.calls.push({ message, transfer });
  }
}

class MockPort {
  calls: Array<{ message: unknown; transfer: Transferable[] }> = [];
  started = false;
  closed = false;
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(message: unknown, transfer: Transferable[] = []) {
    this.calls.push({ message, transfer });
  }

  start() {
    this.started = true;
  }

  close() {
    this.closed = true;
  }

  emit(message: unknown) {
    this.onmessage?.({ data: message } as MessageEvent);
  }
}

describe('WorkerBridge', () => {
  it('uses direct transport when fallback is disabled', () => {
    const worker = new MockWorker() as unknown as Worker;
    const bridge = new WorkerBridge(worker, { preferMessageChannelFallback: false });

    bridge.postMessage({ type: 'PING' });

    const workerMock = worker as unknown as MockWorker;
    expect(bridge.getMode()).toBe('direct');
    expect(workerMock.calls).toHaveLength(1);
    expect(workerMock.calls[0].message).toEqual({ type: 'PING' });
  });

  it('uses message channel transport when fallback is enabled', () => {
    const worker = new MockWorker() as unknown as Worker;
    const port1 = new MockPort();
    const port2 = new MockPort();

    const bridge = new WorkerBridge(worker, {
      preferMessageChannelFallback: true,
      createChannel: () => ({
        port1: port1 as unknown as MessagePort,
        port2: port2 as unknown as MessagePort
      } as MessageChannel)
    });

    bridge.postMessage({ type: 'PING_FALLBACK' });
    bridge.dispose();

    const workerMock = worker as unknown as MockWorker;
    expect(bridge.getMode()).toBe('message-channel');
    expect(workerMock.calls).toHaveLength(1);
    expect(workerMock.calls[0].message).toEqual({
      command: 'INIT_MESSAGE_PORT',
      port: port2
    });
    expect(port1.started).toBe(true);
    expect(port1.calls).toHaveLength(1);
    expect(port1.calls[0].message).toEqual({ type: 'PING_FALLBACK' });
    expect(port1.closed).toBe(true);
  });

  it('relays inbound message-channel events to worker onmessage', () => {
    const worker = new MockWorker() as unknown as Worker;
    const port1 = new MockPort();
    const port2 = new MockPort();
    const onMessage = vi.fn();

    const workerMock = worker as unknown as MockWorker;
    workerMock.onmessage = onMessage;

    new WorkerBridge(worker, {
      preferMessageChannelFallback: true,
      createChannel: () => ({
        port1: port1 as unknown as MessagePort,
        port2: port2 as unknown as MessagePort
      } as MessageChannel)
    });

    port1.emit({ type: 'FFT_DATA', data: [1, 2, 3] });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { type: 'FFT_DATA', data: [1, 2, 3] }
      })
    );
  });
});
