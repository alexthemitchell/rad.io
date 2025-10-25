import { render, screen } from "@testing-library/react";
import Measurements from "../Measurements";

describe("Measurements", () => {
  it("renders as panel when isPanel is true", () => {
    render(<Measurements isPanel={true} />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("renders as main page when isPanel is false", () => {
    render(<Measurements isPanel={false} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(<Measurements />);
    expect(
      screen.getByRole("heading", { name: /measurements/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows signal strength section", () => {
    render(<Measurements />);
    expect(screen.getByLabelText(/signal strength/i)).toBeInTheDocument();
  });

  it("shows bandwidth section", () => {
    render(<Measurements />);
    expect(screen.getByLabelText(/bandwidth/i)).toBeInTheDocument();
  });

  it("shows SNR section", () => {
    render(<Measurements />);
    expect(screen.getByLabelText(/signal-to-noise ratio/i)).toBeInTheDocument();
  });

  it("shows frequency accuracy section", () => {
    render(<Measurements />);
    expect(screen.getByLabelText(/frequency accuracy/i)).toBeInTheDocument();
  });

  it("shows modulation type section", () => {
    render(<Measurements />);
    expect(screen.getByLabelText(/modulation type/i)).toBeInTheDocument();
  });
});
