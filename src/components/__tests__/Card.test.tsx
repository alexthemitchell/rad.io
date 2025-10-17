import { render, screen, fireEvent } from "@testing-library/react";
import Card from "../Card";

describe("Card", () => {
  it("renders title and subtitle", () => {
    render(
      <Card title="Test Card" subtitle="Test Subtitle">
        <div>Content</div>
      </Card>,
    );

    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Test Subtitle")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders without subtitle", () => {
    render(
      <Card title="Test Card">
        <div>Content</div>
      </Card>,
    );

    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders non-collapsible card by default", () => {
    render(
      <Card title="Test Card">
        <div>Content</div>
      </Card>,
    );

    const header = screen.getByText("Test Card").closest(".card-header");
    expect(header).not.toHaveAttribute("role", "button");
    expect(header).not.toHaveAttribute("aria-expanded");
  });

  it("renders collapsible card with expand/collapse functionality", () => {
    render(
      <Card title="Test Card" collapsible={true}>
        <div>Content</div>
      </Card>,
    );

    const header = screen.getByText("Test Card").closest(".card-header");
    expect(header).toHaveAttribute("role", "button");
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("toggles content visibility when clicking header", () => {
    render(
      <Card title="Test Card" collapsible={true}>
        <div>Content</div>
      </Card>,
    );

    const header = screen.getByText("Test Card").closest(".card-header");

    // Initially expanded
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "true");

    // Click to collapse
    if (header) {
      fireEvent.click(header);
    }
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("▶")).toBeInTheDocument();

    // Click to expand
    if (header) {
      fireEvent.click(header);
    }
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("toggles content visibility with keyboard (Enter)", () => {
    render(
      <Card title="Test Card" collapsible={true}>
        <div>Content</div>
      </Card>,
    );

    const header = screen.getByText("Test Card").closest(".card-header");

    // Initially expanded
    expect(screen.getByText("Content")).toBeInTheDocument();

    // Press Enter to collapse
    if (header) {
      fireEvent.keyDown(header, { key: "Enter" });
    }
    expect(screen.queryByText("Content")).not.toBeInTheDocument();

    // Press Enter to expand
    if (header) {
      fireEvent.keyDown(header, { key: "Enter" });
    }
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("toggles content visibility with keyboard (Space)", () => {
    render(
      <Card title="Test Card" collapsible={true}>
        <div>Content</div>
      </Card>,
    );

    const header = screen.getByText("Test Card").closest(".card-header");

    // Initially expanded
    expect(screen.getByText("Content")).toBeInTheDocument();

    // Press Space to collapse
    if (header) {
      fireEvent.keyDown(header, { key: " " });
    }
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("respects defaultExpanded prop", () => {
    render(
      <Card title="Test Card" collapsible={true} defaultExpanded={false}>
        <div>Content</div>
      </Card>,
    );

    const header = screen.getByText("Test Card").closest(".card-header");
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
    expect(screen.getByText("▶")).toBeInTheDocument();
  });

  it("does not render content when collapsed (performance optimization)", () => {
    const { container } = render(
      <Card title="Test Card" collapsible={true} defaultExpanded={false}>
        <div data-testid="expensive-component">Expensive Content</div>
      </Card>,
    );

    // Content should not be in the DOM at all when collapsed
    expect(screen.queryByTestId("expensive-component")).not.toBeInTheDocument();
    expect(container.querySelector(".card-content")).not.toBeInTheDocument();
  });

  it("renders content when expanded", () => {
    const { container } = render(
      <Card title="Test Card" collapsible={true} defaultExpanded={true}>
        <div data-testid="expensive-component">Expensive Content</div>
      </Card>,
    );

    // Content should be in the DOM when expanded
    expect(screen.getByTestId("expensive-component")).toBeInTheDocument();
    expect(container.querySelector(".card-content")).toBeInTheDocument();
  });
});
