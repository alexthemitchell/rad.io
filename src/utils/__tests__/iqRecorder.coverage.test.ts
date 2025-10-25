/**
 * Coverage tests for iqRecorder branches (download + load from File)
 */

import {
  exportToBinary,
  exportToJSON,
  downloadRecording,
  loadRecordingFromFile,
  type IQRecording,
} from "../iqRecorder";

// Helpers to mock DOM APIs used by downloadRecording
function setupDomDownloadMocks() {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalCreateElement = document.createElement;
  const originalAppend = document.body.appendChild;
  const originalRemove = document.body.removeChild;

  const clickMock = jest.fn();

  // @ts-ignore
  URL.createObjectURL = jest.fn(() => "blob:mock");
  // @ts-ignore
  URL.revokeObjectURL = jest.fn();

  document.createElement = jest.fn((tagName: string) => {
    if (tagName.toLowerCase() === "a") {
      return {
        href: "",
        download: "",
        click: clickMock,
      } as unknown as HTMLAnchorElement;
    }
    return originalCreateElement.call(document, tagName);
  }) as unknown as typeof document.createElement;

  document.body.appendChild = jest.fn((el: Node) => el) as any;
  document.body.removeChild = jest.fn((el: Node) => el) as any;

  return {
    clickMock,
    restore() {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement as any;
      document.body.appendChild = originalAppend as any;
      document.body.removeChild = originalRemove as any;
    },
  };
}

function makeRecording(sampleCount = 3): IQRecording {
  const samples = Array.from({ length: sampleCount }, (_, i) => ({
    I: Math.sin(i / 10),
    Q: Math.cos(i / 10),
  }));
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      frequency: 100e6,
      sampleRate: 2048000,
      sampleCount,
      duration: sampleCount / 2048000,
      signalType: "FM",
      deviceName: "MockDevice",
    },
    samples,
  } as IQRecording;
}

describe("iqRecorder additional branches", () => {
  it("downloadRecording triggers anchor click for binary and json", () => {
    const { clickMock, restore } = setupDomDownloadMocks();

    const rec = makeRecording(2);
    // binary default
    downloadRecording(rec, "test");
    // json branch
    downloadRecording(rec, "testjson", "json");

    expect(clickMock).toHaveBeenCalledTimes(2);

    restore();
  });

  it("loadRecordingFromFile handles .json and .iq", async () => {
    const rec = makeRecording(4);

    // JSON file path
    const jsonData = exportToJSON(rec);
    const jsonFile = new File([jsonData], "rec.json", {
      type: "application/json",
    });
    
    // Mock arrayBuffer for File (JSDOM doesn't provide it)
    jsonFile.arrayBuffer = async () => {
      const encoder = new TextEncoder();
      return encoder.encode(jsonData).buffer;
    };

    const loadedJson = await loadRecordingFromFile(jsonFile);
    expect(loadedJson.metadata.sampleCount).toBe(rec.metadata.sampleCount);

    // Binary file path
    const binData = exportToBinary(rec);
    const binFile = new File([binData], "rec.iq", {
      type: "application/octet-stream",
    });
    
    // Mock arrayBuffer for File (JSDOM doesn't provide it)
    binFile.arrayBuffer = async () => {
      return binData;
    };

    const loadedBin = await loadRecordingFromFile(binFile);
    expect(loadedBin.samples.length).toBe(rec.samples.length);
  });
});
