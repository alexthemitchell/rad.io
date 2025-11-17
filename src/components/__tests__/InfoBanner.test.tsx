/**
 * Tests for InfoBanner component
 */

import { render, screen } from "@testing-library/react";
import { InfoBanner } from "../InfoBanner";

describe("InfoBanner", () => {
  it("renders with info variant by default", () => {
    render(
      <InfoBanner title="Test Title">
        <p>Test content</p>
      </InfoBanner>,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders with advanced variant", () => {
    render(
      <InfoBanner variant="advanced" title="Advanced Title">
        <p>Advanced content</p>
      </InfoBanner>,
    );

    expect(screen.getByText("Advanced Title")).toBeInTheDocument();
    expect(screen.getByText("Advanced content")).toBeInTheDocument();
  });

  it("renders without title", () => {
    render(
      <InfoBanner>
        <p>Content without title</p>
      </InfoBanner>,
    );

    expect(screen.getByText("Content without title")).toBeInTheDocument();
  });

  it("uses role=status with aria-live=polite by default", () => {
    const { container } = render(
      <InfoBanner>
        <p>Status content</p>
      </InfoBanner>,
    );

    const banner = container.querySelector('[role="status"]');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("uses role=note when specified", () => {
    const { container } = render(
      <InfoBanner role="note">
        <p>Note content</p>
      </InfoBanner>,
    );

    const banner = container.querySelector('[role="note"]');
    expect(banner).toBeInTheDocument();
    expect(banner).not.toHaveAttribute("aria-live");
  });

  it("uses aria-live=assertive when specified with role=status", () => {
    const { container } = render(
      <InfoBanner role="status" ariaLive="assertive">
        <p>Assertive content</p>
      </InfoBanner>,
    );

    const banner = container.querySelector('[role="status"]');
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });

  it("applies custom className", () => {
    const { container } = render(
      <InfoBanner className="custom-class">
        <p>Custom class content</p>
      </InfoBanner>,
    );

    const banner = container.querySelector(".custom-class");
    expect(banner).toBeInTheDocument();
  });

  it("applies custom styles", () => {
    const { container } = render(
      <InfoBanner style={{ marginTop: "20px" }}>
        <p>Custom style content</p>
      </InfoBanner>,
    );

    const banner = container.querySelector(".info-banner");
    expect(banner).toHaveStyle({ marginTop: "20px" });
  });

  it("applies variant-specific CSS classes", () => {
    const { container: infoContainer } = render(
      <InfoBanner variant="info">
        <p>Info content</p>
      </InfoBanner>,
    );

    const { container: advancedContainer } = render(
      <InfoBanner variant="advanced">
        <p>Advanced content</p>
      </InfoBanner>,
    );

    expect(
      infoContainer.querySelector(".info-banner--info"),
    ).toBeInTheDocument();
    expect(
      advancedContainer.querySelector(".info-banner--advanced"),
    ).toBeInTheDocument();
  });
});
