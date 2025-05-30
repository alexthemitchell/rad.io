import { ChangeEvent } from "react";

type RadioControlsProps = {
  //ampEnable: boolean;
  frequency: number;
  //lnaGain: number;
  //sampleRate: number;
  //vgaGain: number;

  //setAmpEnable: (enabled: boolean) => Promise<void>;
  setFrequency: (frequencyHz: number) => Promise<void>;
  //setLnaGain: (gainDb: number) => Promise<void>;
  //setSampleRate: (frequencyHz: number) => Promise<void>;
  //setVgaGain: (gainDb: number) => Promise<void>;
};

export default function RadioControls({
  //ampEnable,
  frequency,
  //lnaGain,
  //sampleRate,
  //vgaGain,
  //setAmpEnable,
  setFrequency,
  //setLnaGain,
  //setSampleRate,
  //setVgaGain,
}: RadioControlsProps) {
  const handleChangeFrequency = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => {
    const mhz = Number(value);
    setFrequency(mhz * 1e6).catch(console.error);
  };
  return (
    <div>
      <div>Control Panel</div>
      <div>
        <input
          type="number"
          name="frequency"
          min="88.1"
          max="107.9"
          step="0.1"
          value={frequency / 1e6}
          onChange={handleChangeFrequency}
        />
      </div>
    </div>
  );
}
