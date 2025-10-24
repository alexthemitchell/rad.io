import { type StreamOptions } from "./StreamOptions";

export const defaultStreamOptions: StreamOptions = {
  transferCount: 4,
  transferBufferSize: 262144,
};

export type PollCallback = (x: Int8Array) => undefined | void | false;
export type PollReceiveCallback = PollCallback;
export type PollTransmitCallback = PollCallback;

export async function poll(
  setup: () => void | PromiseLike<void>,
  handle: USBDevice,
  endpoint: USBEndpoint,
  callback: PollCallback,
  { transferCount = 4, transferBufferSize = 262144 }: StreamOptions = {},
): Promise<void> {
  new Promise<void>((resolve, reject) => {
    const isOut = endpoint.direction === "out";

    const pendingTransfers = new Set<
      Promise<USBOutTransferResult> | Promise<USBInTransferResult>
    >();
    let cancelled = false;
    const tryCancel = (): void => {
      if (cancelled) {
        return;
      }
      /*
			  TODO: cancel pending
			  pendingTransfers.forEach((x) => {
				  try {
					  x.cancel();
				  } catch (e) {}
			  });
			  */
      cancelled = true;
    };

    let settled = false;
    let rejected = false;
    let reason: unknown;
    const wrapResolve = (): void => {
      settled = true;
      if (!isOut) {
        tryCancel();
      }
    };
    const wrapReject = (x: unknown): void => {
      settled = true;
      rejected = true;
      reason = x;
      tryCancel();
    };
    const safeCall = (fn: () => void): void => {
      if (settled) {
        return;
      }
      try {
        fn();
      } catch (e) {
        wrapReject(e);
      }
    };
    const doSettle = (): void => {
      if (settled && pendingTransfers.size === 0) {
        if (rejected) {
          reject(reason);
        } else {
          resolve();
        }
      }
    };

    // allocate / fill buffers
    const tasks: Array<() => void> = [];
    for (let i = 0; !settled && i < transferCount; i++) {
      const buffer = Buffer.alloc(transferBufferSize);
      const array = new Int8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      );
      if (isOut) {
        if (callback(array) === false) {
          break;
        }
      }

      const submitTransfer = (): void => {
        const transfer = isOut
          ? handle.controlTransferOut(
              {
                requestType: "vendor",
                recipient: "endpoint",
                index: endpoint.endpointNumber,
                request: 0,
                value: 0,
              },
              buffer,
            )
          : handle.controlTransferIn(
              {
                requestType: "vendor",
                recipient: "endpoint",
                index: endpoint.endpointNumber,
                request: 0,
                value: 0,
              },
              0,
            );
        // TODO: const transfer = endpoint.transfer(0, transferCallback).submit(buffer)
        void pendingTransfers.add(transfer);
        void transfer.catch((error: unknown) => {
          if (!rejected && error) {
            wrapReject(error);
          }
          // potentially heavy callback... move to the next tick
          // to prevent starving the loop (setImmediate preserves order)
          if (settled) {
            inNextTick();
          } else {
            setImmediate(inNextTick);
          }
          function inNextTick(): void {
            pendingTransfers.delete(transfer);
            safeCall(() => {
              if (
                callback(isOut ? array : array.subarray(0, length)) === false
              ) {
                wrapResolve();
              }
            });
            safeCall(submitTransfer);
            doSettle();
          }
        });
      };
      tasks.push(submitTransfer);
    }

    // start the stream
    Promise.resolve(setup()).then(() => {
      tasks.forEach((submitTransfer) => safeCall(submitTransfer));
      doSettle();
    }, reject);
  });
}
