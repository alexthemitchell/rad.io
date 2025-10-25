import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Calibration from "../Calibration";

describe("Calibration", () => {
  it("renders the calibration page", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /calibration wizard/i }),
    ).toBeInTheDocument();
  });

  it("shows wizard step indicator", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/calibration steps/i)).toBeInTheDocument();
  });

  it("shows step 1 by default", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /frequency reference/i }),
    ).toBeInTheDocument();
  });

  it("shows all navigation buttons", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("button", { name: /previous/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("disables previous button on first step", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });
});
