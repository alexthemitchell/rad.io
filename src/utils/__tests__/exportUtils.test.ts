import {
  exportStageDataAsCSV,
  exportStageDataAsJSON,
  copyToClipboard,
  savePNGFromCanvas,
} from "../exportUtils";

describe("exportUtils", () => {
  describe("exportStageDataAsCSV", () => {
    it("should export data with consistent columns as CSV", () => {
      const data = [
        { name: "Alice", age: 30, city: "NYC" },
        { name: "Bob", age: 25, city: "LA" },
      ];
      const csv = exportStageDataAsCSV("test-stage", data);

      expect(csv).toBe("name,age,city\nAlice,30,NYC\nBob,25,LA");
    });

    it("should handle single row data", () => {
      const data = [{ value: 42, label: "test" }];
      const csv = exportStageDataAsCSV("test-stage", data);

      expect(csv).toBe("value,label\n42,test");
    });

    it("should handle values with commas as strings", () => {
      const data = [{ name: "Smith, John", value: 100 }];
      const csv = exportStageDataAsCSV("test-stage", data);

      expect(csv).toBe("name,value\nSmith, John,100");
    });

    it("should return empty string for empty array", () => {
      const csv = exportStageDataAsCSV("test-stage", []);

      expect(csv).toBe("");
    });

    it("should handle numeric and boolean values", () => {
      const data = [
        { id: 1, active: true, score: 95.5 },
        { id: 2, active: false, score: 87.3 },
      ];
      const csv = exportStageDataAsCSV("test-stage", data);

      expect(csv).toBe("id,active,score\n1,true,95.5\n2,false,87.3");
    });

    it("should convert undefined and null to strings", () => {
      const data = [{ a: null, b: undefined, c: "value" }];
      const csv = exportStageDataAsCSV("test-stage", data);

      expect(csv).toBe("a,b,c\nnull,undefined,value");
    });
  });

  describe("exportStageDataAsJSON", () => {
    it("should export data as formatted JSON with stageId", () => {
      const data = [{ x: 1 }, { x: 2 }];
      const json = exportStageDataAsJSON("my-stage", data);

      const parsed = JSON.parse(json);
      expect(parsed).toEqual({
        stageId: "my-stage",
        data: [{ x: 1 }, { x: 2 }],
      });
    });

    it("should format JSON with 2-space indentation", () => {
      const data = [{ nested: { value: 42 } }];
      const json = exportStageDataAsJSON("test", data);

      expect(json).toContain('  "stageId"');
      expect(json).toContain('  "data"');
      expect(json).toContain("    {");
    });

    it("should handle empty array", () => {
      const json = exportStageDataAsJSON("empty-stage", []);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual({ stageId: "empty-stage", data: [] });
    });

    it("should handle complex nested data", () => {
      const data = [{ id: 1, metadata: { tags: ["a", "b"], count: 5 } }];
      const json = exportStageDataAsJSON("complex", data);
      const parsed = JSON.parse(json);

      expect(parsed.stageId).toBe("complex");
      expect(parsed.data[0].metadata.tags).toEqual(["a", "b"]);
    });
  });

  describe("copyToClipboard", () => {
    beforeEach(() => {
      // Mock navigator.clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn(),
        },
      });
    });

    it("should use navigator.clipboard.writeText when available", async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      copyToClipboard("test text");

      // Wait for promise to settle
      await Promise.resolve();

      expect(mockWriteText).toHaveBeenCalledWith("test text");
    });

    it("should fallback to execCommand when clipboard API fails", async () => {
      const mockWriteText = jest.fn().mockRejectedValue(new Error("Failed"));
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      const mockExecCommand = jest.fn().mockReturnValue(true);
      document.execCommand = mockExecCommand;

      const mockTextarea = document.createElement("textarea");
      const mockAppendChild = jest.spyOn(document.body, "appendChild");
      const mockRemoveChild = jest.spyOn(document.body, "removeChild");
      const mockCreateElement = jest.spyOn(document, "createElement");
      mockCreateElement.mockReturnValue(mockTextarea);

      copyToClipboard("fallback text");

      // Wait for promise rejection to trigger fallback
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockWriteText).toHaveBeenCalledWith("fallback text");
      expect(mockAppendChild).toHaveBeenCalledWith(mockTextarea);
      expect(mockTextarea.value).toBe("fallback text");
      expect(mockRemoveChild).toHaveBeenCalledWith(mockTextarea);

      mockCreateElement.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });

  describe("savePNGFromCanvas", () => {
    let mockCanvas: HTMLCanvasElement;
    let mockAnchor: HTMLAnchorElement;

    beforeEach(() => {
      // Mock canvas
      mockCanvas = {
        toDataURL: jest.fn().mockReturnValue("data:image/png;base64,mock"),
      } as unknown as HTMLCanvasElement;

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

    it("should create PNG data URL and trigger download", () => {
      savePNGFromCanvas(mockCanvas, "test.png");

      expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/png");
      expect(mockAnchor.href).toBe("data:image/png;base64,mock");
      expect(mockAnchor.download).toBe("test.png");
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    });

    it("should use default filename when not provided", () => {
      savePNGFromCanvas(mockCanvas);

      expect(mockAnchor.download).toBe("stage.png");
    });

    it("should handle custom filename", () => {
      savePNGFromCanvas(mockCanvas, "custom-export.png");

      expect(mockAnchor.download).toBe("custom-export.png");
    });
  });
});
