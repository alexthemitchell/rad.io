import { useEffect, useState } from "react";
import { HackRFDevice } from "../models/HackRFDevice";
import RadioControls from "./RadioControls";
import useSpeaker from "../hooks/useSpeaker";

type FMRadioProps = {
  device: HackRFDevice;
};

const defaultState = {
  carrierFrequency: 100.3e6,
  sampleRate: 1200e3,
  tuneOffset: -120e3,
  carrierDeviation: 75e3,
};

const initializeDevice = async (device: HackRFDevice) => {
  const { carrierFrequency, sampleRate, tuneOffset } = defaultState;
  await device.setFrequency(carrierFrequency + tuneOffset);
  await device.setSampleRate(sampleRate);
  await device.setAmpEnable(false);
  await device.setLnaGain(24);
  await device.setVgaGain(8);
  await device.setAntennaEnable(true);
  console.log("Initialized");
};

export default function FMRadio({ device }: FMRadioProps) {
  useSpeaker();
  let samples: number[][] = [];
  const receiveData = async () => {
    await device.receive((data: DataView<ArrayBufferLike>) => {
      const sampleCount = data.byteLength / 2;
      for (let n = 0; n < sampleCount; n++) {
        const sampleIndex = n * 2;
        const first = data.getInt8(sampleIndex) / 127;
        const second = data.getInt8(sampleIndex + 1) / 127;
        samples = [...samples, [first, second]];
        console.log(JSON.stringify(samples));
      }
    });
  };
  useEffect(() => {
    initializeDevice(device).then(receiveData).catch(console.error);
  }, [device]);
  const [frequency, setFrequency] = useState(defaultState.carrierFrequency);
  const onChangeFrequency = async (newFrequency: number) => {
    await device.setFrequency(newFrequency);
    setFrequency(newFrequency);
  };

  const disconnect = () => {
    device
      .close()
      .catch(console.error)
      .finally(() => console.debug("Closed Device"));
  };
  return (
    <div>
      <RadioControls frequency={frequency} setFrequency={onChangeFrequency} />
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
