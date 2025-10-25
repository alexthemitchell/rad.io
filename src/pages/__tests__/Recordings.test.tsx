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
      screen.getByRole("heading", { name: /recordings/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows recordings list section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/recordings list/i)).toBeInTheDocument();
  });

  it("shows playback section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/recording playback/i)).toBeInTheDocument();
  });

  it("shows list controls section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(
      screen.getByLabelText(/recording list controls/i),
    ).toBeInTheDocument();
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
