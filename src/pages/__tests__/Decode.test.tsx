import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Decode from "../Decode";

describe("Decode", () => {
  it("renders the decode page", () => {
    render(
      <BrowserRouter>
        <Decode />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Decode />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /decode/i }),
    ).toBeInTheDocument();
  });

  it("shows mode selection section", () => {
    render(
      <BrowserRouter>
        <Decode />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/mode selection/i)).toBeInTheDocument();
  });

  it("shows decoded output section", () => {
    render(
      <BrowserRouter>
        <Decode />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/decoded output/i)).toBeInTheDocument();
  });

  it("shows decoder controls section", () => {
    render(
      <BrowserRouter>
        <Decode />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/decoder controls/i)).toBeInTheDocument();
  });
});
