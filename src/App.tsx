import { useState, useEffect, useRef } from 'react';
import { AudioSink } from './audio/AudioSink';
import { SpectrumCanvas } from './components/SpectrumCanvas';
import { HackRFDevice } from './devices/HackRFDevice';
import { MockDevice } from './devices/MockDevice';
import { ISDRDevice } from './devices/ISDRDevice';

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [useMock, setUseMock] = useState(false);
  const [fftData, setFftData] = useState<Float32Array>(new Float32Array(2048));
  const [scopeData, setScopeData] = useState<Float32Array>(new Float32Array(256));
  
  const [frequency, setFrequency] = useState<number>(90_000_000);
  const [lnaGain, setLnaGain] = useState<number>(32);
  const [vgaGain, setVgaGain] = useState<number>(20);
  const [demodMode, setDemodMode] = useState<'WFM' | 'AM'>('WFM');
  const [fineFreq, setFineFreq] = useState<number>(0);
  
  const workerRef = useRef<Worker | null>(null);
  const deviceRef = useRef<ISDRDevice | null>(null);
  const audioRef = useRef<AudioSink | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./dsp/worker.ts', import.meta.url), { type: 'module' });
    audioRef.current = new AudioSink(50000); // 50k from worker

    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'FFT_DATA') {
        setFftData(e.data.data);
      } else if (e.data.type === 'SCOPE_DATA') {
        setScopeData(e.data.data);
      } else if (e.data.type === 'AUDIO_DATA') {
        audioRef.current?.push(e.data.data);
      }
    };

    return () => {
        workerRef.current?.terminate();
        audioRef.current?.stop();
    };
  }, []);

  // Update Device when controls change (if running)
  useEffect(() => {
    if (deviceRef.current && isRunning) {
        deviceRef.current.setFrequency(frequency);
    }
  }, [frequency, isRunning]);

  // Update Mode
  useEffect(() => {
    workerRef.current?.postMessage({ command: 'SET_MODE', value: demodMode });
  }, [demodMode]);

  // Update Fine Freq
  useEffect(() => {
    workerRef.current?.postMessage({ command: 'SET_FINE_FREQ', value: fineFreq });
  }, [fineFreq]);

  useEffect(() => {
    if (deviceRef.current && isRunning) {
        deviceRef.current.setGain('LNA', lnaGain);
        deviceRef.current.setGain('VGA', vgaGain);
    }
  }, [lnaGain, vgaGain, isRunning]);


  const toggleStream = async () => {
    if (isRunning) {
        // STOP
        if (deviceRef.current) {
            await deviceRef.current.close();
            deviceRef.current = null;
        }
        workerRef.current?.postMessage({ command: 'STOP' });
        audioRef.current?.stop();
        setIsRunning(false);
    } else {
        // START
        try {
            await audioRef.current?.start(); // Resume AudioContext

            const dev = useMock ? new MockDevice() : new HackRFDevice();
            await dev.open();
            deviceRef.current = dev;
    
            // Apply initial state
            await dev.setFrequency(frequency);
            await dev.setGain('LNA', lnaGain);
            await dev.setGain('VGA', vgaGain);
            if (!useMock) await dev.setGain('AMP', 0); 
    
            // Start Worker
            workerRef.current?.postMessage({ command: 'START_USB_MODE' });
            workerRef.current?.postMessage({ command: 'SET_MODE', value: demodMode });
            workerRef.current?.postMessage({ command: 'SET_FINE_FREQ', value: fineFreq });
    
            // Start Stream
            dev.start((dataView) => {
                const buf = dataView.buffer.slice(0); 
                workerRef.current?.postMessage({ 
                    type: 'USB_DATA', 
                    data: buf 
                }, [buf]); 
            });
    
            setIsRunning(true);
        } catch (e) {
            console.error("Failed to open device:", e);
            alert("Failed to open device (Check console)");
        }
    }
  };

  return (
    <div className="p-4 bg-gray-900 text-white h-screen flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">rad.io (Vertical Slice B)</h1>
      
      <div className="w-full max-w-4xl grid grid-cols-2 gap-4">
        <div className="bg-black p-2 rounded">
            <h2 className="text-xs text-gray-400 mb-1">RF SPECTRUM (FFT)</h2>
            <SpectrumCanvas data={fftData} />
        </div>
        <div className="bg-black p-2 rounded">
            <h2 className="text-xs text-gray-400 mb-1">DEMOD AUDIO (SCOPE)</h2>
            <SpectrumCanvas data={scopeData} />
        </div>
      </div>

      <div className="flex gap-4 items-center bg-gray-800 p-4 rounded-lg">
        {/* Source Selector */}
        <div className="flex flex-col gap-1 border-r border-gray-600 pr-4">
            <label className="text-xs text-gray-400 font-mono">SOURCE</label>
            <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    checked={useMock} 
                    onChange={(e) => setUseMock(e.target.checked)}
                    disabled={isRunning}
                    id="mock-check"
                />
                <label htmlFor="mock-check" className="text-sm cursor-pointer select-none">Mock Data</label>
            </div>
        </div>

        {/* Connection Control */}
        <button 
            onClick={toggleStream}
            className={`px-6 py-2 rounded font-bold ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
            {isRunning ? 'Stop' : 'Start'}
        </button>

        {/* Frequency Control */}
        <div className="flex flex-col gap-1 items-center">
            <label className="text-xs text-gray-400 font-mono">FINE TUNE ({fineFreq} Hz)</label>
            <input 
                type="range" min="-100000" max="100000" step="1000"
                value={fineFreq}
                onChange={(e) => setFineFreq(parseInt(e.target.value))}
                className="w-32"
            />
        </div>

        <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-mono">MODE</label>
            <select 
                value={demodMode}
                onChange={(e) => setDemodMode(e.target.value as 'WFM' | 'AM')}
                className="bg-gray-700 text-white px-2 py-1 rounded font-mono w-24 text-center"
            >
                <option value="WFM">WFM</option>
                <option value="AM">AM</option>
            </select>
        </div>

        <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-mono">FREQUENCY (MHz)</label>
            <input 
                type="number" 
                value={(frequency / 1_000_000).toFixed(3)}
                onChange={(e) => setFrequency(Math.floor(parseFloat(e.target.value) * 1_000_000))}
                className="bg-gray-700 text-white px-2 py-1 rounded font-mono w-32 text-center"
                step="0.1"
            />
        </div>

        {/* Gain Controls */}
        <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-mono">LNA GAIN: {lnaGain}dB</label>
            <input 
                type="range" min="0" max="40" step="8"
                value={lnaGain}
                onChange={(e) => setLnaGain(parseInt(e.target.value))}
                className="w-32"
                disabled={useMock}
            />
        </div>

        <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-mono">VGA GAIN: {vgaGain}dB</label>
            <input 
                type="range" min="0" max="62" step="2"
                value={vgaGain}
                onChange={(e) => setVgaGain(parseInt(e.target.value))}
                className="w-32"
                disabled={useMock}
            />
        </div>
      </div>
    </div>
  );
}
