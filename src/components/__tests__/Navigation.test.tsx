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

    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("Scanner")).toBeInTheDocument();
    expect(screen.getByText("Decode")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Recordings")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("has correct href attributes", () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>,
    );

    const monitorLink = screen.getByText("Monitor").closest("a");
    const scannerLink = screen.getByText("Scanner").closest("a");
    const decodeLink = screen.getByText("Decode").closest("a");
    const analysisLink = screen.getByText("Analysis").closest("a");
    const recordingsLink = screen.getByText("Recordings").closest("a");
    const helpLink = screen.getByText("Help").closest("a");

    expect(monitorLink).toHaveAttribute("href", "/monitor");
    expect(scannerLink).toHaveAttribute("href", "/scanner");
    expect(decodeLink).toHaveAttribute("href", "/decode");
    expect(analysisLink).toHaveAttribute("href", "/analysis");
    expect(recordingsLink).toHaveAttribute("href", "/recordings");
    expect(helpLink).toHaveAttribute("href", "/help");
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
      <MemoryRouter initialEntries={["/monitor"]}>
        <Navigation />
      </MemoryRouter>,
    );

    const monitorLink = screen.getByText("Monitor").closest("a");
    expect(monitorLink).toHaveClass("active");
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

    const monitorLink = screen.getByText("Monitor").closest("a");
    const scannerLink = screen.getByText("Scanner").closest("a");
    const analysisLink = screen.getByText("Analysis").closest("a");

    expect(monitorLink).toHaveAttribute(
      "title",
      "Live signal monitoring and audio playback - Start here for general SDR use (Keyboard: 1)",
    );
    expect(scannerLink).toHaveAttribute(
      "title",
      "Scan for ATSC channels, FM/AM stations, and talkgroups - Essential for finding signals (Keyboard: 2)",
    );
    expect(analysisLink).toHaveAttribute(
      "title",
      "Deep signal analysis and DSP pipeline - Advanced feature (Keyboard: 4)",
    );
  });

  it("applies nav-link class to all links", () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>,
    );

    const monitorLink = screen.getByText("Monitor").closest("a");
    const scannerLink = screen.getByText("Scanner").closest("a");
    const analysisLink = screen.getByText("Analysis").closest("a");

    expect(monitorLink).toHaveClass("nav-link");
    expect(scannerLink).toHaveClass("nav-link");
    expect(analysisLink).toHaveClass("nav-link");
  });
});
