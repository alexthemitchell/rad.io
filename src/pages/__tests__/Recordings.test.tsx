import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Recordings from "../Recordings";

// Mock the useStorageQuota hook
jest.mock("../../hooks/useStorageQuota");

import { useStorageQuota } from "../../hooks/useStorageQuota";

const mockUseStorageQuota = useStorageQuota as jest.MockedFunction<
  typeof useStorageQuota
>;

describe("Recordings", () => {
  beforeEach(() => {
    // Default mock: storage API supported with 50% usage
    mockUseStorageQuota.mockReturnValue({
      usage: 50 * 1024 * 1024 * 1024, // 50 GB
      quota: 100 * 1024 * 1024 * 1024, // 100 GB
      percentUsed: 50,
      available: 50 * 1024 * 1024 * 1024,
      supported: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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
      screen.getByRole("heading", { name: /^recordings library$/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows recordings list section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/^recordings list$/i)).toBeInTheDocument();
  });

  it("shows playback section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/^recording playback$/i)).toBeInTheDocument();
  });

  it("shows list controls section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(
      screen.getByLabelText(/^recording list controls$/i),
    ).toBeInTheDocument();
  });

  it("shows storage info section", () => {
    render(
      <BrowserRouter>
        <Recordings />
      </BrowserRouter>,
    );
    expect(screen.getByLabelText(/^storage information$/i)).toBeInTheDocument();
  });

  describe("Storage Quota Display", () => {
    it("displays storage quota information when supported", () => {
      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      expect(screen.getByText(/used:/i)).toBeInTheDocument();
      expect(screen.getByText(/available:/i)).toBeInTheDocument();
      expect(screen.getByText(/total:/i)).toBeInTheDocument();
      expect(screen.getByText(/50\.0% used/i)).toBeInTheDocument();
    });

    it("displays formatted storage values", () => {
      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      // 50 GB used and available (both show as 50.00 GB)
      const fiftyGbValues = screen.getAllByText(/50\.00 GB/i);
      expect(fiftyGbValues.length).toBe(2); // Used and Available
      expect(screen.getByText(/100\.00 GB/i)).toBeInTheDocument(); // Total
    });

    it("shows progress bar with correct percentage", () => {
      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-valuenow", "50");
      expect(progressBar).toHaveAttribute("aria-valuemin", "0");
      expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    });

    it("does not show warning when storage is below 85%", () => {
      mockUseStorageQuota.mockReturnValue({
        usage: 80 * 1024 * 1024 * 1024,
        quota: 100 * 1024 * 1024 * 1024,
        percentUsed: 80,
        available: 20 * 1024 * 1024 * 1024,
        supported: true,
      });

      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows warning when storage is above 85%", () => {
      mockUseStorageQuota.mockReturnValue({
        usage: 90 * 1024 * 1024 * 1024,
        quota: 100 * 1024 * 1024 * 1024,
        percentUsed: 90,
        available: 10 * 1024 * 1024 * 1024,
        supported: true,
      });

      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      const warning = screen.getByRole("alert");
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveTextContent(/warning/i);
      expect(warning).toHaveTextContent(/90\.0% full/i);
    });

    it("shows warning exactly at 85%", () => {
      mockUseStorageQuota.mockReturnValue({
        usage: 85 * 1024 * 1024 * 1024,
        quota: 100 * 1024 * 1024 * 1024,
        percentUsed: 85,
        available: 15 * 1024 * 1024 * 1024,
        supported: true,
      });

      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("handles unsupported storage API gracefully", () => {
      mockUseStorageQuota.mockReturnValue({
        usage: 0,
        quota: 0,
        percentUsed: 0,
        available: 0,
        supported: false,
      });

      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      expect(
        screen.getByText(/storage quota information not available/i),
      ).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("handles zero quota gracefully", () => {
      mockUseStorageQuota.mockReturnValue({
        usage: 0,
        quota: 0,
        percentUsed: 0,
        available: 0,
        supported: true,
      });

      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      // Multiple "0 B" values for Used, Available, and Total
      const zeroValues = screen.getAllByText(/0 B/i);
      expect(zeroValues.length).toBeGreaterThan(0);
      expect(screen.getByText(/0\.0% used/i)).toBeInTheDocument();
    });

    it("caps progress bar width at 100%", () => {
      // Edge case: percentUsed could theoretically exceed 100
      mockUseStorageQuota.mockReturnValue({
        usage: 110 * 1024 * 1024 * 1024,
        quota: 100 * 1024 * 1024 * 1024,
        percentUsed: 110,
        available: 0,
        supported: true,
      });

      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      const progressBar = screen.getByRole("progressbar");
      // aria-valuenow should be capped at 100
      expect(progressBar).toHaveAttribute("aria-valuenow", "100");
      expect(progressBar).toHaveAttribute("aria-valuemax", "100");

      // The fill element's width should also be capped at 100%
      const fillElement = progressBar.querySelector(".storage-progress-fill");
      expect(fillElement).toHaveStyle({ width: "100%" });
    });

    it("formats bytes correctly for small values", () => {
      mockUseStorageQuota.mockReturnValue({
        usage: 512, // 512 bytes
        quota: 1024 * 1024, // 1 MB
        percentUsed: 0.05,
        available: 1024 * 1024 - 512,
        supported: true,
      });

      render(
        <BrowserRouter>
          <Recordings />
        </BrowserRouter>,
      );

      expect(screen.getByText(/512\.00 B/i)).toBeInTheDocument();
      expect(screen.getByText(/1\.00 MB/i)).toBeInTheDocument();
    });
  });
});
