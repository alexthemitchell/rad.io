import { render, screen } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import Navigation from "../Navigation";

describe("Navigation", () => {
  it("renders all navigation links", () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>,
    );

    expect(screen.getByText("Live Monitor")).toBeInTheDocument();
    expect(screen.getByText("Scanner")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
  });

  it("has correct href attributes", () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>,
    );

    const liveMonitorLink = screen.getByText("Live Monitor").closest("a");
    const scannerLink = screen.getByText("Scanner").closest("a");
    const analysisLink = screen.getByText("Analysis").closest("a");

    expect(liveMonitorLink).toHaveAttribute("href", "/");
    expect(scannerLink).toHaveAttribute("href", "/scanner");
    expect(analysisLink).toHaveAttribute("href", "/analysis");
  });

  it("has proper navigation role", () => {
    const { container } = render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>,
    );

    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute("role", "navigation");
    expect(nav).toHaveAttribute("aria-label", "Main navigation");
  });

  it("highlights active link on home page", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Navigation />
      </MemoryRouter>,
    );

    const liveMonitorLink = screen.getByText("Live Monitor").closest("a");
    expect(liveMonitorLink).toHaveClass("active");
  });

  it("highlights active link on scanner page", () => {
    render(
      <MemoryRouter initialEntries={["/scanner"]}>
        <Navigation />
      </MemoryRouter>,
    );

    const scannerLink = screen.getByText("Scanner").closest("a");
    expect(scannerLink).toHaveClass("active");
  });

  it("highlights active link on analysis page", () => {
    render(
      <MemoryRouter initialEntries={["/analysis"]}>
        <Navigation />
      </MemoryRouter>,
    );

    const analysisLink = screen.getByText("Analysis").closest("a");
    expect(analysisLink).toHaveClass("active");
  });

  it("has tooltips for navigation links", () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>,
    );

    const liveMonitorLink = screen.getByText("Live Monitor").closest("a");
    const scannerLink = screen.getByText("Scanner").closest("a");
    const analysisLink = screen.getByText("Analysis").closest("a");

    expect(liveMonitorLink).toHaveAttribute(
      "title",
      "Live signal monitoring and audio playback",
    );
    expect(scannerLink).toHaveAttribute(
      "title",
      "Scan frequencies and talkgroups",
    );
    expect(analysisLink).toHaveAttribute(
      "title",
      "Deep signal analysis and DSP pipeline",
    );
  });

  it("applies nav-link class to all links", () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>,
    );

    const liveMonitorLink = screen.getByText("Live Monitor").closest("a");
    const scannerLink = screen.getByText("Scanner").closest("a");
    const analysisLink = screen.getByText("Analysis").closest("a");

    expect(liveMonitorLink).toHaveClass("nav-link");
    expect(scannerLink).toHaveClass("nav-link");
    expect(analysisLink).toHaveClass("nav-link");
  });
});
