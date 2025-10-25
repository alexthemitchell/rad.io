import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Monitor from "../Monitor";

describe("Monitor", () => {
  it("renders the monitor page", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /monitor/i }),
    ).toBeInTheDocument();
  });

  it("shows spectrum section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(
      screen.getByLabelText(/spectrum visualization/i),
    ).toBeInTheDocument();
  });

  it("shows audio controls section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/audio controls/i)).toBeInTheDocument();
  });

  it("shows signal info section", () => {
    render(
      <BrowserRouter>
        <Monitor />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/signal information/i)).toBeInTheDocument();
  });
});
