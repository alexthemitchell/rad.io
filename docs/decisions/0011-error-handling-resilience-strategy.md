# ADR-0011: Error Handling and Resilience Strategy

## Status

Accepted

## Context

SDR applications face multiple failure modes:

- WebUSB device disconnection
- Sample buffer underruns
- FFT computation errors
- WebGL context loss
- IndexedDB quota exceeded
- Worker crashes

Need comprehensive error handling for reliability.

## Decision

Implement **layered error handling** with graceful degradation.

### Error Boundaries

```typescript
// src/components/ErrorBoundary.tsx
export class SDRErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError('React Error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} reset={this.reset} />
    }
    return this.props.children
  }
}
```

### Device Error Recovery

```typescript
export class ResilientSDRDevice {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        toast.warning(
          `${context} failed, retrying (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        );
        await delay(1000 * this.reconnectAttempts);
        return this.withRetry(operation, context);
      }
      throw error;
    }
  }

  async setFrequency(freq: FrequencyHz) {
    return this.withRetry(async () => {
      await this.device.setFrequency(freq);
      this.reconnectAttempts = 0;
    }, "Frequency change");
  }
}
```

### Worker Error Handling

```typescript
// src/lib/workers/resilient-worker-pool.ts
export class ResilientWorkerPool {
  private async handleWorkerError(workerId: string, error: Error) {
    toast.error("Worker crashed, restarting");

    // Terminate crashed worker
    this.workers.get(workerId)?.terminate();

    // Create new worker
    const newWorker = new Worker("/src/workers/dsp-worker.ts");
    this.workers.set(workerId, newWorker);

    // Requeue failed tasks
    this.requeueFailedTasks(workerId);
  }
}
```

### WebGL Context Loss Recovery

```typescript
export function useWebGLContextRecovery(canvas: HTMLCanvasElement) {
  useEffect(() => {
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      toast.warning("Graphics context lost, recovering...");
    };

    const handleContextRestored = () => {
      reinitializeGL(canvas);
      toast.success("Graphics context restored");
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [canvas]);
}
```

### Result Type for Typed Errors

```typescript
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export async function safeDeviceOperation<T>(
  operation: () => Promise<T>,
): Promise<Result<T, DeviceError>> {
  try {
    const value = await operation();
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DeviceError
          ? error
          : new DeviceError("Unknown error", error),
    };
  }
}
```

### Error Logging

```typescript
interface ErrorLog {
  timestamp: number;
  level: "error" | "warning";
  context: string;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export function logError(
  context: string,
  error: Error,
  metadata?: Record<string, any>,
) {
  const log: ErrorLog = {
    timestamp: Date.now(),
    level: "error",
    context,
    message: error.message,
    stack: error.stack,
    metadata,
  };

  console.error(`[${context}]`, error);

  // Store in IndexedDB for debugging
  errorDB.add(log);
}
```

## Consequences

### Positive

- Graceful degradation
- User-friendly error messages
- Automatic recovery where possible
- Error logs for debugging

### Negative

- Increased complexity
- More code to maintain
- Retry logic can mask issues

## References

#### Official Documentation and Standards

- [Error Boundaries - React](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) - Official React error boundary documentation
- [WebUSB API - Error Handling](https://developer.mozilla.org/en-US/docs/Web/API/USB) - USB device error recovery patterns

#### Design Philosophy and Best Practices

- Keith, Jeremy. "Resilient Web Design." (2016). [Book](https://resilientwebdesign.com/) - Principles of fault-tolerant web applications
- "Error Handling Best Practices in Node.js" - Industry patterns applicable to browser JavaScript

#### Related ADRs

- ADR-0002: Web Worker DSP Architecture (worker error isolation)
- ADR-0008: Web Audio API Architecture (audio underrun recovery)
- ADR-0010: Offline-First Architecture (network error handling)
