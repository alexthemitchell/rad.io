import { useEffect, useRef } from 'react';

interface WaterfallCanvasProps {
  data: Float32Array;
  minDb?: number;
  maxDb?: number;
}

export function WaterfallCanvas({ data, minDb = -100, maxDb = 0 }: WaterfallCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Colormap Cache (Simple Heatmap)
  const colormap = useRef<Uint32Array | null>(null);

  useEffect(() => {
    // Generate Colormap once
    if (!colormap.current) {
        colormap.current = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            // Simple Blue -> Cyan -> Green -> Yellow -> Red
            // 0..255
            let r=0, g=0, b=0;
            if (i < 64) { // Black -> Blue
                b = i * 4;
            } else if (i < 128) { // Blue -> Cyan
                b = 255;
                g = (i - 64) * 4;
            } else if (i < 192) { // Cyan -> Yellow
                b = 255 - (i - 128) * 4;
                g = 255;
                r = (i - 128) * 4;
            } else { // Yellow -> Red
                g = 255 - (i - 192) * 4;
                r = 255;
            }
            // ABGR for 32-bit putImageData (Little Endian usually)
            colormap.current[i] = (255 << 24) | (b << 16) | (g << 8) | r;
        }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (!tempCanvasRef.current) {
        tempCanvasRef.current = document.createElement('canvas');
        tempCanvasRef.current.width = canvas.width;
        tempCanvasRef.current.height = canvas.height;
    }
    const tempCtx = tempCanvasRef.current.getContext('2d');

    // 1. Shift existing content down by 1 pixel
    // Draw current canvas to temp
    if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
        
        // Clear main
        // ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw back shifted
        // Draw from temp(0, 0, w, h-1) to main(0, 1)
        ctx.drawImage(tempCanvasRef.current, 
            0, 0, canvas.width, canvas.height - 1,
            0, 1, canvas.width, canvas.height - 1
        );
    }

    // 2. Draw new row at top (y=0)
    // Create ImageData for 1 row
    const width = canvas.width;
    const imgData = ctx.createImageData(width, 1);
    const buf32 = new Uint32Array(imgData.data.buffer);
    const cmap = colormap.current!;

    // Resample FFT (Length -> Width)
    // Nearest neighbor for speed for now
    for (let x = 0; x < width; x++) {
        // Map x (0..width) to fft index (0..data.length)
        const fftIdx = Math.floor(x * data.length / width);
        let valDb = data[fftIdx];
        
        // Clamp and Scale to 0..255
        if (valDb < minDb) valDb = minDb;
        if (valDb > maxDb) valDb = maxDb;
        
        const norm = (valDb - minDb) / (maxDb - minDb); // 0..1
        const colorIdx = Math.floor(norm * 255);
        
        buf32[x] = cmap[colorIdx];
    }

    ctx.putImageData(imgData, 0, 0);

  }, [data]); // Still dependent on data prop for update loop (Slice A style)

  return (
    <canvas 
      ref={canvasRef} 
      width={1024} 
      height={300} 
      className="border border-gray-700 bg-black w-full"
    />
  );
}
