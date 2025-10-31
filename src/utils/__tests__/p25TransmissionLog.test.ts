/**
 * Tests for P25 Transmission Logger
 */

import {
  P25TransmissionLogger,
  getP25TransmissionLogger,
  type TransmissionRecord,
} from "../p25TransmissionLog";

// Mock IndexedDB
const mockIndexedDB = (() => {
  let stores: Map<string, Map<number, TransmissionRecord>> = new Map();
  let currentId = 1;

  const mockStore = (storeName: string) => {
    if (!stores.has(storeName)) {
      stores.set(storeName, new Map());
    }
    return stores.get(storeName)!;
  };

  return {
    open: (_dbName: string, _version: number) => {
      const request = {
        result: null as unknown,
        error: null as unknown,
        onsuccess: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
      };

      // Simulate async operation
      setTimeout(() => {
        const db = {
          objectStoreNames: {
            contains: (name: string) => stores.has(name),
          },
          createObjectStore: (name: string, _options: IDBObjectStoreParameters) => {
            mockStore(name);
            return {
              createIndex: () => {},
            };
          },
          transaction: (_storeNames: string[], _mode: IDBTransactionMode) => {
            return {
              objectStore: (name: string) => {
                const store = mockStore(name);
                return {
                  add: (record: TransmissionRecord) => {
                    const req = {
                      result: null as unknown,
                      onsuccess: null as ((event: Event) => void) | null,
                      onerror: null as ((event: Event) => void) | null,
                    };
                    setTimeout(() => {
                      const id = currentId++;
                      store.set(id, { ...record, id });
                      req.result = id;
                      if (req.onsuccess) {
                        req.onsuccess({} as Event);
                      }
                    }, 0);
                    return req;
                  },
                  count: () => {
                    const req = {
                      result: store.size,
                      onsuccess: null as ((event: Event) => void) | null,
                      onerror: null as ((event: Event) => void) | null,
                    };
                    setTimeout(() => {
                      if (req.onsuccess) {
                        req.onsuccess({} as Event);
                      }
                    }, 0);
                    return req;
                  },
                  clear: () => {
                    const req = {
                      onsuccess: null as ((event: Event) => void) | null,
                      onerror: null as ((event: Event) => void) | null,
                    };
                    setTimeout(() => {
                      store.clear();
                      if (req.onsuccess) {
                        req.onsuccess({} as Event);
                      }
                    }, 0);
                    return req;
                  },
                  index: (indexName: string) => {
                    return {
                      openCursor: (range: unknown | null, direction?: IDBCursorDirection) => {
                        const req = {
                          result: null as unknown,
                          onsuccess: null as ((event: Event) => void) | null,
                          onerror: null as ((event: Event) => void) | null,
                        };
                        setTimeout(() => {
                          let records = Array.from(store.values());
                          
                          // Filter by range if provided
                          if (range && typeof range === "object") {
                            const keyRange = range as { lower?: number; upper?: number; open?: boolean };
                            if (indexName === "talkgroupId" && keyRange.lower !== undefined) {
                              records = records.filter((r) => r.talkgroupId === keyRange.lower);
                            } else if (indexName === "sourceId" && keyRange.lower !== undefined) {
                              records = records.filter((r) => r.sourceId === keyRange.lower);
                            } else if (indexName === "timestamp" && keyRange.upper !== undefined) {
                              if (keyRange.open) {
                                records = records.filter((r) => r.timestamp < keyRange.upper!);
                              } else {
                                records = records.filter((r) => r.timestamp <= keyRange.upper!);
                              }
                            }
                          }
                          
                          // Sort by timestamp descending if using timestamp index
                          if (indexName === "timestamp" && direction === "prev") {
                            records.sort((a, b) => b.timestamp - a.timestamp);
                          }
                          
                          let index = 0;
                          const createCursor = () => {
                            if (index < records.length) {
                              return {
                                value: records[index],
                                continue: () => {
                                  index++;
                                  req.result = index < records.length ? createCursor() : null;
                                  if (req.onsuccess) {
                                    req.onsuccess({
                                      target: { result: req.result },
                                    } as unknown as Event);
                                  }
                                },
                                delete: () => {
                                  const record = records[index];
                                  if (record?.id !== undefined) {
                                    store.delete(record.id);
                                  }
                                },
                              };
                            }
                            return null;
                          };
                          
                          req.result = createCursor();
                          if (req.onsuccess) {
                            req.onsuccess({
                              target: { result: req.result },
                            } as unknown as Event);
                          }
                        }, 0);
                        return req;
                      },
                    };
                  },
                };
              },
            };
          },
          close: () => {},
        };

        // Trigger upgrade if needed
        if (request.onupgradeneeded) {
          request.onupgradeneeded({
            target: { result: db },
          } as unknown as IDBVersionChangeEvent);
        }

        request.result = db;
        if (request.onsuccess) {
          request.onsuccess({} as Event);
        }
      }, 0);

      return request;
    },
    reset: () => {
      stores.clear();
      currentId = 1;
    },
  };
})();

describe("P25TransmissionLogger", () => {
  let logger: P25TransmissionLogger;

  beforeAll(() => {
    // Mock IndexedDB
    Object.defineProperty(window, "indexedDB", {
      writable: true,
      value: mockIndexedDB,
    });

    // Mock IDBKeyRange
    Object.defineProperty(window, "IDBKeyRange", {
      writable: true,
      value: {
        only: (value: number) => ({ lower: value, upper: value }),
        upperBound: (bound: number, open: boolean) => ({ upper: bound, open }),
      },
    });
  });

  beforeEach(() => {
    mockIndexedDB.reset();
    logger = new P25TransmissionLogger();
  });

  afterEach(async () => {
    logger.close();
  });

  describe("init", () => {
    it("should initialize database successfully", async () => {
      await expect(logger.init()).resolves.toBeUndefined();
    });

    it("should only initialize once", async () => {
      await logger.init();
      await expect(logger.init()).resolves.toBeUndefined();
    });
  });

  describe("logTransmission", () => {
    it("should log a transmission record", async () => {
      const record: TransmissionRecord = {
        timestamp: Date.now(),
        talkgroupId: 101,
        sourceId: 2001,
        duration: 5000,
        signalQuality: 85,
        slot: 1,
        isEncrypted: false,
        errorRate: 0.05,
      };

      const id = await logger.logTransmission(record);
      expect(id).toBeGreaterThan(0);
    });

    it("should auto-increment IDs", async () => {
      const record1: TransmissionRecord = {
        timestamp: Date.now(),
        talkgroupId: 101,
        duration: 1000,
        signalQuality: 80,
        slot: 1,
        isEncrypted: false,
        errorRate: 0.1,
      };

      const record2: TransmissionRecord = {
        timestamp: Date.now(),
        talkgroupId: 102,
        duration: 2000,
        signalQuality: 90,
        slot: 2,
        isEncrypted: false,
        errorRate: 0.05,
      };

      const id1 = await logger.logTransmission(record1);
      const id2 = await logger.logTransmission(record2);
      expect(id2).toBeGreaterThan(id1);
    });
  });

  describe("queryTransmissions", () => {
    beforeEach(async () => {
      // Add test data
      const now = Date.now();
      const records: TransmissionRecord[] = [
        {
          timestamp: now - 10000,
          talkgroupId: 101,
          sourceId: 2001,
          duration: 5000,
          signalQuality: 85,
          slot: 1,
          isEncrypted: false,
          errorRate: 0.05,
        },
        {
          timestamp: now - 5000,
          talkgroupId: 102,
          sourceId: 2002,
          duration: 3000,
          signalQuality: 90,
          slot: 2,
          isEncrypted: false,
          errorRate: 0.03,
        },
        {
          timestamp: now,
          talkgroupId: 101,
          sourceId: 2003,
          duration: 7000,
          signalQuality: 75,
          slot: 1,
          isEncrypted: true,
          errorRate: 0.1,
        },
      ];

      for (const record of records) {
        await logger.logTransmission(record);
      }
    });

    it("should query all transmissions", async () => {
      const results = await logger.queryTransmissions();
      expect(results.length).toBe(3);
    });

    it("should filter by talkgroup ID", async () => {
      const results = await logger.queryTransmissions({ talkgroupId: 101 });
      expect(results.length).toBe(2);
      expect(results.every((r) => r.talkgroupId === 101)).toBe(true);
    });

    it("should filter by source ID", async () => {
      const results = await logger.queryTransmissions({ sourceId: 2002 });
      expect(results.length).toBe(1);
      expect(results[0]?.sourceId).toBe(2002);
    });

    it("should filter by time range", async () => {
      const now = Date.now();
      const results = await logger.queryTransmissions({
        startTime: now - 6000,
        endTime: now,
      });
      expect(results.length).toBe(2);
    });

    it("should filter by minimum quality", async () => {
      const results = await logger.queryTransmissions({ minQuality: 80 });
      expect(results.length).toBe(2);
      expect(results.every((r) => r.signalQuality >= 80)).toBe(true);
    });

    it("should apply limit", async () => {
      const results = await logger.queryTransmissions({ limit: 2 });
      expect(results.length).toBe(2);
    });

    it("should apply offset", async () => {
      const results = await logger.queryTransmissions({ offset: 1, limit: 2 });
      expect(results.length).toBe(2);
    });
  });

  describe("getCount", () => {
    beforeEach(async () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        await logger.logTransmission({
          timestamp: now - i * 1000,
          talkgroupId: 101 + (i % 2),
          duration: 1000,
          signalQuality: 80,
          slot: 1,
          isEncrypted: false,
          errorRate: 0.1,
        });
      }
    });

    it("should count all transmissions", async () => {
      const count = await logger.getCount();
      expect(count).toBe(5);
    });

    it("should count filtered transmissions", async () => {
      const count = await logger.getCount({ talkgroupId: 101 });
      expect(count).toBe(3);
    });
  });

  describe("deleteOlderThan", () => {
    it("should delete old records", async () => {
      const now = Date.now();
      await logger.logTransmission({
        timestamp: now - 10000,
        talkgroupId: 101,
        duration: 1000,
        signalQuality: 80,
        slot: 1,
        isEncrypted: false,
        errorRate: 0.1,
      });
      await logger.logTransmission({
        timestamp: now,
        talkgroupId: 102,
        duration: 1000,
        signalQuality: 80,
        slot: 1,
        isEncrypted: false,
        errorRate: 0.1,
      });

      const deletedCount = await logger.deleteOlderThan(now - 5000);
      expect(deletedCount).toBe(1);

      const remaining = await logger.queryTransmissions();
      expect(remaining.length).toBe(1);
      expect(remaining[0]?.talkgroupId).toBe(102);
    });
  });

  describe("clear", () => {
    it("should clear all records", async () => {
      await logger.logTransmission({
        timestamp: Date.now(),
        talkgroupId: 101,
        duration: 1000,
        signalQuality: 80,
        slot: 1,
        isEncrypted: false,
        errorRate: 0.1,
      });

      await logger.clear();

      const count = await logger.getCount();
      expect(count).toBe(0);
    });
  });

  describe("getP25TransmissionLogger", () => {
    it("should return singleton instance", () => {
      const instance1 = getP25TransmissionLogger();
      const instance2 = getP25TransmissionLogger();
      expect(instance1).toBe(instance2);
    });
  });
});
