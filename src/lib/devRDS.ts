import { createEmptyRDSData } from "../models/RDSData";
import { updateBulkCachedRDSData } from "../store/rdsCache";

// Seed deterministic RDS data for dev/e2e testing.
export function seedDebugRDS(
  entries: Array<{ frequencyHz: number; ps?: string; rt?: string }>,
): void {
  const updates = entries.map((e) => {
    const data = createEmptyRDSData();
    if (e.ps) data.ps = e.ps;
    if (e.rt) data.rt = e.rt;
    data.pi = 0x1234; // dummy PI for dev entries
    data.lastUpdate = Date.now();
    return { frequencyHz: e.frequencyHz, data };
  });
  updateBulkCachedRDSData(updates);
}
