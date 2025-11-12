import { rdsCacheStore, getCachedRDSData, updateCachedRDSData } from "../../store/rdsCache";
import { createEmptyRDSData, type RDSStationData } from "../../models/RDSData";

describe("rdsCache tolerance and lookup", () => {
  beforeEach(() => {
    // Clear store
    const state = rdsCacheStore.getState();
    state.prune(0); // prune with maxAge 0 to clear everything
  });

  it("finds nearby RDS data within tolerance (e.g., ~100kHz offset)", () => {
    const stationFreq = 100100000; // 100.100 MHz
    const queryFreq = 100000000; // 100.000 MHz (detected)
    const data = createEmptyRDSData();
    data.ps = "TESTPS";

    updateCachedRDSData(stationFreq, data);
    const found = getCachedRDSData(queryFreq);
    expect(found).toBeDefined();
    expect(found?.ps).toBe("TESTPS");
  });

  it("does not return station data outside tolerance", () => {
    const stationFreq = 100300000; // 100.300 MHz
    const queryFreq = 100000000; // 100.000 MHz
    const data = createEmptyRDSData();
    data.ps = "TESTPS2";

    updateCachedRDSData(stationFreq, data);
    const found = getCachedRDSData(queryFreq);
    expect(found).toBeUndefined();
  });
});
// Consolidated imports at top of the file

function makeData(ps: string, rt?: string): RDSStationData {
  const base = createEmptyRDSData();
  return {
    ...base,
    ps,
    rt: rt ?? "",
    lastUpdate: Date.now(),
    signalQuality: 75,
  };
}

describe("rdsCacheStore", () => {
  test("stores and retrieves exact frequency", () => {
    const freq = 100.1e6;
    const data = makeData("TESTFM", "Hello World");
    updateCachedRDSData(freq, data);
    const retrieved = getCachedRDSData(freq);
    expect(retrieved?.ps).toBe("TESTFM");
    expect(retrieved?.rt).toBe("Hello World");
  });

  test("retrieves nearby frequency within tolerance", () => {
    const base = 99.5e6;
    const nearby = base + 50_000; // 50 kHz offset
    const data = makeData("NEARBY");
    updateCachedRDSData(base, data);
    const retrieved = getCachedRDSData(nearby);
    expect(retrieved?.ps).toBe("NEARBY");
  });

  test("prunes stale entries", () => {
    const freq = 101.7e6;
    const data = makeData("OLD");
    updateCachedRDSData(freq, data);
    // Manually age the entry
    const state = rdsCacheStore.getState();
    const entry = state.entries.get(freq);
    if (entry) {
      entry.lastUpdated = Date.now() - 16 * 60 * 1000; // 16 minutes ago
    }
    state.prune(15 * 60 * 1000);
    expect(getCachedRDSData(freq)).toBeUndefined();
  });

  test("bulk updates and range query return sorted stations", () => {
    const base = 90e6;
    const updates = [
      { frequencyHz: base + 800000, data: makeData("STN1") }, // 90.8
      { frequencyHz: base + 200000, data: makeData("STN2") }, // 90.2
      { frequencyHz: base + 600000, data: makeData("STN3") }, // 90.6
    ];
    // Use new bulk update API
    const { updateBulkRDSData } = rdsCacheStore.getState();
    updateBulkRDSData(updates);
    const { getStationsInRange } = rdsCacheStore.getState();
    const stations = getStationsInRange(90e6, 91e6);
    // Expect 3 stations and ordering by frequency ascending (90.2, 90.6, 90.8)
    expect(stations.length).toBe(3);
    expect(stations[0]!.ps).toBe("STN2");
    expect(stations[1]!.ps).toBe("STN3");
    expect(stations[2]!.ps).toBe("STN1");
  });
});
