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
      screen.getByRole("heading", { name: /device calibration/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows introduction section", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/introduction/i)).toBeInTheDocument();
  });

  it("shows device selection section", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /step 1: select device/i }),
    ).toBeInTheDocument();
  });

  it("shows calibration type section", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /step 2: calibration type/i }),
    ).toBeInTheDocument();
  });

  it("shows calibration procedure section", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /step 3: calibration procedure/i }),
    ).toBeInTheDocument();
  });

  it("shows validation section", () => {
    render(
      <BrowserRouter>
        <Calibration />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /step 4: validation/i }),
    ).toBeInTheDocument();
  });
});
