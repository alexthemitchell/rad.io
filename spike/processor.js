class RingBufferProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sab = null;
        this.view = null;
        this.readPtr = 0;
        this.port.onmessage = (e) => {
            if (e.data.type === 'start') {
                this.sab = e.data.sab;
                this.view = new Float32Array(this.sab);
                this.readPtr = 0; // Reset
            }
        };
    }

    process(inputs, outputs, parameters) {
        if (!this.view) return true;

        const output = outputs[0];
        const channel = output[0];
        const writePtr = Atomics.load(this.view, 0); // Head is stored at index 0 (hack for spike)
        // Data starts at index 1

        for (let i = 0; i < channel.length; i++) {
            // Check for underrun (simplistic)
            // In real app, we need atomic read/write cursors.
            // For spike, we just read from the buffer wrapping around.
            
            // To properly test latency, we just play the buffer.
            // Real ring buffer logic is complex; omitting for brevity of spike.
            // Just outputting a sine wave generated here to prove AudioWorklet is alive.
            channel[i] = Math.sin(currentTime * 440 * 2 * Math.PI);
        }

        // Latency check: occasionally ping main thread
        if (currentTime % 1 < 0.01) {
            this.port.postMessage({ type: 'latency', val: (currentTime - Math.floor(currentTime)) * 1000 });
        }

        return true;
    }
}
registerProcessor('ring-buffer-processor', RingBufferProcessor);