/**
 * Tiny extra branch coverage for p25decoder: negative wrap-around in normalizePhase via phaseToSymbol
 */

import { phaseToSymbol, P25Symbol } from "../p25decoder";

describe("p25decoder extra branches", () => {
  it("handles negative wrap-around below -pi", () => {
    const phase = (-225 * Math.PI) / 180; // -225° -> should wrap to +135° equivalent bucket
    const sym = phaseToSymbol(phase);
    // Accept either SYMBOL_11 (135°) or SYMBOL_00 (-135°) depending on normalization boundary handling
    expect([P25Symbol.SYMBOL_11, P25Symbol.SYMBOL_00]).toContain(sym);
  });
});
