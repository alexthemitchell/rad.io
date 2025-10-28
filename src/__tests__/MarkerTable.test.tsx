import { render, screen, fireEvent } from "@testing-library/react";
import MarkerTable, { type MarkerRow } from "../components/MarkerTable";

describe("MarkerTable", () => {
  const markers: MarkerRow[] = [
    { id: "a", freqHz: 100_000_000 },
    { id: "b", freqHz: 162_550_000 },
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
});
