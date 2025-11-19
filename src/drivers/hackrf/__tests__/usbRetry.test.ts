import { isTransientError, runWithRetry } from "../usbRetry";

describe("USB Retry Utility", () => {
  describe("isTransientError", () => {
    it("identifies InvalidStateError as transient", () => {
      const error = new Error("Some message");
      error.name = "InvalidStateError";
      expect(isTransientError(error)).toBe(true);
    });

    it("identifies NetworkError as transient", () => {
      const error = new Error("Some message");
      error.name = "NetworkError";
      expect(isTransientError(error)).toBe(true);
    });

    it("identifies transfer errors by message", () => {
      const error = new Error("USB transfer error occurred");
      expect(isTransientError(error)).toBe(true);

      const error2 = new Error("Transfer failed");
      expect(isTransientError(error2)).toBe(true);
    });

    it("identifies other errors as non-transient", () => {
      const error = new Error("Something else went wrong");
      expect(isTransientError(error)).toBe(false);

      const error2 = new TypeError("Type error");
      expect(isTransientError(error2)).toBe(false);
    });
  });

  describe("runWithRetry", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("succeeds immediately if operation succeeds", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const result = await runWithRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("retries on transient error and eventually succeeds", async () => {
      const error = new Error("NetworkError");
      error.name = "NetworkError";

      const operation = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const promise = runWithRetry(operation, { baseDelay: 100 });

      // Fast-forward time for retries
      await jest.advanceTimersByTimeAsync(100); // First retry delay
      await jest.advanceTimersByTimeAsync(200); // Second retry delay (exponential)

      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("respects custom classifiers for domain-specific errors", async () => {
      const blockingError = new Error("Device busy");
      const operation = jest
        .fn()
        .mockRejectedValueOnce(blockingError)
        .mockResolvedValue("success");

      const classify = jest
        .fn()
        .mockImplementation((err) => err === blockingError);

      const promise = runWithRetry(operation, { classify, baseDelay: 50 });
      await jest.advanceTimersByTimeAsync(50);
      const result = await promise;

      expect(result).toBe("success");
      expect(classify).toHaveBeenCalledWith(blockingError);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("fails after max attempts with transient error", async () => {
      const error = new Error("NetworkError");
      error.name = "NetworkError";

      const operation = jest.fn().mockRejectedValue(error);

      const promise = runWithRetry(operation, { attempts: 3, baseDelay: 100 });
      const expectation = expect(promise).rejects.toThrow("NetworkError");

      // Fast-forward time
      await jest.advanceTimersByTimeAsync(1000);

      await expectation;
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("fails immediately on non-transient error", async () => {
      const error = new Error("Fatal Error");
      const operation = jest.fn().mockRejectedValue(error);

      await expect(runWithRetry(operation)).rejects.toThrow("Fatal Error");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("respects maxDelay", async () => {
      const error = new Error("NetworkError");
      error.name = "NetworkError";

      const operation = jest.fn().mockRejectedValue(error);

      const promise = runWithRetry(operation, {
        attempts: 5,
        baseDelay: 100,
        maxDelay: 150,
      }).catch(() => {}); // Catch to prevent unhandled rejection

      // 1st retry: 100ms
      // 2nd retry: 200ms -> capped at 150ms
      // 3rd retry: 400ms -> capped at 150ms

      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      // We can't easily assert the exact delay without more complex mocking,
      // but we can verify it finished.
      expect(operation).toHaveBeenCalledTimes(5);
    });

    it("calls onRetry callback", async () => {
      const error = new Error("NetworkError");
      error.name = "NetworkError";

      const operation = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const onRetry = jest.fn();

      const promise = runWithRetry(operation, { onRetry, baseDelay: 100 });
      await jest.advanceTimersByTimeAsync(100);
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, error);
    });
  });
});
