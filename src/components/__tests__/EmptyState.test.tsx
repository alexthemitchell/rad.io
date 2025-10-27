import { render, screen } from "@testing-library/react";
import EmptyState from "../EmptyState";

describe("EmptyState", () => {
  it("should render title and message", () => {
    render(<EmptyState title="No Data" message="Please wait..." />);

    expect(screen.getByText("No Data")).toBeInTheDocument();
    expect(screen.getByText("Please wait...")).toBeInTheDocument();
  });

  it("should use default width and height", () => {
    const { container } = render(
      <EmptyState title="Test" message="Test message" />,
    );

    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({
      width: "100%",
      height: "400px",
    });
  });

  it("should accept numeric width", () => {
    const { container } = render(
      <EmptyState title="Test" message="Test message" width={600} />,
    );

    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({
      width: "600px",
    });
  });

  it("should accept string width", () => {
    const { container } = render(
      <EmptyState title="Test" message="Test message" width="80%" />,
    );

    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({
      width: "80%",
    });
  });

  it("should accept numeric height", () => {
    const { container } = render(
      <EmptyState title="Test" message="Test message" height={500} />,
    );

    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({
      height: "500px",
    });
  });

  it("should accept string height", () => {
    const { container } = render(
      <EmptyState title="Test" message="Test message" height="50vh" />,
    );

    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({
      height: "50vh",
    });
  });

  it("should have correct styling", () => {
    const { container } = render(
      <EmptyState title="Test" message="Test message" />,
    );

    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#1a1d23",
      color: "#a0aab5",
      textAlign: "center",
    });
  });

  it("should render with custom dimensions", () => {
    const { container } = render(
      <EmptyState
        title="Custom Size"
        message="Custom message"
        width={800}
        height={300}
      />,
    );

    const div = container.firstChild as HTMLElement;
    expect(div).toHaveStyle({
      width: "800px",
      height: "300px",
    });
  });

  it("should handle long title and message", () => {
    const longTitle =
      "This is a very long title that might wrap to multiple lines";
    const longMessage =
      "This is a very long message with lots of text that might also wrap to multiple lines in the display area";

    render(<EmptyState title={longTitle} message={longMessage} />);

    expect(screen.getByText(longTitle)).toBeInTheDocument();
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it("should handle special characters in title and message", () => {
    const title = "Special & Characters <>";
    const message = "Message with 'quotes' and \"double quotes\"";

    render(<EmptyState title={title} message={message} />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
