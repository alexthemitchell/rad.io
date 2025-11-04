import { renderHook, act } from "@testing-library/react";
import { useFrequencyInput } from "../useFrequencyInput";
import type { ChangeEvent, KeyboardEvent } from "react";

describe("useFrequencyInput", () => {
  let mockSetFrequency: jest.Mock;

  beforeEach(() => {
    mockSetFrequency = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("FM mode", () => {
    it("should convert FM frequency to MHz for display", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000, // 100 MHz
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      expect(result.current.displayValue).toBe(100);
      expect(result.current.unit).toBe("MHz");
    });

    it("should have correct FM bounds", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      expect(result.current.min).toBe(88.1);
      expect(result.current.max).toBe(107.9);
      expect(result.current.step).toBe(0.1);
    });

    it("should handle FM frequency change", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        target: { value: "95.5" },
      } as ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleChange(mockEvent);
      });

      expect(mockSetFrequency).toHaveBeenCalledWith(95_500_000);
    });

    it("should increment FM frequency with ArrowUp", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        key: "ArrowUp",
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockSetFrequency).toHaveBeenCalledWith(100_100_000); // +0.1 MHz
    });

    it("should decrement FM frequency with ArrowDown", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        key: "ArrowDown",
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockSetFrequency).toHaveBeenCalledWith(99_900_000); // -0.1 MHz
    });

    it("should apply FM bounds when adjusting frequency", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 88_100_000, // At minimum
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        key: "ArrowDown",
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Should not go below min (88.1 MHz)
      expect(mockSetFrequency).toHaveBeenCalledWith(88_100_000);
    });

    it("should handle FM PageUp for coarse tuning", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        key: "PageUp",
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockSetFrequency).toHaveBeenCalledWith(101_000_000); // +1.0 MHz
    });
  });

  describe("AM mode", () => {
    it("should convert AM frequency to kHz for display", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 1_000_000, // 1000 kHz (1 MHz)
          signalType: "AM",
          setFrequency: mockSetFrequency,
        }),
      );

      expect(result.current.displayValue).toBe(1000);
      expect(result.current.unit).toBe("kHz");
    });

    it("should have correct AM bounds", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 1_000_000,
          signalType: "AM",
          setFrequency: mockSetFrequency,
        }),
      );

      expect(result.current.min).toBe(530);
      expect(result.current.max).toBe(1700);
      expect(result.current.step).toBe(10);
    });

    it("should handle AM frequency change", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 1_000_000,
          signalType: "AM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        target: { value: "660" },
      } as ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleChange(mockEvent);
      });

      expect(mockSetFrequency).toHaveBeenCalledWith(660_000);
    });

    it("should increment AM frequency with ArrowUp", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 1_000_000,
          signalType: "AM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        key: "ArrowUp",
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockSetFrequency).toHaveBeenCalledWith(1_010_000); // +10 kHz
    });

    it("should apply AM bounds when adjusting frequency", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 1_700_000, // At maximum (1700 kHz)
          signalType: "AM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        key: "ArrowUp",
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      // Should not go above max (1700 kHz)
      expect(mockSetFrequency).toHaveBeenCalledWith(1_700_000);
    });

    it("should handle AM PageDown for coarse tuning", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 1_000_000,
          signalType: "AM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        key: "PageDown",
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockSetFrequency).toHaveBeenCalledWith(900_000); // -100 kHz
    });
  });

  describe("error handling", () => {
    it("should handle setFrequency errors gracefully", () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockSetFrequency.mockRejectedValueOnce(new Error("Failed to set freq"));

      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        target: { value: "95.5" },
      } as ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleChange(mockEvent);
      });

      // Wait for promise to reject
      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      }, 0);
    });
  });

  describe("accessibility", () => {
    it("should provide proper aria label", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      expect(result.current.ariaLabel).toContain("Center frequency");
      expect(result.current.ariaLabel).toContain("100.0 MHz");
    });

    it("should provide hint text", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      expect(result.current.hint).toContain("arrow keys");
      expect(result.current.hint).toContain("0.1 MHz");
    });

    it("should provide tooltip", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      expect(result.current.tooltip).toContain("FM frequency");
      expect(result.current.tooltip).toContain("88.1-107.9 MHz");
    });
  });

  describe("other key events", () => {
    it("should not prevent default for other keys", () => {
      const { result } = renderHook(() =>
        useFrequencyInput({
          frequency: 100_000_000,
          signalType: "FM",
          setFrequency: mockSetFrequency,
        }),
      );

      const mockEvent = {
        key: "a",
        preventDefault: jest.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockSetFrequency).not.toHaveBeenCalled();
    });
  });
});
