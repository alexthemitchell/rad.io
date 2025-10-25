import { render, screen } from "@testing-library/react";
import Diagnostics from "../Diagnostics";

describe("Diagnostics", () => {
  it("renders as panel when isPanel is true", () => {
    render(<Diagnostics isPanel={true} />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("renders as main page when isPanel is false", () => {
    render(<Diagnostics isPanel={false} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(<Diagnostics />);
    expect(
      screen.getByRole("heading", { name: /diagnostics/i }),
    ).toBeInTheDocument();
  });

  it("shows system status section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/system status/i)).toBeInTheDocument();
  });

  it("shows device information section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/device information/i)).toBeInTheDocument();
  });

  it("shows performance metrics section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/performance metrics/i)).toBeInTheDocument();
  });

  it("shows buffer health section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/buffer health/i)).toBeInTheDocument();
  });

  it("shows error log section", () => {
    render(<Diagnostics />);
    expect(screen.getByText(/error log/i)).toBeInTheDocument();
  });
});
