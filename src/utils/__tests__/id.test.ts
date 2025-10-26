import { generateBookmarkId } from "../id";

describe("generateBookmarkId", () => {
  it("returns a string starting with bm-", () => {
    const id = generateBookmarkId();
    expect(typeof id).toBe("string");
    expect(id.startsWith("bm-")).toBe(true);
  });

  it("produces unique IDs across many calls", () => {
    const n = 5000;
    const set = new Set<string>();
    for (let i = 0; i < n; i++) {
      set.add(generateBookmarkId());
    }
    expect(set.size).toBe(n);
  });

  it("uses provided crypto.randomUUID when available", () => {
    const fakeUUID = "01234567-89ab-cdef-0123-456789abcdef";
    const id = generateBookmarkId({ randomUUID: () => fakeUUID });
    expect(id).toBe(`bm-${fakeUUID}`);
  });

  it("formats UUID-like token when only getRandomValues is available", () => {
    const stub = {
      getRandomValues: (arr: Uint32Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = 0;
        return arr;
      },
    };
    const id = generateBookmarkId(stub as any);
    expect(id).toMatch(/^bm-00000000-0000-0000-0000-000000000000$/);
  });

  it("fallback path remains unique for same-tick calls (counter)", () => {
    const spy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    try {
      const a = generateBookmarkId({} as any);
      const b = generateBookmarkId({} as any);
      expect(a).not.toBe(b);
      expect(a.startsWith("bm-")).toBe(true);
      expect(b.startsWith("bm-")).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
