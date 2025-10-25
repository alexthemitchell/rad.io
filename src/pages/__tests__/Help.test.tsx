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

  it("shows quick start section", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/quick start guide/i)).toBeInTheDocument();
  });

  it("shows keyboard shortcuts section", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it("shows features overview section", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/features overview/i)).toBeInTheDocument();
  });

  it("shows troubleshooting section", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/troubleshooting/i)).toBeInTheDocument();
  });

  it("shows technical resources section", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/technical resources/i)).toBeInTheDocument();
  });

  it("shows community section", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/community/i)).toBeInTheDocument();
  });

  it("contains external GitHub link", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    const githubLinks = screen.getAllByRole("link", { name: /github/i });
    expect(githubLinks.length).toBeGreaterThan(0);
  });

  it("lists keyboard shortcuts", () => {
    render(
      <BrowserRouter>
        <Help />
      </BrowserRouter>,
    );
    expect(screen.getByText(/1-5/i)).toBeInTheDocument();
    expect(screen.getByText(/\?/)).toBeInTheDocument();
  });
});
