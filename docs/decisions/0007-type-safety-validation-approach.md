# Type Safety and Validation Approach

## Context and Problem Statement

WebSDR Pro handles diverse data types with strict correctness requirements: complex numeric data (IQ samples, FFT results, power levels in dBm), hardware device configurations (frequency ranges 0-6 GHz, sample rates 1-20 MSPS, gains -100 to +100 dB), user inputs (frequencies, bandwidths, filter parameters), worker message passing (serialized data must maintain type contracts), IndexedDB storage (untyped at runtime), and WebUSB/WebSerial binary protocols. Type mismatches cause hardware errors (invalid frequency → device error), DSP failures (wrong sample rate → algorithm failure), and data corruption (malformed IQ data → NaN propagation).

How do we ensure type safety at both compile-time and runtime across all data boundaries while maintaining developer productivity and application performance?

## Decision Drivers

- PRD requirement: "Precision" quality—correctness is paramount for research-grade instrumentation
- Technical constraint: TypeScript only validates at compile-time, external data untyped
- Safety requirement: Invalid hardware commands can damage devices or produce invalid results
- Data integrity: DSP algorithms fail silently with wrong types (NaN propagation)
- Worker communication: Message passing serialization loses type information
- Storage validation: IndexedDB and localStorage return `unknown` types
- Performance requirement: Runtime validation must be fast (< 1ms for hot paths)
- Developer experience: Single source of truth for types, no duplicate definitions
- Error quality: Validation errors must provide actionable debugging information

## Considered Options

- **Option 1**: TypeScript Strict Mode + Zod for runtime validation + branded types
- **Option 2**: TypeScript only (no runtime validation)
- **Option 3**: JSON Schema for validation
- **Option 4**: io-ts (functional runtime types)
- **Option 5**: Yup validation library
- **Option 6**: Manual validation functions

## Decision Outcome

Chosen option: **"Option 1: TypeScript Strict Mode + Zod + Branded Types"** because it provides defense-in-depth with compile-time safety (TypeScript strict mode catches errors during development) and runtime safety (Zod validates external data at boundaries). Zod's type inference eliminates duplicate definitions (single source of truth), branded types prevent unit confusion (can't use dB as Hz), and detailed validation errors aid debugging. The approach validates once at boundaries and trusts internally, minimizing performance impact.

This aligns with PRD "precision" quality (correctness through type safety) and "professional" quality (reliable instrumentation).

### Consequences

- Good, because compile-time TypeScript catches 80%+ of type errors during development
- Good, because runtime Zod validation catches external data errors at boundaries
- Good, because single source of truth (schemas generate types, no duplication)
- Good, because branded types prevent domain-specific errors (frequency vs. gain confusion)
- Good, because detailed validation errors (Zod.ZodError) provide debugging context
- Good, because type inference works across entire codebase
- Good, because React Hook Form integration for form validation
- Good, because refactoring guided by type errors (high confidence changes)
- Bad, because more verbose than untyped JavaScript
- Bad, because team must learn Zod syntax and TypeScript advanced features
- Bad, because runtime validation adds overhead (~µs per validation, negligible)
- Bad, because Zod adds ~13 KB gzipped to bundle
- Bad, because branded types and discriminated unions have learning curve
- Neutral, because validation errors provide detailed debugging information
- Neutral, because can cache validated values in hot paths
- Neutral, because can disable validation in production builds if profiling shows bottleneck

### Confirmation

Type safety validated through:

1. **Compile Coverage**: 100% of codebase type-checked with strict mode (no `any` escapes)
2. **Runtime Coverage**: All external boundaries validated (user input, storage, workers, device responses)
3. **Error Detection**: Unit tests verify validation catches invalid data (100% edge case coverage)
4. **Performance Impact**: Validation overhead < 1% of total execution time (profiled)
5. **Type Inference**: IDE autocomplete works for 100% of API surface
6. **Refactoring**: Large refactors complete with zero runtime errors (type-guided changes)

TypeScript compiler in CI enforces strictness. Vitest tests verify validation logic. Chrome DevTools profiler measures validation overhead.

## Pros and Cons of the Options

### Option 1: TypeScript + Zod + Branded Types (Chosen)

- Good, because compile-time safety catches errors during development
- Good, because runtime validation protects against external data
- Good, because single source of truth (Zod schemas infer TypeScript types)
- Good, because branded types prevent unit confusion (Hz, dB, samples are distinct types)
- Good, because excellent IDE support (autocomplete, inline errors)
- Good, because discriminated unions for type-safe message passing
- Good, because React Hook Form integration for forms
- Good, because detailed error messages aid debugging
- Neutral, because ~13 KB bundle cost (acceptable for safety gains)
- Neutral, because ~µs validation overhead (negligible)
- Bad, because more verbose than untyped code
- Bad, because learning curve for Zod and TypeScript advanced features

### Option 2: TypeScript Only (No Runtime Validation)

- Good, because simplest approach (no validation library)
- Good, because zero runtime overhead
- Good, because compile-time checking during development
- Bad, because external data (IndexedDB, user input) has no runtime guarantees
- Bad, because cannot validate worker messages
- Bad, because cannot validate device responses
- Bad, because silent failures in production (invalid data → NaN → corrupted results)
- Bad, because violates PRD "precision" requirement

### Option 3: JSON Schema

- Good, because declarative validation syntax
- Good, because language-agnostic (can share schemas)
- Neutral, because separate validator libraries available (Ajv)
- Bad, because no type inference (must write TypeScript types separately)
- Bad, because verbose schema syntax
- Bad, because weaker TypeScript integration
- Bad, because duplicate definitions (schema + types)

### Option 4: io-ts (Functional Runtime Types)

- Good, because runtime validation with type inference
- Good, because functional programming approach (composable)
- Good, because strong type safety guarantees
- Neutral, because Similar features to Zod
- Bad, because more complex API (functional programming style less familiar)
- Bad, because steeper learning curve
- Bad, because less intuitive for imperative codebases

### Option 5: Yup Validation Library

- Good, because popular validation library
- Good, because good form validation support
- Neutral, because similar feature set
- Bad, because no built-in TypeScript type inference
- Bad, because must define types separately
- Bad, because weaker TypeScript integration than Zod
- Bad, because duplicate definitions required

### Option 6: Manual Validation Functions

- Good, because full control over validation logic
- Good, because no library dependency
- Good, because zero bundle overhead
- Bad, because error-prone (easy to forget validation)
- Bad, because no single source of truth
- Bad, because must manually maintain types and validators
- Bad, because inconsistent error handling
- Bad, because high maintenance burden

## More Information

### TypeScript Configuration (Strict Mode)

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

### Zod Schemas with Branded Types

```typescript
// src/lib/types/device.schema.ts
import { z } from "zod";

// Branded types prevent unit confusion
export const FrequencyHz = z
  .number()
  .min(0)
  .max(6_000_000_000) // 6 GHz max
  .brand("FrequencyHz");

export const SampleRateHz = z
  .number()
  .min(1000)
  .max(20_000_000) // 20 MSPS max
  .brand("SampleRateHz");

export const GainDB = z.number().min(-100).max(100).brand("GainDB");

// Device configuration schema
export const DeviceConfigSchema = z.object({
  id: z.string().ulid(),
  type: z.enum(["rtlsdr", "hackrf", "airspy"]),
  name: z.string().min(1),
  frequency: FrequencyHz,
  sampleRate: SampleRateHz,
  gain: GainDB.optional(),
  bandwidth: z.number().positive().optional(),
  ppm: z.number().int().min(-1000).max(1000).default(0),
  agc: z.boolean().default(false),
  biasT: z.boolean().default(false),
});

// Type inference from schema (single source of truth)
export type DeviceConfig = z.infer<typeof DeviceConfigSchema>;
export type FrequencyHz = z.infer<typeof FrequencyHz>;
export type SampleRateHz = z.infer<typeof SampleRateHz>;
export type GainDB = z.infer<typeof GainDB>;

// Usage - compile-time type safety
function setFrequency(freq: FrequencyHz) {
  /* ... */
}
function setGain(gain: GainDB) {
  /* ... */
}

const freq = FrequencyHz.parse(100_000_000); // 100 MHz - OK
const gain = GainDB.parse(20); // 20 dB - OK

setFrequency(freq); // ✓ OK
setGain(gain); // ✓ OK

// @ts-expect-error - Compile error: Type 'GainDB' is not assignable to 'FrequencyHz'
setFrequency(gain); // ✗ Caught at compile time!
```

### IQ Sample Validation with Refinement

```typescript
// src/lib/types/samples.schema.ts
import { z } from "zod";

export const IQSamplesSchema = z
  .object({
    i: z.instanceof(Float32Array),
    q: z.instanceof(Float32Array),
    sampleRate: SampleRateHz,
  })
  .refine((data) => data.i.length === data.q.length, {
    message: "I and Q arrays must have equal length",
  })
  .refine((data) => data.i.length > 0, {
    message: "Sample arrays must not be empty",
  })
  .refine((data) => data.i.every((v) => !isNaN(v) && isFinite(v)), {
    message: "I samples must not contain NaN or Infinity",
  })
  .refine((data) => data.q.every((v) => !isNaN(v) && isFinite(v)), {
    message: "Q samples must not contain NaN or Infinity",
  });

export type IQSamples = z.infer<typeof IQSamplesSchema>;

// Helper to create validated IQ samples
export function createIQSamples(
  i: Float32Array,
  q: Float32Array,
  sampleRate: number,
): IQSamples {
  return IQSamplesSchema.parse({
    i,
    q,
    sampleRate: SampleRateHz.parse(sampleRate),
  });
}
```

### Worker Message Validation (Discriminated Unions)

```typescript
// src/lib/types/worker-messages.schema.ts
import { z } from "zod";

// Discriminated union for type-safe message handling
export const DSPRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("fft"),
    id: z.string().ulid(),
    samples: z.instanceof(Float32Array),
    sampleRate: SampleRateHz,
    fftSize: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("demodulate"),
    id: z.string().ulid(),
    samples: IQSamplesSchema,
    mode: z.enum(["am", "fm", "usb", "lsb", "cw"]),
  }),
  z.object({
    type: z.literal("filter"),
    id: z.string().ulid(),
    samples: z.instanceof(Float32Array),
    filterType: z.enum(["lowpass", "highpass", "bandpass"]),
    cutoff: FrequencyHz,
  }),
]);

export type DSPRequest = z.infer<typeof DSPRequestSchema>;

// Worker message handler with validation
self.onmessage = (event) => {
  try {
    const request = DSPRequestSchema.parse(event.data);

    // TypeScript knows request.type and narrows automatically
    switch (request.type) {
      case "fft":
        // request is FFT type here
        handleFFT(request.id, request.samples, request.fftSize);
        break;
      case "demodulate":
        // request is Demodulate type here
        handleDemodulate(request.id, request.samples, request.mode);
        break;
      case "filter":
        // request is Filter type here
        handleFilter(
          request.id,
          request.samples,
          request.filterType,
          request.cutoff,
        );
        break;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      self.postMessage({
        type: "error",
        id: event.data.id,
        error: {
          message: "Invalid message format",
          details: error.errors,
        },
      });
    }
  }
};
```

### IndexedDB Storage Validation

```typescript
// src/lib/storage/recording.schema.ts
import { z } from "zod";

export const RecordingMetadataSchema = z.object({
  device: z.string(),
  gain: GainDB.optional(),
  modulation: z.enum(["am", "fm", "usb", "lsb", "cw"]).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const RecordingSchema = z.object({
  id: z.string().ulid(),
  timestamp: z.number().int().positive(),
  frequency: FrequencyHz,
  sampleRate: SampleRateHz,
  format: z.enum(["iq-float32", "iq-int16"]),
  duration: z.number().positive(),
  metadata: RecordingMetadataSchema,
  samples: z.instanceof(Blob),
  thumbnail: z.instanceof(Blob).optional(),
});

export type Recording = z.infer<typeof RecordingSchema>;

// Validate on load from IndexedDB
async function loadRecording(id: string): Promise<Recording> {
  const data = await recordingsDB.get(id);

  if (!data) {
    throw new Error(`Recording ${id} not found`);
  }

  // Runtime validation catches schema mismatches
  try {
    return RecordingSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid recording schema:", error.errors);
      throw new Error(`Recording ${id} has invalid schema`);
    }
    throw error;
  }
}
```

### Form Input Validation (React Hook Form Integration)

```typescript
// src/components/FrequencyInput.tsx
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FrequencyHz } from '@/lib/types/device.schema'

const FrequencyInputSchema = z.object({
  frequency: z.string()
    .regex(/^\d+(\.\d+)?$/, 'Must be a valid number')
    .transform(Number)
    .pipe(FrequencyHz)  // Transform string → number → FrequencyHz
})

type FrequencyInputForm = z.infer<typeof FrequencyInputSchema>

export function FrequencyInput({ onSubmit }: Props) {
  const form = useForm<FrequencyInputForm>({
    resolver: zodResolver(FrequencyInputSchema),
    defaultValues: {
      frequency: '100.0'
    }
  })

  return (
    <form onSubmit={form.handleSubmit((data) => onSubmit(data.frequency))}>
      <label htmlFor="frequency">Frequency (MHz)</label>
      <input
        id="frequency"
        {...form.register('frequency')}
        aria-invalid={!!form.formState.errors.frequency}
      />
      {form.formState.errors.frequency && (
        <span role="alert" className="text-destructive">
          {form.formState.errors.frequency.message}
        </span>
      )}
      <button type="submit">Tune</button>
    </form>
  )
}
```

### Type Guards for Runtime Narrowing

```typescript
// src/lib/types/type-guards.ts

export function isRTLSDR(device: SDRDevice): device is RTLSDRDevice {
  return device.type === "rtlsdr";
}

export function isHackRF(device: SDRDevice): device is HackRFDevice {
  return device.type === "hackrf";
}

// Usage with automatic type narrowing
function configureDevice(device: SDRDevice) {
  if (isRTLSDR(device)) {
    // TypeScript knows device is RTLSDRDevice here
    device.enableBiasT(true); // RTL-SDR specific method
    device.setTunerGain(20);
  } else if (isHackRF(device)) {
    // TypeScript knows device is HackRFDevice here
    device.setAmplifierEnable(true); // HackRF specific method
    device.setLNAGain(16);
  }
}
```

### Result Type for Typed Error Handling

```typescript
// src/lib/utils/result.ts

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function validateDeviceConfig(
  data: unknown,
): Result<DeviceConfig, z.ZodError> {
  const result = DeviceConfigSchema.safeParse(data);

  if (result.success) {
    return { ok: true, value: result.data };
  } else {
    return { ok: false, error: result.error };
  }
}

// Usage
const result = validateDeviceConfig(userInput);

if (result.ok) {
  // TypeScript knows result.value is DeviceConfig
  await applyConfig(result.value);
} else {
  // TypeScript knows result.error is ZodError
  showError(`Invalid configuration: ${formatZodError(result.error)}`);
}
```

### Schema Versioning and Migration

```typescript
// src/lib/storage/migrations.ts

const RecordingSchemaV1 = z.object({
  id: z.string(),
  frequency: z.number(),
  sampleRate: z.number(),
  samples: z.instanceof(Blob),
});

const RecordingSchemaV2 = z.object({
  id: z.string().ulid(), // Changed validation
  frequency: FrequencyHz, // Changed to branded type
  sampleRate: SampleRateHz,
  samples: z.instanceof(Blob),
  version: z.literal(2), // Version tag
});

function migrateRecording(data: unknown): Recording {
  // Try v2 first
  const v2Result = RecordingSchemaV2.safeParse(data);
  if (v2Result.success) return v2Result.data;

  // Fall back to v1 and migrate
  const v1 = RecordingSchemaV1.parse(data);

  return RecordingSchemaV2.parse({
    id: ulid(), // Generate new ULID
    frequency: FrequencyHz.parse(v1.frequency),
    sampleRate: SampleRateHz.parse(v1.sampleRate),
    samples: v1.samples,
    version: 2,
  });
}
```

### Performance Optimization Strategies

```typescript
// Cache parsed values in hot paths
const STANDARD_RATES = {
  "2.4MSPS": SampleRateHz.parse(2_400_000),
  "1.024MSPS": SampleRateHz.parse(1_024_000),
} as const;

// Use safeParse to avoid exceptions in performance-critical code
function fastValidate(freq: number): FrequencyHz | null {
  const result = FrequencyHz.safeParse(freq);
  return result.success ? result.data : null;
}

// Validate once at boundary, trust internally
async function processRecording(recording: Recording) {
  // No validation needed - already validated at load time
  await dspWorker.process(recording.samples);
}
```

### References

#### Official Documentation

- [Zod Documentation](https://zod.dev/) - Official Zod library for TypeScript-first schema validation
- [TypeScript Handbook - Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) - TypeScript official guide to type narrowing
- [React Hook Form - Zod Integration](https://react-hook-form.com/get-started#SchemaValidation) - Form validation with Zod schemas

#### Academic and Technical Research

- "Runtime Type Safety in TypeScript with Zod." Sai Umesh (2024). [Technical Article](https://saiumesh.dev/posts/runtime-type-safety-using-zod-typescript) - Comprehensive guide to runtime validation patterns
- "TypeScript vs Zod: Clearing up validation confusion." LogRocket (2024). [Developer Guide](https://blog.logrocket.com/when-use-zod-typescript-both-developers-guide/) - When to use compile-time vs runtime validation
- "Validating TypeScript Types in Runtime using Zod." Wisp CMS (2024). [Technical Tutorial](https://www.wisp.blog/blog/validating-typescript-types-in-runtime-using-zod) - Practical validation patterns
- "End-to-End Type Safety: Development and Runtime Validation with TypeScript and Zod." Cem Karakurt (2024). [Technical Blog](https://cemkarakurt.com/blog/end-to-end-type-safety-development-and-runtime-validation-with-typescript-and-zod/) - Full-stack type safety architecture
- CodeMentor. "Best way to enforce type-safety at runtime in TypeScript." [Technical Discussion](https://www.codementor.io/@vsimko/best-way-to-enforcement-type-safety-at-runtime-in-typescript-1zwljs7d78) - Comparison of runtime validation approaches

#### Design Patterns

- [Branded Types in TypeScript](https://egghead.io/blog/using-branded-types-in-typescript) - Advanced type safety with branded primitives

#### Related ADRs

- ADR-0005: Storage Strategy (Zod validation for stored data)
- ADR-0009: State Management Pattern (type-safe state definitions)
- [Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- "Parse, Don't Validate" - Alexis King
- "Type-Driven Development" - Edwin Brady
- ADR-0005: Storage Strategy (storage validation)
- ADR-0002: Web Worker DSP Architecture (message validation)
