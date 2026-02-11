// WFM Demodulator Worklet
// Extremely simple: 
// 1. Calculate phase angle (atan2)
// 2. Diff phase angle to get frequency (FM)
// 3. Output as audio

class WfmProcessor extends AudioWorkletProcessor {
    lastPhase: number = 0;

    process(inputs: Float32Array[][], outputs: Float32Array[][]) {
        const output = outputs[0];
        const channel = output[0];
        
        // Mock Sine Generation (Proof of Life)
        // In Vertical Slice A, we just want to prove the Audio path works.
        // Connecting the RingBuffer from the worker is the next step (Phase 1.2),
        // but for "MVP User Journey", hearing *something* when you click start is key.
        
        for (let i = 0; i < channel.length; i++) {
            // Generate a 440Hz tone to prove audio engine is running
            channel[i] = Math.sin(currentTime * 440 * 2 * Math.PI) * 0.1;
        }

        return true;
    }
}

registerProcessor('wfm-processor', WfmProcessor);
