import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Settings from "../Settings";

describe("Settings", () => {
  it("renders the settings page", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /^settings$/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows all tab buttons", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    expect(screen.getByRole("tab", { name: /display/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /radio/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /audio/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /calibration/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
  });

  it("displays display tab by default", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /display settings/i }),
    ).toBeInTheDocument();
  });

  it("switches to radio tab when clicked", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    const radioTab = screen.getByRole("tab", { name: /radio/i });
    fireEvent.click(radioTab);
    expect(
      screen.getByRole("heading", { name: /radio settings/i }),
    ).toBeInTheDocument();
  });

  it("switches to audio tab when clicked", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    const audioTab = screen.getByRole("tab", { name: /audio/i });
    fireEvent.click(audioTab);
    expect(
      screen.getByRole("heading", { name: /audio settings/i }),
    ).toBeInTheDocument();
  });

  it("switches to calibration tab when clicked", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    const calibrationTab = screen.getByRole("tab", { name: /calibration/i });
    fireEvent.click(calibrationTab);
    expect(
      screen.getByRole("heading", { name: /calibration/i }),
    ).toBeInTheDocument();
  });

  it("shows link to calibration wizard in calibration tab", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    const calibrationTab = screen.getByRole("tab", { name: /calibration/i });
    fireEvent.click(calibrationTab);
    expect(
      screen.getByRole("link", { name: /open calibration wizard/i }),
    ).toBeInTheDocument();
  });

  it("switches to advanced tab when clicked", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    const advancedTab = screen.getByRole("tab", { name: /advanced/i });
    fireEvent.click(advancedTab);
    expect(
      screen.getByRole("heading", { name: /advanced settings/i }),
    ).toBeInTheDocument();
  });

  it("marks active tab with aria-selected", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    const displayTab = screen.getByRole("tab", { name: /display/i });
    expect(displayTab).toHaveAttribute("aria-selected", "true");

    const radioTab = screen.getByRole("tab", { name: /radio/i });
    expect(radioTab).toHaveAttribute("aria-selected", "false");
  });

  it("disables Save/Reset actions with aria-disabled", () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>,
    );
    const save = screen.getByRole("button", { name: /save settings/i });
    const reset = screen.getByRole("button", { name: /reset to defaults/i });
    expect(save).toBeDisabled();
    expect(reset).toBeDisabled();
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(reset).toHaveAttribute("aria-disabled", "true");
  });
});
