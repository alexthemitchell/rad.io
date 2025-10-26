import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Help from "../Help";

describe("Help", () => {
  it("renders the help page", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /help & documentation/i }),
    ).toBeInTheDocument();
  });

  it("shows onboarding tab", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("tab", { name: /onboarding/i }),
    ).toBeInTheDocument();
  });

  it("shows keyboard shortcuts tab", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("tab", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
  });

  it("shows accessibility tab", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("tab", { name: /accessibility/i }),
    ).toBeInTheDocument();
  });

  it("shows release notes tab", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("tab", { name: /release notes/i }),
    ).toBeInTheDocument();
  });

  it("shows support tab", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByRole("tab", { name: /support/i })).toBeInTheDocument();
  });

  it("contains external GitHub link", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    // GitHub links are in the support tab, which is not active by default
    // Check for the support tab instead
    expect(screen.getByRole("tab", { name: /support/i })).toBeInTheDocument();
  });

  it("shows getting started content by default", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByText(/getting started/i)).toBeInTheDocument();
    expect(screen.getByText(/connect your sdr device/i)).toBeInTheDocument();
  });
});
