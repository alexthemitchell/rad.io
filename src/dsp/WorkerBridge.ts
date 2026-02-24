export type WorkerTransportMode = 'direct' | 'message-channel';

export type WorkerMessageTarget = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

export type WorkerBridgeOptions = {
  preferMessageChannelFallback: boolean;
  createChannel?: () => MessageChannel;
};

const defaultCreateChannel = () => new MessageChannel();

export class WorkerBridge {
  private targetPostMessage: (message: unknown, transfer?: Transferable[]) => void;
  private readonly modeValue: WorkerTransportMode;
  private readonly channelPort?: MessagePort;

  constructor(worker: Worker, options: WorkerBridgeOptions) {
    const useChannel = options.preferMessageChannelFallback;

    if (useChannel) {
      const channel = (options.createChannel ?? defaultCreateChannel)();
      this.modeValue = 'message-channel';
      this.targetPostMessage = (message, transfer = []) => {
        channel.port1.postMessage(message, transfer);
      };
      this.channelPort = channel.port1;

      worker.postMessage({ command: 'INIT_MESSAGE_PORT', port: channel.port2 }, [channel.port2]);
      this.channelPort.start();
    } else {
      this.modeValue = 'direct';
      this.targetPostMessage = (message, transfer = []) => {
        worker.postMessage(message, transfer);
      };
    }
  }

  postMessage(message: unknown, transfer: Transferable[] = []) {
    this.targetPostMessage(message, transfer);
  }

  getMode(): WorkerTransportMode {
    return this.modeValue;
  }

  dispose() {
    this.channelPort?.close();
  }
}
