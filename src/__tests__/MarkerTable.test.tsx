import { render, screen, fireEvent } from "@testing-library/react";
import MarkerTable, { type MarkerRow } from "../components/MarkerTable";

describe("MarkerTable", () => {
  const markers: MarkerRow[] = [
    { id: "a", freqHz: 100_000_000, powerDb: -50.5 },
    { id: "b", freqHz: 162_550_000, powerDb: -45.2 },
  ];

  it("renders rows and supports remove and tune actions", () => {
    const onRemove = jest.fn();
    const onTune = jest.fn();

    render(
      <MarkerTable markers={markers} onRemove={onRemove} onTune={onTune} />,
    );

    // Renders header
    expect(screen.getByText(/Markers/i)).toBeInTheDocument();

    // Renders formatted frequencies
    expect(screen.getByText("100.000000")).toBeInTheDocument();
    expect(screen.getByText("162.550000")).toBeInTheDocument();

    // Tune button works
    const tuneBtn = screen.getByRole("button", {
      name: "Tune to 100.000000 megahertz",
    });
    fireEvent.click(tuneBtn);
    expect(onTune).toHaveBeenCalledWith(100_000_000);

    // Remove button works
    const removeBtn = screen.getByRole("button", { name: "Remove marker 1" });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("renders nothing for empty list", () => {
    const { container } = render(<MarkerTable markers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("displays power levels and deltas correctly", () => {
    render(<MarkerTable markers={markers} />);

    // Check power levels are displayed
    expect(screen.getByText("-50.50")).toBeInTheDocument();
    expect(screen.getByText("-45.20")).toBeInTheDocument();

    // Check delta frequency is displayed for second marker
    expect(screen.getByText("62550000")).toBeInTheDocument(); // 162550000 - 100000000

    // Check delta power is displayed for second marker with directional indicator
    expect(screen.getByText("↑ +5.30")).toBeInTheDocument(); // -45.2 - (-50.5)
  });

  describe("CSV export", () => {
    const testMarkers: MarkerRow[] = [
      { id: "a", freqHz: 100_000_000, powerDb: -50.5 },
      { id: "b", freqHz: 162_550_000, powerDb: -45.2 },
    ];

    let createElementSpy: jest.SpyInstance;
    let mockAppendChild: jest.SpyInstance;
    let mockRemoveChild: jest.SpyInstance;
    const mockClick = jest.fn();

    afterEach(() => {
      if (mockAppendChild) mockAppendChild.mockRestore();
      if (mockRemoveChild) mockRemoveChild.mockRestore();
      if (createElementSpy) createElementSpy.mockRestore();
      mockClick.mockClear();
    });

    it("exports CSV with power and delta data", () => {
      render(<MarkerTable markers={testMarkers} />);

      // Set up mocks after render
      global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
      global.URL.revokeObjectURL = jest.fn();

      mockAppendChild = jest
        .spyOn(document.body, "appendChild")
        .mockImplementation((el) => el as HTMLAnchorElement);
      mockRemoveChild = jest
        .spyOn(document.body, "removeChild")
        .mockImplementation((el) => el as HTMLAnchorElement);

      const originalCreateElement = document.createElement.bind(document);
      createElementSpy = jest
        .spyOn(document, "createElement")
        .mockImplementation((tag: string) => {
          const element = originalCreateElement(tag);
          if (tag === "a") {
            element.click = mockClick;
          }
          return element;
        });

      const exportBtn = screen.getByRole("button", {
        name: /Export markers as CSV/i,
      });
      fireEvent.click(exportBtn);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  it("handles missing power data gracefully", () => {
    const markersWithoutPower: MarkerRow[] = [
      { id: "a", freqHz: 100_000_000 },
      { id: "b", freqHz: 162_550_000 },
    ];

    render(<MarkerTable markers={markersWithoutPower} />);

    // Check em-dashes are displayed for missing power data
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });
});
