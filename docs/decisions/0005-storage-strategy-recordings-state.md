# Storage Strategy for Recordings and State

## Context and Problem Statement

WebSDR Pro must handle multiple categories of persistent data: large binary recordings (IQ samples at 10-100 MB per minute), structured application state (bookmarks, configurations, preferences), and session data (current tuning state, UI state). The application must work offline, handle browser storage quotas gracefully, maintain data integrity for recordings, and provide performant access to stored data. Browser storage quotas typically allow 50% of available disk but vary significantly between browsers and devices.

How do we store diverse data types efficiently while ensuring offline capability, data integrity, and optimal performance across different data access patterns?

## Decision Drivers

- PRD requirement: Offline-first architecture (ADR-0010) - all storage must work without network
- PRD "Professional" quality: Research-grade recordings must not corrupt
- Technical constraint: Browser storage quotas vary (10 MB localStorage vs GB+ IndexedDB)
- Performance requirement: IQ sample recording must stream without blocking UI
- Privacy requirement: Users must be able to clear all data easily
- Data volume: IQ recordings can be 100 MB+, require async/streaming access
- Access patterns: Frequent small reads (preferences) vs. rare large reads (recordings)
- Type safety: All stored data must validate against schemas (ADR-0007)

## Considered Options

- **Option 1**: Multi-tier strategy (Zustand persist (localStorage) + IndexedDB + File System Access API)
- **Option 2**: localStorage for everything
- **Option 3**: IndexedDB only for all data
- **Option 4**: Cache API for recordings
- **Option 5**: File System Access API only
- **Option 6**: OPFS (Origin Private File System)

## Decision Outcome

Chosen option: **"Option 1: Multi-tier storage strategy"** because it optimizes each storage tier for its specific use case—Zustand persist (localStorage) for small reactive application state, IndexedDB for large binary recordings (async, GB+ quota), and File System Access API for optional native file integration. This approach achieves offline-first capability, handles diverse data sizes efficiently, and provides the best performance for each data access pattern.

This aligns with PRD "professional" quality (reliable data persistence) and "precision" quality (type-safe validated storage).

### Consequences

- Good, because each storage tier optimized for its data characteristics
- Good, because Zustand persist provides reactive state persistence with minimal code
- Good, because IndexedDB handles large recordings without blocking UI
- Good, because all storage APIs work offline
- Good, because can store hours of IQ recordings (GB+ capacity)
- Good, because File System Access API allows native file workflows
- Good, because type-safe storage with Zod validation (ADR-0007)
- Bad, because three different APIs increase complexity
- Bad, because must handle quota exceeded errors gracefully
- Bad, because browser storage limits vary (quotas between 50 MB - 60% of disk)
- Bad, because IndexedDB harder to debug than localStorage
- Bad, because schema migrations required for IndexedDB structure changes
- Neutral, because storage quota requestable via `navigator.storage.persist()`
- Neutral, because all storage clearable via browser settings

### Confirmation

Storage strategy validated through:

1. **Write Performance**: Save 1 MB recording < 100ms, 100 MB recording < 5s
2. **Read Performance**: List 100 recordings < 50ms, load recording metadata < 10ms
3. **Local preference operations**: < 5ms for localStorage reads/writes via Zustand persist
4. **Quota Handling**: Graceful degradation when quota exceeded, user notification
5. **Data Integrity**: Zero corrupted recordings after 1000 record/playback cycles
6. **Load Test**: 10+ GB stored without performance degradation

Chrome DevTools Application panel used for storage inspection. Automated tests verify quota exceeded handling and migration logic.

## Pros and Cons of the Options

### Option 1: Multi-Tier Strategy (Chosen)

- Good, because each tier optimized for data characteristics
- Good, because Zustand persist provides reactive state with minimal code
- Good, because IndexedDB async API doesn't block UI during large writes
- Good, because File System Access API enables professional workflows (import/export)
- Good, because all tiers work offline
- Good, because type-safe storage with shared Zod schemas
- Good, because can store GB+ of recordings
- Neutral, because can request persistent storage to prevent eviction
- Neutral, because three APIs to test independently
- Bad, because more complex than single storage mechanism
- Bad, because must coordinate between storage tiers
- Bad, because quota management spans multiple APIs

### Option 2: localStorage Only

- Good, because simplest implementation (synchronous key-value API)
- Good, because 100% browser support
- Good, because easy to debug (Application panel)
- Bad, because ~10 MB limit inadequate for recordings
- Bad, because synchronous API blocks UI on large operations
- Bad, because string-only storage requires JSON serialization (slow for binary data)
- Bad, because violates PRD recording requirements

### Option 3: IndexedDB Only

- Good, because single API to learn
- Good, because async API doesn't block UI
- Good, because handles both small and large data
- Good, because GB+ quota available
- Neutral, because can store structured and binary data
- Bad, because verbose API for simple state (localStorage simpler)
- Bad, because no reactive updates (manual change detection required)
- Bad, because harder to debug than localStorage

### Option 4: Cache API for Recordings

- Good, because designed for offline storage
- Good, because good quota management
- Neutral, because async API
- Bad, because designed for HTTP responses, awkward for arbitrary recordings
- Bad, because less mature tooling than IndexedDB
- Bad, because doesn't handle structured application state

### Option 5: File System Access API Only

- Good, because unlimited storage (no quota)
- Good, because native file system integration
- Good, because familiar file metaphor
- Bad, because requires user permission (prompts)
- Bad, because Chrome-only (Safari/Firefox lack support)
- Bad, because doesn't work offline-first (requires initial permission grant)
- Bad, because no automatic sync (user must manually import)

### Option 6: OPFS (Origin Private File System)

- Good, because file-like API with quota
- Good, because async operations
- Good, because good performance
- Neutral, because Chrome 86+, Firefox 111+ support
- Bad, because newer API with less mature tooling
- Bad, because can defer to future enhancement

## More Information

### Tier 1: Zustand Persist (localStorage) Implementation

```typescript
// src/store/index.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  theme: "dark" | "light";
  fftSize: number;
  waterfallSpeed: number;
  colorScheme: "viridis" | "plasma" | "inferno" | "turbo";
  setPreferences: (p: Partial<PreferencesState>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "dark",
      fftSize: 2048,
      waterfallSpeed: 10,
      colorScheme: "viridis",
      setPreferences: (p) => set(p),
    }),
    {
      name: "sdr-preferences", // saved in localStorage
      version: 1,
    },
  ),
);

// Note: Large/structured data such as recordings and extensive bookmark libraries
// should use IndexedDB (see Tier 2 below) to avoid localStorage size limits.
```

**Benefits**:

- Reactive updates (components re-render automatically)
- Type-safe with TypeScript generics
- Persists automatically between sessions
- Simple API (useState-like)

### Tier 2: IndexedDB Implementation

```typescript
// src/lib/storage/recordings-db.ts
import { openDB, DBSchema, IDBPDatabase } from "idb";
import { RecordingSchema, Recording } from "./recording.schema";

interface SDRDatabase extends DBSchema {
  recordings: {
    key: string;
    value: Recording;
    indexes: {
      timestamp: number;
      frequency: number;
    };
  };
  exports: {
    key: string;
    value: Export;
    indexes: {
      timestamp: number;
      type: string;
    };
  };
}

class RecordingsDB {
  private db: IDBPDatabase<SDRDatabase> | null = null;

  async init() {
    this.db = await openDB<SDRDatabase>("sdr-storage", 1, {
      upgrade(db) {
        const recordingStore = db.createObjectStore("recordings", {
          keyPath: "id",
        });
        recordingStore.createIndex("timestamp", "timestamp");
        recordingStore.createIndex("frequency", "frequency");

        const exportStore = db.createObjectStore("exports", {
          keyPath: "id",
        });
        exportStore.createIndex("timestamp", "timestamp");
        exportStore.createIndex("type", "type");
      },
    });
  }

  async saveRecording(recording: Recording): Promise<void> {
    if (!this.db) await this.init();

    // Validate before storing (ADR-0007)
    const validated = RecordingSchema.parse(recording);
    await this.db!.add("recordings", validated);
  }

  async getRecording(id: string): Promise<Recording | undefined> {
    if (!this.db) await this.init();
    const data = await this.db!.get("recordings", id);

    // Validate on retrieval (handles schema migrations)
    return data ? RecordingSchema.parse(data) : undefined;
  }

  async listRecordings(): Promise<Recording[]> {
    if (!this.db) await this.init();
    const recordings = await this.db!.getAll("recordings");

    // Filter out any invalid recordings
    return recordings
      .filter((r) => {
        const result = RecordingSchema.safeParse(r);
        if (!result.success) {
          console.warn(`Invalid recording ${r.id}, skipping`, result.error);
        }
        return result.success;
      })
      .map((r) => RecordingSchema.parse(r));
  }

  async deleteRecording(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete("recordings", id);
  }

  async getStorageEstimate(): Promise<StorageEstimate> {
    return navigator.storage.estimate();
  }
}

export const recordingsDB = new RecordingsDB();
```

### Streaming Recording Strategy

For large recordings, stream chunks to avoid memory pressure:

```typescript
async function saveRecordingStreaming(
  recordingId: string,
  sampleStream: ReadableStream<Float32Array>,
  metadata: RecordingMetadata,
): Promise<void> {
  const chunks: Blob[] = [];
  const reader = sampleStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Convert Float32Array to Blob chunk
      chunks.push(new Blob([value.buffer]));

      // Progress feedback
      toast.info(
        `Recording: ${((chunks.length * value.length) / 1_000_000).toFixed(1)} MB`,
      );
    }
  } finally {
    reader.releaseLock();
  }

  const recording: Recording = {
    id: recordingId,
    timestamp: Date.now(),
    ...metadata,
    samples: new Blob(chunks, { type: "application/octet-stream" }),
    thumbnail: await generateThumbnail(chunks),
  };

  await recordingsDB.saveRecording(recording);
}
```

### Quota Management

```typescript
async function checkStorageQuota(): Promise<{
  available: number;
  used: number;
  percent: number;
  canStore: (bytes: number) => boolean;
}> {
  const estimate = await navigator.storage.estimate();
  const available = estimate.quota || 0;
  const used = estimate.usage || 0;
  const percent = (used / available) * 100;

  return {
    available,
    used,
    percent,
    canStore: (bytes: number) => used + bytes < available * 0.9, // 90% threshold
  };
}

async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      toast.success("Storage will not be automatically cleared");
    }
    return isPersisted;
  }
  return false;
}

// Use before large recording
async function ensureStorageCapacity(requiredBytes: number): Promise<void> {
  const quota = await checkStorageQuota();

  if (!quota.canStore(requiredBytes)) {
    toast.error(
      `Insufficient storage: need ${(requiredBytes / 1_000_000).toFixed(0)} MB, ` +
        `have ${((quota.available - quota.used) / 1_000_000).toFixed(0)} MB available`,
      {
        action: {
          label: "Manage Storage",
          onClick: () => navigateTo("/settings/storage"),
        },
      },
    );
    throw new Error("QUOTA_EXCEEDED");
  }
}
```

### Tier 3: File System Access API (Progressive Enhancement)

```typescript
async function exportRecordingToFile(recording: Recording): Promise<void> {
  if (!("showSaveFilePicker" in window)) {
    // Fallback: download via blob URL
    const url = URL.createObjectURL(recording.samples);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sdr-${recording.frequency}-${recording.timestamp}.iq`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `sdr-${recording.frequency}-${recording.timestamp}.iq`,
      types: [
        {
          description: "IQ Recording",
          accept: {
            "application/octet-stream": [".iq", ".raw", ".cfile"],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(recording.samples);
    await writable.close();

    toast.success("Recording exported successfully");
  } catch (error) {
    if (error.name === "AbortError") {
      // User cancelled
      return;
    }
    throw error;
  }
}

async function importRecordingFromFile(): Promise<Recording | null> {
  if (!("showOpenFilePicker" in window)) {
    toast.error("File import not supported in this browser");
    return null;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "IQ Recording",
          accept: {
            "application/octet-stream": [".iq", ".raw", ".cfile"],
          },
        },
      ],
      multiple: false,
    });

    const file = await handle.getFile();
    const samples = new Blob([await file.arrayBuffer()]);

    // Parse metadata from filename or prompt user
    const metadata = await promptForMetadata(file.name);

    const recording: Recording = {
      id: ulid(),
      timestamp: Date.now(),
      ...metadata,
      samples,
      thumbnail: await generateThumbnail(samples),
    };

    await recordingsDB.saveRecording(recording);
    return recording;
  } catch (error) {
    if (error.name === "AbortError") {
      return null;
    }
    throw error;
  }
}
```

### Schema Migration Example

```typescript
// src/lib/storage/migrations.ts

const RecordingSchemaV1 = z.object({
  id: z.string(),
  frequency: z.number(),
  sampleRate: z.number(),
  // v1 fields...
});

const RecordingSchemaV2 = z.object({
  id: z.string().ulid(), // Changed to ULID
  frequency: FrequencyHz, // Changed to branded type
  sampleRate: SampleRateHz,
  format: z.enum(["iq-float32", "iq-int16"]), // New field
  // v2 fields...
  version: z.literal(2),
});

async function migrateRecording(data: unknown): Promise<Recording> {
  // Try v2 first
  const v2Result = RecordingSchemaV2.safeParse(data);
  if (v2Result.success) return v2Result.data;

  // Fall back to v1 and migrate
  const v1 = RecordingSchemaV1.parse(data);

  return RecordingSchemaV2.parse({
    ...v1,
    id: ulid(), // Generate new ULID
    frequency: FrequencyHz.parse(v1.frequency),
    sampleRate: SampleRateHz.parse(v1.sampleRate),
    format: "iq-float32", // Default format
    version: 2,
  });
}
```

### References

#### W3C Standards and Browser APIs

- [IndexedDB API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - W3C specification for large-scale structured data storage
- [File System Access API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) - Native file system integration
- [Storage API - Quotas - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API) - Storage quota management specification

#### Academic Research and Technical Articles

- "Client-Side Processing and Storage of Large Data Volumes in Web Applications." CI Machine Learning (Vol 6, Issue 1). [PDF](https://www.cimachinelearning.com/assets/article/vol6-iss1/client-side-processing.pdf) - Academic research on IndexedDB performance with large datasets and Web Workers integration
- "IndexedDB and Web Workers: A Guide to Offline-First Web Apps." Adyog Blog (2024). [Article](https://blog.adyog.com/2024/09/29/indexeddb-and-web-workers-a-guide-to-offline-first-web-apps/) - Best practices for combining IndexedDB with Web Workers
- "Effectively Storing Large Volumes of Data in the Browser: IndexedDB vs LocalStorage." JayData (2024). [Technical Comparison](https://jaydata.org/effectively-storing-large-volumes-of-data-in-the-browser-indexeddb-vs-localstorage/) - Performance analysis showing IndexedDB superiority for binary data
- "LocalStorage vs. IndexedDB for Binary Data." Scanbot SDK (2024). [Benchmark Study](https://scanbot.io/techblog/storage-wars-web-edition/) - Performance benchmarks with binary data storage patterns
- Stack Overflow. "Performance issues with IndexedDB storing 250kB/s streaming data." [Discussion](https://stackoverflow.com/questions/30687226/performance-issues-with-indexeddb-storing-250kb-s-streaming-data) - Real-world streaming data challenges and solutions

#### Libraries and Tools

- [idb - IndexedDB Wrapper](https://github.com/jakearchibald/idb) - Promise-based IndexedDB library by Jake Archibald
- [Storage for the Web](https://web.dev/storage-for-the-web/) - Google web.dev comprehensive storage guide
- "Working with Quota Management" - web.dev - Best practices for storage quota management

#### Related ADRs

- ADR-0007: Type Safety and Validation (storage schema validation with Zod)
- ADR-0010: Offline-First Architecture (storage requirements for offline capability)
- ADR-0002: Web Worker DSP Architecture (Web Workers + IndexedDB integration)
