import { isWasmSupported } from "../dspWasm";

describe("dspWasm smoke", () => {
  it("isWasmSupported returns boolean", () => {
    expect(typeof isWasmSupported()).toBe("boolean");
  });
});
