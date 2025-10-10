import { useEffect, useState } from "react";
import { useHackRFDevice } from "../hooks/useHackRFDevice";
import { HackRFOne } from "../models/HackRFOne";

function Visualizer() {
  const { device, initialize, cleanup } = useHackRFDevice();
  const [listening, setListening] = useState(false);

  // Helper function to convert DataView to base64 string
  const dataViewToBase64 = (data: DataView): string => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      const byte = bytes[i];
      if (byte === undefined) {
        throw new Error("Encountered undefined byte in IQ sample data");
      }
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  };

  useEffect(() => {
    if (!device) {
      return;
    }
    // Configure device: set frequency and amp enable
    const run = async () => {
      await device.setFrequency(100.3e6);
      await device.setAmpEnable(false);

      // Start reception with a callback to log IQ samples in base64
      setListening(true);
      device
        .receive((data) => {
          const base64Sample = dataViewToBase64(data);
          console.debug("IQ Sample (base64):", base64Sample);
        })
        .catch(console.error);

      // After 10 seconds, stop reception and cleanup
      setTimeout(async () => {
        await device.stopRx();
        await device.close();
        setListening(false);
        console.debug("Stopped reception and closed device after 10 seconds");
      }, 10000);
    };
    run().then(() => console.log("Completed Run"));
  }, [device]);

  const startListening = async () => {
    try {
      // Request permission and initialize device if not already done
      if (!device) {
        await initialize();
        // Wait a short moment for device to become available
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <button onClick={startListening} disabled={listening}>
        Initialize
      </button>
      <button onClick={cleanup} disabled={listening}>
        Cleanup
      </button>
    </div>
  );
}

export default Visualizer;
