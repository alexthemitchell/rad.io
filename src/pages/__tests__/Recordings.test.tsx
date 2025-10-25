import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Recordings from "../Recordings";

describe("Recordings", () => {
  it("renders the recordings page", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /recordings/i }),
    ).toBeInTheDocument();
  });

  it("shows recording library section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/recording library/i)).toBeInTheDocument();
  });

  it("shows playback controls section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/playback controls/i)).toBeInTheDocument();
  });

  it("shows recording info section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/recording information/i)).toBeInTheDocument();
  });

  it("shows storage info section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/storage information/i)).toBeInTheDocument();
  });
});
