import { useEffect, useMemo } from "react";

export default function useSpeaker() {
  const audioContext = useMemo(() => new AudioContext(), []);
  const bufferSource = useMemo(
    () => audioContext.createBufferSource(),
    [audioContext],
  );
  useEffect(() => {
    bufferSource.connect(audioContext.destination);
    bufferSource.start();
  }, [audioContext, bufferSource]);
  const streamAudio = (buffer: AudioBuffer) => {
    const node = new AudioBufferSourceNode(audioContext, {
      buffer,
    });
    node.start();
  };
  return {
    streamAudio,
  };
}
