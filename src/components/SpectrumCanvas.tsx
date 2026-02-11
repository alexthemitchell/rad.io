import { useEffect, useRef } from 'react';

interface SpectrumCanvasProps {
  data: Float32Array;
  zoom?: number;
  onPointClick?: (binIndex: number) => void;
}

export function SpectrumCanvas({ data, zoom = 1, onPointClick }: SpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple Line Chart for FFT
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Trace
    ctx.beginPath();
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1;

    // Zoom Logic: Show center portion
    const viewLen = Math.floor(data.length / zoom);
    const startIdx = Math.floor((data.length - viewLen) / 2);
    const endIdx = startIdx + viewLen;

    const sliceWidth = canvas.width * 1.0 / viewLen;
    let x = 0;

    for (let i = startIdx; i < endIdx; i++) {
      // Data is usually -100 to 0 dBFS (roughly). 
      // Map -100 -> height, 0 -> 0
      const v = (data[i] + 100) / 100; // 0..1
      const y = canvas.height - (v * canvas.height);

      if (i === startIdx) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.stroke();
  }, [data, zoom]); 

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onPointClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      // Reverse Map X to FFT Bin
      const viewLen = Math.floor(data.length / zoom);
      const startIdx = Math.floor((data.length - viewLen) / 2);
      
      // fraction of width
      const frac = x / canvas.width; 
      // relative index
      const relIdx = Math.floor(frac * viewLen);
      // absolute index
      const absIdx = startIdx + relIdx;

      onPointClick(absIdx);
  };

  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={200} 
      className="border border-gray-700 bg-black w-full cursor-crosshair"
      onClick={handleClick}
    />
  );
}
