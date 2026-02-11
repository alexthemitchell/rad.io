import { useState, useEffect, useRef } from 'react';
import { AudioSink } from './audio/AudioSink';
import { SpectrumCanvas } from './components/SpectrumCanvas';
import { WaterfallCanvas } from './components/WaterfallCanvas';
import { HackRFDevice } from './devices/HackRFDevice';
import { MockDevice } from './devices/MockDevice';
import { RtlSdrDevice } from './devices/RtlSdrDevice';
import { ISDRDevice, SDRGainStage } from './devices/ISDRDevice';

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [sourceType, setSourceType] = useState<'MOCK' | 'HACKRF' | 'RTLSDR'>('MOCK');
  const [fftData, setFftData] = useState<Float32Array>(new Float32Array(2048));
  const [scopeData, setScopeData] = useState<Float32Array>(new Float32Array(256));
  
  const [frequency, setFrequency] = useState<number>(90_000_000);
  // Gains: Map<StageName, Value>
  const [gains, setGains] = useState<Record<string, number>>({});
  const [gainStages, setGainStages] = useState<SDRGainStage[]>([]);

  const [demodMode, setDemodMode] = useState<'WFM' | 'AM'>('WFM');
  const [fineFreq, setFineFreq] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  
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

  // Update Device Frequency when controls change
  useEffect(() => {
    if (deviceRef.current && isRunning) {
        deviceRef.current.setFrequency(frequency);
    }
  }, [frequency, isRunning]);

  // Update Device Gains when state changes
  useEffect(() => {
    if (deviceRef.current && isRunning) {
        for (const [name, val] of Object.entries(gains)) {
            deviceRef.current.setGain(name, val);
        }
    }
  }, [gains, isRunning]);

  // Update Mode
  useEffect(() => {
    workerRef.current?.postMessage({ command: 'SET_MODE', value: demodMode });
  }, [demodMode]);

  // Update Fine Freq
  useEffect(() => {
    workerRef.current?.postMessage({ command: 'SET_FINE_FREQ', value: fineFreq });
  }, [fineFreq]);

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
        setGainStages([]); // Clear UI
    } else {
        // START
        try {
            await audioRef.current?.start(); // Resume AudioContext

            let dev: ISDRDevice;
            switch (sourceType) {
                case 'HACKRF': dev = new HackRFDevice(); break;
                case 'RTLSDR': dev = new RtlSdrDevice(); break;
                case 'MOCK': default: dev = new MockDevice(); break;
            }

            await dev.open();
            deviceRef.current = dev;

            // Initialize Gain UI from Device Capabilities
            const stages = dev.getGainStages();
            setGainStages(stages);
            
            const initialGains: Record<string, number> = {};
            for (const stage of stages) {
                initialGains[stage.name] = stage.value;
            }
            setGains(initialGains);
    
            // Apply initial state to Device
            await dev.setFrequency(frequency);
            for (const stage of stages) {
                await dev.setGain(stage.name, stage.value);
            }
    
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

  const handleGainChange = (name: string, val: number) => {
      setGains(prev => ({ ...prev, [name]: val }));
  };

  const handleSpectrumClick = (binIndex: number) => {
    // FFT Size 2048
    // Bin 0 = -Fs/2 (-1MHz)
    // Bin 1024 = 0 (DC)
    // Bin 2047 = +Fs/2 (+1MHz)
    // Fs = 2_000_000
    
    // Offset from DC in bins
    const offsetBins = binIndex - 1024;
    // Offset in Hz
    // Bin Width = 2000000 / 2048 = 976.5625 Hz
    const offsetHz = offsetBins * (2_000_000 / 2048);
    
    // Update Fine Tune
    // Note: NCO Mix uses Positive frequency to shift DOWN.
    // If signal is at +200kHz, we want to shift it DOWN by 200kHz to reach DC.
    // So NCO Frequency should be +200kHz.
    // So logic is direct: fineFreq = offsetHz.
    
    setFineFreq(Math.round(offsetHz));
  };

  return (
    <div className="p-4 bg-gray-900 text-white h-screen flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">rad.io (Vertical Slice B)</h1>
      
      <div className="w-full max-w-4xl grid grid-cols-2 gap-4">
        <div className="bg-black p-2 rounded col-span-2">
            <h2 className="text-xs text-gray-400 mb-1">RF WATERFALL</h2>
            <WaterfallCanvas data={fftData} minDb={-100} maxDb={-30} zoom={zoomLevel} />
        </div>
        <div className="bg-black p-2 rounded">
            <h2 className="text-xs text-gray-400 mb-1">RF SPECTRUM (FFT)</h2>
            <SpectrumCanvas data={fftData} zoom={zoomLevel} onPointClick={handleSpectrumClick} />
        </div>
        <div className="bg-black p-2 rounded">
            <h2 className="text-xs text-gray-400 mb-1">DEMOD AUDIO (SCOPE)</h2>
            <SpectrumCanvas data={scopeData} />
        </div>
      </div>

      <div className="flex gap-4 items-center bg-gray-800 p-4 rounded-lg flex-wrap justify-center">
        {/* Source Selector */}
        <div className="flex flex-col gap-1 border-r border-gray-600 pr-4">
            <label className="text-xs text-gray-400 font-mono">SOURCE</label>
            <select 
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as any)}
                disabled={isRunning}
                className="bg-gray-700 text-white px-2 py-1 rounded font-mono text-sm"
            >
                <option value="MOCK">Mock Source</option>
                <option value="HACKRF">HackRF One</option>
                <option value="RTLSDR">RTL-SDR (Exp)</option>
            </select>
        </div>

        {/* Connection Control */}
        <button 
            onClick={toggleStream}
            className={`px-6 py-2 rounded font-bold ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
            {isRunning ? 'Stop' : 'Start'}
        </button>

        <div className="flex flex-col gap-1 items-center">
            <label className="text-xs text-gray-400 font-mono">ZOOM ({zoomLevel}x)</label>
            <input 
                type="range" min="1" max="8" step="1"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                className="w-32"
            />
        </div>

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

        {/* Dynamic Gain Controls */}
        {gainStages.map(stage => (
            <div key={stage.name} className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-mono">{stage.label}: {gains[stage.name]}dB</label>
                <input 
                    type="range" 
                    min={stage.min} 
                    max={stage.max} 
                    step={stage.step}
                    value={gains[stage.name] || 0}
                    onChange={(e) => handleGainChange(stage.name, parseInt(e.target.value))}
                    className="w-32"
                />
            </div>
        ))}
        {gainStages.length === 0 && isRunning && (
            <div className="text-xs text-gray-500 italic">No gain controls available</div>
        )}
      </div>
    </div>
  );
}
