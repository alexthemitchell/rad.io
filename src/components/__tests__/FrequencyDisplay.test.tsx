import { render, screen, fireEvent } from "@testing-library/react";
import FrequencyDisplay from "../FrequencyDisplay";

// Mock useLiveRegion
jest.mock("../../hooks/useLiveRegion", () => ({
  useLiveRegion: jest.fn(() => ({
    announce: jest.fn(),
    liveRegion: jest.fn(() => <div />),
  })),
}));

describe("FrequencyDisplay", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the frequency display", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    expect(
      screen.getByRole("region", { name: /VFO Control/i }),
    ).toBeInTheDocument();
  });

  it("displays frequency in correct format", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    expect(screen.getByText(/100\.000 MHz/i)).toBeInTheDocument();
  });

  it("displays frequency in GHz for high frequencies", () => {
    render(<FrequencyDisplay frequency={2400000000} onChange={mockOnChange} />);
    expect(screen.getByText(/2\.400000 GHz/i)).toBeInTheDocument();
  });

  it("displays frequency in kHz for low frequencies", () => {
    render(<FrequencyDisplay frequency={10000} onChange={mockOnChange} />);
    expect(screen.getByText(/10\.0 kHz/i)).toBeInTheDocument();
  });

  it("displays frequency in Hz for very low frequencies", () => {
    render(<FrequencyDisplay frequency={500} onChange={mockOnChange} />);
    expect(screen.getByText(/500 Hz/i)).toBeInTheDocument();
  });

  it("shows tune up button", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    expect(
      screen.getByRole("button", { name: /tune up/i }),
    ).toBeInTheDocument();
  });

  it("shows tune down button", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    expect(
      screen.getByRole("button", { name: /tune down/i }),
    ).toBeInTheDocument();
  });

  it("calls onChange when tune up is clicked", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    const tuneUpButton = screen.getByRole("button", { name: /tune up/i });
    fireEvent.click(tuneUpButton);
    expect(mockOnChange).toHaveBeenCalledWith(100001000); // +1kHz
  });

  it("calls onChange when tune down is clicked", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    const tuneDownButton = screen.getByRole("button", { name: /tune down/i });
    fireEvent.click(tuneDownButton);
    expect(mockOnChange).toHaveBeenCalledWith(99999000); // -1kHz
  });

  it("displays step size selector", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    expect(screen.getByLabelText(/tuning step size/i)).toBeInTheDocument();
  });

  it("has keyboard shortcut hints", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    expect(screen.getByText(/Arrows/i)).toBeInTheDocument();
    expect(screen.getByText(/Shift/i)).toBeInTheDocument();
  });

  it("displays default frequency when no frequency prop", () => {
    render(<FrequencyDisplay onChange={mockOnChange} />);
    const freqGroup = screen.getByRole("group", {
      name: /current frequency: 0 Hz/i,
    });
    expect(freqGroup).toBeInTheDocument();
  });

  it("frequency display is accessible and labeled", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    const freqGroup = screen.getByRole("group", {
      name: /current frequency/i,
    });
    expect(freqGroup).toBeInTheDocument();
  });

  it("shows all step size options", () => {
    render(<FrequencyDisplay frequency={100000000} onChange={mockOnChange} />);
    const select = screen.getByLabelText(
      /tuning step size/i,
    ) as HTMLSelectElement;
    const options = Array.from(select.options).map((opt) => opt.text);
    expect(options).toContain("Auto (context)");
    expect(options).toContain("1 Hz");
    expect(options).toContain("10 Hz");
    expect(options).toContain("100 Hz");
    expect(options).toContain("1 kHz");
    expect(options).toContain("10 kHz");
    expect(options).toContain("100 kHz");
    expect(options).toContain("1 MHz");
  });

  it("uses contextual step when 'Auto (context)' is selected", () => {
    const startHz = 500_000; // 500 kHz -> auto step should be 100 Hz
    render(<FrequencyDisplay frequency={startHz} onChange={mockOnChange} />);
    const select = screen.getByLabelText(
      /tuning step size/i,
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "0" } }); // select Auto
    const tuneUpButton = screen.getByRole("button", { name: /tune up/i });
    fireEvent.click(tuneUpButton);
    expect(mockOnChange).toHaveBeenCalledWith(startHz + 100);
  });
});
