/**
 * Coverage shim for TestMemoryManager gc branches
 */

import { clearMemoryPools, processSamplesBatched } from "../testMemoryManager";
import type { Sample } from "../dsp";

describe("TestMemoryManager GC branch coverage", () => {
  const originalGc = (global as unknown as { gc?: () => void }).gc;

  afterEach(() => {
    // Restore GC
    (global as unknown as { gc?: () => void }).gc = originalGc;
  });

  it("invokes global.gc during clearMemoryPools when available", () => {
    const mockGc = jest.fn();
    (global as unknown as { gc?: () => void }).gc = mockGc;

    clearMemoryPools();
    expect(mockGc).toHaveBeenCalled();
  });

  it("invokes global.gc during batched processing at intervals", () => {
    const mockGc = jest.fn();
    (global as unknown as { gc?: () => void }).gc = mockGc;

    const samples: Sample[] = Array.from({ length: 50 }, () => ({
      I: 0,
      Q: 0,
    }));
    const results = processSamplesBatched(samples, (batch) => batch.length, 5);

    expect(results.length).toBeGreaterThan(0);
    // Ensure gc was called at least once for batch % 10 === 0
    expect(mockGc).toHaveBeenCalled();
  });
});
