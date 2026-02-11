self.onmessage = function(e) {
    if (e.data.type === 'init') {
        const sab = e.data.sab;
        const view = new Float32Array(sab);
        let writePtr = 0;

        // Simulate DSP loop
        setInterval(() => {
            const start = performance.now();
            
            // Artificial Load: Busy wait for 5ms to simulate DSP
            while (performance.now() - start < 5);

            // Write to SAB (simulated)
            // Real app would write IQ samples here.
            
        }, 10); // Run every 10ms (100Hz)
    }
};