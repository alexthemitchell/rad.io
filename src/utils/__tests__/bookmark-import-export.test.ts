import type { Bookmark } from "../../types/bookmark";
import {
  bookmarksToCSV,
  downloadBookmarksCSV,
  parseBookmarksCSV,
  mergeBookmarks,
} from "../bookmark-import-export";

describe("bookmark-import-export", () => {
  describe("bookmarksToCSV", () => {
    it("should convert bookmarks to CSV with headers", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "Local FM Station",
          tags: ["broadcast", "fm"],
          notes: "Local radio station",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);
      const lines = csv.split("\n");

      expect(lines[0]).toBe(
        "Frequency (Hz),Name,Tags,Notes,Created At,Last Used",
      );
      expect(lines[1]).toBe(
        '100000000,Local FM Station,"broadcast,fm",Local radio station,1700000000000,1700000001000',
      );
    });

    it("should escape fields containing commas", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 146520000,
          name: "2m Simplex, Calling",
          tags: ["amateur", "vhf"],
          notes: "Test note",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);
      const lines = csv.split("\n");

      expect(lines[1]).toContain('"2m Simplex, Calling"');
    });

    it("should escape fields containing quotes", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 162550000,
          name: 'Station "Alpha"',
          tags: ["weather"],
          notes: 'Also known as "WX1"',
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);

      expect(csv).toContain('"Station ""Alpha"""');
      expect(csv).toContain('"Also known as ""WX1"""');
    });

    it("should escape fields containing newlines", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "Station",
          tags: ["test"],
          notes: "Line 1\nLine 2",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);

      expect(csv).toContain('"Line 1\nLine 2"');
    });

    it("should escape fields containing carriage returns", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "Station\rName",
          tags: ["test"],
          notes: "Note with\r\nCRLF",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);

      expect(csv).toContain('"Station\rName"');
      expect(csv).toContain('"Note with\r\nCRLF"');
    });

    it("should prevent formula injection in name field", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "=1+1",
          tags: ["test"],
          notes: "Normal note",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);

      expect(csv).toContain("'=1+1");
    });

    it("should prevent formula injection with multiple trigger characters", () => {
      const testCases = [
        { name: "=SUM(A1:A10)", expected: "'=SUM(A1:A10)" },
        { name: "+1+1", expected: "'+1+1" },
        { name: "-1", expected: "'-1" },
        { name: "@formula", expected: "'@formula" },
      ];

      testCases.forEach(({ name, expected }) => {
        const bookmarks: Bookmark[] = [
          {
            id: "bm-1",
            frequency: 100000000,
            name,
            tags: ["test"],
            notes: "Test",
            createdAt: 1700000000000,
            lastUsed: 1700000001000,
          },
        ];

        const csv = bookmarksToCSV(bookmarks);
        expect(csv).toContain(expected);
      });
    });

    it("should prevent formula injection in notes field", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "Station",
          tags: ["test"],
          notes: "=HYPERLINK('http://evil.com','Click')",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);

      expect(csv).toContain("'=HYPERLINK");
    });

    it("should handle empty bookmarks array", () => {
      const csv = bookmarksToCSV([]);

      expect(csv).toBe("Frequency (Hz),Name,Tags,Notes,Created At,Last Used");
    });

    it("should handle bookmarks with no tags", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "Station",
          tags: [],
          notes: "No tags",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);
      const lines = csv.split("\n");

      expect(lines[1]).toBe(
        "100000000,Station,,No tags,1700000000000,1700000001000",
      );
    });

    it("should handle bookmarks with empty notes", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "Station",
          tags: ["test"],
          notes: "",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);
      const lines = csv.split("\n");

      expect(lines[1]).toBe(
        "100000000,Station,test,,1700000000000,1700000001000",
      );
    });

    it("should handle multiple bookmarks", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "FM Radio",
          tags: ["fm"],
          notes: "Note 1",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
        {
          id: "bm-2",
          frequency: 162550000,
          name: "NOAA Weather",
          tags: ["weather"],
          notes: "Note 2",
          createdAt: 1700000002000,
          lastUsed: 1700000003000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);
      const lines = csv.split("\n");

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe(
        "Frequency (Hz),Name,Tags,Notes,Created At,Last Used",
      );
      expect(lines[1]).toBe(
        "100000000,FM Radio,fm,Note 1,1700000000000,1700000001000",
      );
      expect(lines[2]).toBe(
        "162550000,NOAA Weather,weather,Note 2,1700000002000,1700000003000",
      );
    });

    it("should handle complex tag combinations", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 146520000,
          name: "2m Calling",
          tags: ["amateur", "vhf", "simplex"],
          notes: "Multi-tag test",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      const csv = bookmarksToCSV(bookmarks);

      expect(csv).toContain('"amateur,vhf,simplex"');
    });
  });

  describe("downloadBookmarksCSV", () => {
    let mockAnchor: HTMLAnchorElement;
    let createObjectURLMock: jest.Mock;
    let revokeObjectURLMock: jest.Mock;

    beforeEach(() => {
      // Mock URL.createObjectURL and revokeObjectURL
      createObjectURLMock = jest.fn().mockReturnValue("blob:mock-url");
      revokeObjectURLMock = jest.fn();

      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      // Mock anchor element
      mockAnchor = {
        href: "",
        download: "",
        click: jest.fn(),
      } as unknown as HTMLAnchorElement;

      jest.spyOn(document, "createElement").mockReturnValue(mockAnchor);
      jest
        .spyOn(document.body, "appendChild")
        .mockImplementation(() => mockAnchor);
      jest
        .spyOn(document.body, "removeChild")
        .mockImplementation(() => mockAnchor);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should create blob and trigger download", () => {
      const bookmarks: Bookmark[] = [
        {
          id: "bm-1",
          frequency: 100000000,
          name: "Test",
          tags: ["test"],
          notes: "Note",
          createdAt: 1700000000000,
          lastUsed: 1700000001000,
        },
      ];

      downloadBookmarksCSV(bookmarks);

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(mockAnchor.href).toBe("blob:mock-url");
      expect(mockAnchor.download).toMatch(/^bookmarks-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
    });

    it("should generate filename with current date", () => {
      const bookmarks: Bookmark[] = [];

      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-11-18T12:00:00Z"));

      downloadBookmarksCSV(bookmarks);

      expect(mockAnchor.download).toBe("bookmarks-2025-11-18.csv");

      jest.useRealTimers();
    });

    it("should handle empty bookmarks array", () => {
      downloadBookmarksCSV([]);

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(mockAnchor.click).toHaveBeenCalled();
    });
  });

  describe("parseBookmarksCSV", () => {
    it("should parse valid CSV with all fields", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,Local FM,"broadcast,fm",Test note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(1);
      expect(preview.duplicates).toHaveLength(0);
      expect(preview.errors).toHaveLength(0);

      const bookmark = preview.valid[0];
      expect(bookmark).toBeDefined();
      expect(bookmark?.frequency).toBe(100000000);
      expect(bookmark?.name).toBe("Local FM");
      expect(bookmark?.tags).toEqual(["broadcast", "fm"]);
      expect(bookmark?.notes).toBe("Test note");
      expect(bookmark?.createdAt).toBe(1700000000000);
      expect(bookmark?.lastUsed).toBe(1700000001000);
      expect(bookmark?.id).toBeTruthy();
    });

    it("should handle optional fields", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,Simple Station,,,`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(1);
      const bookmark = preview.valid[0];
      expect(bookmark).toBeDefined();
      expect(bookmark?.frequency).toBe(100000000);
      expect(bookmark?.name).toBe("Simple Station");
      expect(bookmark?.tags).toEqual([]);
      expect(bookmark?.notes).toBe("");
      expect(bookmark?.createdAt).toBeGreaterThan(0);
      expect(bookmark?.lastUsed).toBeGreaterThan(0);
    });

    it("should reject missing frequency", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
,Test Station,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(0);
      expect(preview.errors.length).toBeGreaterThan(0);
      expect(
        preview.errors.some((e) => e.message.includes("Missing frequency")),
      ).toBe(true);
    });

    it("should reject missing name", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(0);
      expect(preview.errors.length).toBeGreaterThan(0);
      expect(
        preview.errors.some((e) => e.message.includes("Missing name")),
      ).toBe(true);
    });

    it("should reject invalid frequency (non-numeric)", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
invalid,Test Station,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(0);
      expect(preview.errors.length).toBeGreaterThan(0);
      expect(
        preview.errors.some((e) => e.message.includes("Invalid frequency")),
      ).toBe(true);
    });

    it("should reject frequency below minimum (24 MHz)", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
1000000,Test Station,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(0);
      expect(preview.errors.length).toBeGreaterThan(0);
      expect(
        preview.errors.some((e) => e.message.includes("out of range")),
      ).toBe(true);
    });

    it("should reject frequency above maximum (1.7 GHz)", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
2000000000,Test Station,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(0);
      expect(preview.errors.length).toBeGreaterThan(0);
      expect(
        preview.errors.some((e) => e.message.includes("out of range")),
      ).toBe(true);
    });

    it("should accept frequency at minimum boundary (24 MHz)", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
24000000,Test Station,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(1);
      expect(preview.errors).toHaveLength(0);
    });

    it("should accept frequency at maximum boundary (1.7 GHz)", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
1700000000,Test Station,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(1);
      expect(preview.errors).toHaveLength(0);
    });

    it("should detect duplicates within 1kHz tolerance", () => {
      const existingBookmarks: Bookmark[] = [
        {
          id: "existing-1",
          frequency: 100000000,
          name: "Existing Station",
          tags: ["existing"],
          notes: "Already there",
          createdAt: 1600000000000,
          lastUsed: 1600000001000,
        },
      ];

      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000500,New Station,new,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, existingBookmarks);

      expect(preview.valid).toHaveLength(0);
      expect(preview.duplicates).toHaveLength(1);
      expect(preview.errors).toHaveLength(0);

      const duplicate = preview.duplicates[0];
      expect(duplicate).toBeDefined();
      expect(duplicate?.imported.frequency).toBe(100000500);
      expect(duplicate?.existing.frequency).toBe(100000000);
      if (duplicate) {
        expect(
          Math.abs(duplicate.imported.frequency - duplicate.existing.frequency),
        ).toBeLessThanOrEqual(1000);
      }
    });

    it("should not detect duplicate when difference is greater than 1kHz", () => {
      const existingBookmarks: Bookmark[] = [
        {
          id: "existing-1",
          frequency: 100000000,
          name: "Existing Station",
          tags: [],
          notes: "",
          createdAt: 1600000000000,
          lastUsed: 1600000001000,
        },
      ];

      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100002000,New Station,new,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, existingBookmarks);

      expect(preview.valid).toHaveLength(1);
      expect(preview.duplicates).toHaveLength(0);
      expect(preview.errors).toHaveLength(0);
    });

    it("should handle multiple valid bookmarks", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,Station 1,fm,Note 1,1700000000000,1700000001000
162550000,Station 2,weather,Note 2,1700000002000,1700000003000
146520000,Station 3,amateur,Note 3,1700000004000,1700000005000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(3);
      expect(preview.duplicates).toHaveLength(0);
      expect(preview.errors).toHaveLength(0);
    });

    it("should detect internal duplicates within CSV file", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,First Station,fm,Note 1,1700000000000,1700000001000
100000500,Duplicate Station,fm,Note 2,1700000002000,1700000003000
162550000,Valid Station,weather,Note 3,1700000004000,1700000005000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(2); // First and third stations
      expect(preview.duplicates).toHaveLength(0); // No duplicates with existing
      expect(preview.errors).toHaveLength(1); // Second station is internal duplicate
      expect(preview.errors[0]?.message).toContain(
        "Duplicate frequency within CSV",
      );
      expect(preview.errors[0]?.message).toContain("First Station");
    });

    it("should detect duplicates at bucket boundaries", () => {
      // Test edge case where frequencies near bucket boundaries are correctly detected
      // With bucketSize = 2000 (DUPLICATE_TOLERANCE * 2), frequencies should be
      // detected as duplicates even when they fall into different buckets
      const existingBookmarks: Bookmark[] = [
        {
          id: "existing-1",
          frequency: 99999000, // bucket 49999 (with bucketSize=2000)
          name: "Near Boundary Low",
          tags: [],
          notes: "",
          createdAt: 1600000000000,
          lastUsed: 1600000001000,
        },
      ];

      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
99999500,Near Boundary High,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, existingBookmarks);

      expect(preview.valid).toHaveLength(0);
      expect(preview.duplicates).toHaveLength(1);
      expect(preview.errors).toHaveLength(0);
      const duplicate = preview.duplicates[0];
      expect(duplicate).toBeDefined();
      if (duplicate) {
        expect(
          Math.abs(duplicate.imported.frequency - duplicate.existing.frequency),
        ).toBeLessThanOrEqual(1000);
      }
    });

    it("should handle mix of valid, invalid, and duplicate bookmarks", () => {
      const existingBookmarks: Bookmark[] = [
        {
          id: "existing-1",
          frequency: 100000000,
          name: "Existing",
          tags: [],
          notes: "",
          createdAt: 1600000000000,
          lastUsed: 1600000001000,
        },
      ];

      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000500,Duplicate,dup,note,1700000000000,1700000001000
invalid,Invalid Name,test,note,1700000000000,1700000001000
162550000,Valid,weather,note,1700000000000,1700000001000
,No Frequency,test,note,1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, existingBookmarks);

      expect(preview.valid).toHaveLength(1);
      expect(preview.duplicates).toHaveLength(1);
      expect(preview.errors).toHaveLength(2);
    });

    it("should parse tags correctly with whitespace", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,Test," weather , fm , broadcast ",note`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(1);
      expect(preview.valid[0]?.tags).toEqual(["weather", "fm", "broadcast"]);
    });

    it("should handle empty CSV", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(0);
      expect(preview.duplicates).toHaveLength(0);
      expect(preview.errors).toHaveLength(0);
    });

    it("should skip empty lines", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,Station 1,fm,note

162550000,Station 2,weather,note`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(2);
    });

    it("should handle quoted fields with commas", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,"Station, with comma","tag1,tag2","Note, with commas",1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(1);
      expect(preview.valid[0]?.name).toBe("Station, with comma");
      expect(preview.valid[0]?.notes).toBe("Note, with commas");
    });

    it("should handle quoted fields with newlines", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,Station,fm,"Line 1
Line 2",1700000000000,1700000001000`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(1);
      expect(preview.valid[0]?.notes).toContain("\n");
    });

    it("should round frequency to integer", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000.7,Test Station,test,note`;

      const preview = parseBookmarksCSV(csv, []);

      expect(preview.valid).toHaveLength(1);
      expect(preview.valid[0]?.frequency).toBe(100000001);
    });

    it("should use current time for invalid timestamps", () => {
      const csv = `Frequency (Hz),Name,Tags,Notes,Created At,Last Used
100000000,Test Station,test,note,invalid,invalid`;

      const before = Date.now();
      const preview = parseBookmarksCSV(csv, []);
      const after = Date.now();

      expect(preview.valid).toHaveLength(1);
      expect(preview.valid[0]?.createdAt).toBeGreaterThanOrEqual(before);
      expect(preview.valid[0]?.createdAt).toBeLessThanOrEqual(after);
      expect(preview.valid[0]?.lastUsed).toBeGreaterThanOrEqual(before);
      expect(preview.valid[0]?.lastUsed).toBeLessThanOrEqual(after);
    });
  });

  describe("mergeBookmarks", () => {
    const existingBookmarks: Bookmark[] = [
      {
        id: "existing-1",
        frequency: 100000000,
        name: "Existing Station 1",
        tags: ["existing"],
        notes: "Note 1",
        createdAt: 1600000000000,
        lastUsed: 1600000001000,
      },
      {
        id: "existing-2",
        frequency: 162550000,
        name: "Existing Station 2",
        tags: ["weather"],
        notes: "Note 2",
        createdAt: 1600000002000,
        lastUsed: 1600000003000,
      },
    ];

    const validBookmark: Bookmark = {
      id: "new-1",
      frequency: 146520000,
      name: "New Station",
      tags: ["new"],
      notes: "New note",
      createdAt: 1700000000000,
      lastUsed: 1700000001000,
    };

    const duplicateBookmark: Bookmark = {
      id: "dup-1",
      frequency: 100000500,
      name: "Duplicate Station",
      tags: ["duplicate"],
      notes: "Duplicate note",
      createdAt: 1700000000000,
      lastUsed: 1700000001000,
    };

    it("should skip duplicates when strategy is 'skip'", () => {
      const preview = {
        valid: [validBookmark],
        duplicates: [
          {
            imported: duplicateBookmark,
            existing: existingBookmarks[0]!,
          },
        ],
        errors: [],
      };

      const result = mergeBookmarks(existingBookmarks, preview, "skip");

      expect(result).toHaveLength(3);
      expect(result.find((b) => b.id === "existing-1")).toBeDefined();
      expect(result.find((b) => b.id === "existing-2")).toBeDefined();
      expect(result.find((b) => b.id === "new-1")).toBeDefined();
      expect(result.find((b) => b.id === "dup-1")).toBeUndefined();
    });

    it("should overwrite duplicates when strategy is 'overwrite'", () => {
      const preview = {
        valid: [validBookmark],
        duplicates: [
          {
            imported: duplicateBookmark,
            existing: existingBookmarks[0]!,
          },
        ],
        errors: [],
      };

      const result = mergeBookmarks(existingBookmarks, preview, "overwrite");

      expect(result).toHaveLength(3);
      expect(result.find((b) => b.id === "existing-1")).toBeUndefined();
      expect(result.find((b) => b.id === "existing-2")).toBeDefined();
      expect(result.find((b) => b.id === "new-1")).toBeDefined();
      expect(result.find((b) => b.id === "dup-1")).toBeDefined();
    });

    it("should import duplicates as new when strategy is 'import_as_new'", () => {
      const preview = {
        valid: [validBookmark],
        duplicates: [
          {
            imported: duplicateBookmark,
            existing: existingBookmarks[0]!,
          },
        ],
        errors: [],
      };

      const result = mergeBookmarks(
        existingBookmarks,
        preview,
        "import_as_new",
      );

      expect(result).toHaveLength(4);
      expect(result.find((b) => b.id === "existing-1")).toBeDefined();
      expect(result.find((b) => b.id === "existing-2")).toBeDefined();
      expect(result.find((b) => b.id === "new-1")).toBeDefined();

      const importedDup = result.find(
        (b) =>
          b.frequency === duplicateBookmark.frequency &&
          b.name === duplicateBookmark.name,
      );
      expect(importedDup).toBeDefined();
      expect(importedDup?.id).not.toBe("dup-1"); // Should have new ID
    });

    it("should handle empty preview", () => {
      const preview = {
        valid: [],
        duplicates: [],
        errors: [],
      };

      const result = mergeBookmarks(existingBookmarks, preview, "skip");

      expect(result).toEqual(existingBookmarks);
    });

    it("should handle multiple duplicates with overwrite strategy", () => {
      const preview = {
        valid: [],
        duplicates: [
          {
            imported: duplicateBookmark,
            existing: existingBookmarks[0]!,
          },
          {
            imported: { ...validBookmark, frequency: 162550500 },
            existing: existingBookmarks[1]!,
          },
        ],
        errors: [],
      };

      const result = mergeBookmarks(existingBookmarks, preview, "overwrite");

      expect(result).toHaveLength(2);
      expect(result.find((b) => b.id === "existing-1")).toBeUndefined();
      expect(result.find((b) => b.id === "existing-2")).toBeUndefined();
      expect(
        result.find((b) => b.frequency === duplicateBookmark.frequency),
      ).toBeDefined();
    });
  });
});
