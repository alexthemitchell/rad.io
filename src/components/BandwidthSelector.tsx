import { ChangeEvent } from "react";

type BandwidthSelectorProps = {
  bandwidth: number;
  setBandwidth: (bandwidthHz: number) => Promise<void>;
  supportedBandwidths?: number[];
};

/**
 * BandwidthSelector Component
 *
 * Provides user interface for selecting baseband filter bandwidth.
 * Essential for reducing interference and improving signal clarity in crowded spectrum.
 */
export default function BandwidthSelector({
  bandwidth,
  setBandwidth,
  supportedBandwidths = [
    1.75e6, 2.5e6, 3.5e6, 5e6, 5.5e6, 6e6, 7e6, 8e6, 9e6, 10e6, 12e6, 14e6,
    15e6, 20e6, 24e6, 28e6,
  ],
}: BandwidthSelectorProps): React.JSX.Element {
  const handleBandwidthChange = ({
    target: { value },
  }: ChangeEvent<HTMLSelectElement>): void => {
    const bandwidthHz = Number(value);
    setBandwidth(bandwidthHz).catch(console.error);
  };

  return (
    <div className="control-group">
      <label className="control-label" htmlFor="bandwidth-select">
        Bandwidth Filter
      </label>
      <select
        id="bandwidth-select"
        name="bandwidth"
        className="control-input"
        value={bandwidth}
        onChange={handleBandwidthChange}
        title="Baseband filter bandwidth - narrower bandwidths reduce noise and interference but may filter out parts of wideband signals"
        aria-label={`Baseband filter bandwidth. Current: ${bandwidth / 1e6} MHz. Narrower bandwidths reduce noise but may filter wideband signals.`}
        aria-describedby="bandwidth-hint"
      >
        {supportedBandwidths.map((bw) => (
          <option key={bw} value={bw}>
            {bw / 1e6} MHz
          </option>
        ))}
      </select>
      <span id="bandwidth-hint" className="visually-hidden">
        Baseband filter bandwidth controls the frequency range captured. Narrower
        settings reduce interference in crowded bands.
      </span>
    </div>
  );
}
