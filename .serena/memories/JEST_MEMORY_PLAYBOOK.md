Purpose: Reliable Jest testing strategy for rad.io with large datasets and canvas/WebUSB mocks.

Core strategies
- Run only relevant tests. Avoid full suite unless necessary.
- Expose GC for heavy tests: `NODE_OPTIONS=--expose-gc`.
- Limit workers for memory-heavy tests: `--maxWorkers=1`.
- Always unmount React components: `const { unmount } = render(...); unmount();`.
- Clear memory pools after each test: `clearMemoryPools()` from `src/utils/testMemoryManager.ts`.
- Force GC in `beforeEach`: `if (global.gc) global.gc();`.

Utilities & references
- Memory manager: `src/utils/testMemoryManager.ts` (chunked sample generation, clear pools).
- Example large-data tests: `src/components/__tests__/VisualizationSDRData.test.tsx`.
- Canvas mocks: `jest.setup.ts` (ensure to mock all used methods).
- DSP tests & Parseval checks: `src/utils/__tests__/...`.

Patterns
- Chunked data generation:
  ```ts
  const samples = generateSamplesChunked(50000, (n) => ({
    I: Math.cos(n), Q: Math.sin(n)
  }));
  ```
- Cleanup hooks:
  ```ts
  beforeEach(() => { if (global.gc) global.gc(); });
  afterEach(() => { clearMemoryPools(); });
  ```
- Canvas component lifecycle:
  ```ts
  const { unmount } = render(<IQConstellation samples={...} />);
  // assertions...
  unmount();
  ```

Common failures & fixes
- FATAL ERROR: heap limit → shrink dataset, use chunking, single worker, call clearMemoryPools().
- Canvas method undefined → add mock in `jest.setup.ts`.
- Spectrogram mismatch → ensure dB conversion `20*log10(magnitude)` and windowing consistent with `src/utils/dsp.ts`.

Success criteria
- Tests pass locally with no heap OOM.
- No JSDOM/canvas leaking handles after tests (clean unmounts).