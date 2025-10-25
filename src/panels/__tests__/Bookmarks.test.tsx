import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Bookmarks from "../Bookmarks";

// Mock dependencies
jest.mock("../../hooks/useLiveRegion", () => ({
  useLiveRegion: jest.fn(() => ({
    announce: jest.fn(),
    liveRegion: jest.fn(() => <div />),
  })),
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("Bookmarks", () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it("renders as panel when isPanel is true", () => {
    render(
      <BrowserRouter>
        <Bookmarks isPanel={true} />
      </BrowserRouter>,
    );
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("renders as main page when isPanel is false", () => {
    render(
      <BrowserRouter>
        <Bookmarks isPanel={false} />
      </BrowserRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("displays heading", () => {
    render(
      <BrowserRouter>
        <Bookmarks />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /^bookmarks$/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows search input", () => {
    render(
      <BrowserRouter>
        <Bookmarks />
      </BrowserRouter>,
    );
    expect(
      screen.getByPlaceholderText(/search bookmarks/i),
    ).toBeInTheDocument();
  });

  it("shows add bookmark button", () => {
    render(
      <BrowserRouter>
        <Bookmarks />
      </BrowserRouter>,
    );
    expect(
      screen.getByRole("button", { name: /add bookmark/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no bookmarks", () => {
    render(
      <BrowserRouter>
        <Bookmarks />
      </BrowserRouter>,
    );
    expect(screen.getByText(/no bookmarks yet/i)).toBeInTheDocument();
  });

  it("shows add form when add button is clicked", () => {
    render(
      <BrowserRouter>
        <Bookmarks />
      </BrowserRouter>,
    );
    const addButton = screen.getByRole("button", { name: /add bookmark/i });
    fireEvent.click(addButton);
    expect(screen.getByLabelText(/Frequency \(MHz\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
  });

  it("can cancel add form", () => {
    render(
      <BrowserRouter>
        <Bookmarks />
      </BrowserRouter>,
    );
    const addButton = screen.getByRole("button", { name: /add bookmark/i });
    fireEvent.click(addButton);
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);
    expect(
      screen.queryByLabelText(/Frequency \(MHz\)/i),
    ).not.toBeInTheDocument();
  });

  it("filters bookmarks by search query", async () => {
    // Pre-populate with bookmarks
    const bookmarks = [
      {
        id: "bm-1",
        frequency: 100000000,
        name: "FM Radio",
        tags: ["fm"],
        notes: "",
        createdAt: Date.now(),
        lastUsed: Date.now(),
      },
      {
        id: "bm-2",
        frequency: 162550000,
        name: "NOAA Weather",
        tags: ["weather"],
        notes: "",
        createdAt: Date.now(),
        lastUsed: Date.now(),
      },
    ];
    localStorageMock.setItem("rad.io:bookmarks", JSON.stringify(bookmarks));

    render(
      <BrowserRouter>
        <Bookmarks />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("FM Radio")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search bookmarks/i);
    fireEvent.change(searchInput, { target: { value: "weather" } });

    await waitFor(() => {
      expect(screen.queryByText("FM Radio")).not.toBeInTheDocument();
      expect(screen.getByText("NOAA Weather")).toBeInTheDocument();
    });
  });

  it("displays bookmark count when filtered", async () => {
    const bookmarks = [
      {
        id: "bm-1",
        frequency: 100000000,
        name: "FM Radio",
        tags: [],
        notes: "",
        createdAt: Date.now(),
        lastUsed: Date.now(),
      },
      {
        id: "bm-2",
        frequency: 162550000,
        name: "NOAA Weather",
        tags: [],
        notes: "",
        createdAt: Date.now(),
        lastUsed: Date.now(),
      },
    ];
    localStorageMock.setItem("rad.io:bookmarks", JSON.stringify(bookmarks));

    render(
      <BrowserRouter>
        <Bookmarks />
      </BrowserRouter>,
    );

    const searchInput = screen.getByPlaceholderText(/search bookmarks/i);
    fireEvent.change(searchInput, { target: { value: "weather" } });

    await waitFor(() => {
      expect(screen.getByText(/1 of 2/i)).toBeInTheDocument();
    });
  });
});
