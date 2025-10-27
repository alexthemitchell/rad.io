import { render, screen, fireEvent } from "@testing-library/react";
import FrequencyDisplay from "../FrequencyDisplay";

// Mock useLiveRegion to avoid dependency on aria-live announcements
jest.mock("../../hooks/useLiveRegion", () => ({
  useLiveRegion: () => ({ announce: jest.fn() }),
}));

describe("FrequencyDisplay digit-under-caret editing", () => {
  it("increments selected digit with ArrowUp and decrements with ArrowDown", () => {
    const handleChange = jest.fn();
    const initialHz = 100_500_000; // 100.500 MHz

    render(<FrequencyDisplay frequency={initialHz} onChange={handleChange} />);

    // Select the 1 MHz digit (default is 1 MHz per component state)
    // Verify the digits are rendered and we can click a different one as well
    const digitButtons = screen.getAllByRole("button", {
      name: /Select .* digit/i,
    });
    expect(digitButtons.length).toBeGreaterThanOrEqual(6);

    // Send ArrowUp to window to trigger global handler
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(handleChange).toHaveBeenCalled();
    const [newHz] = handleChange.mock.calls[0];
    // 1 MHz increase
    expect(newHz).toBe(initialHz + 1_000_000);

    handleChange.mockClear();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    // back to initial - 1 MHz (because prop didn't change in test harness)
    expect(handleChange).toHaveBeenCalled();
    const [downHz] = handleChange.mock.calls[0];
    expect(downHz).toBe(initialHz - 1_000_000);
  });
});
