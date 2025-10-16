import { useEffect, useMemo } from "react";

export default function useSpeaker(): {
  streamAudio: (buffer: AudioBuffer) => void;
} {
  const audioContext = useMemo(() => new AudioContext(), []);
  const bufferSource = useMemo(
    () => audioContext.createBufferSource(),
    [audioContext],
  );
  useEffect(() => {
    bufferSource.connect(audioContext.destination);
    bufferSource.start();
  }, [audioContext, bufferSource]);
  const streamAudio = (buffer: AudioBuffer): void => {
    const node = new AudioBufferSourceNode(audioContext, {
      buffer,
    });
    node.start();
  };
  return {
    streamAudio,
  };
}
