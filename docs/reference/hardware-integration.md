# Hardware Integration Guide

## Overview

This guide covers interfacing SDR hardware with browser-based applications, focusing on WebUSB, WebRTC, and server-based approaches.

## Browser Limitations

### What Browsers Can't Do (Directly)

- Access USB devices (except via WebUSB)
- Access serial ports (limited support via Web Serial API)
- Direct TCP/UDP sockets
- Native driver installation

### Workarounds

1. **WebUSB**: Direct browser-to-device communication (limited device support)
2. **WebRTC**: Real-time streaming from local software
3. **WebSocket Bridge**: Server acts as intermediary
4. **Cloud SDR**: Remote receiver accessed via HTTP/WebSocket

## Architecture Patterns

### Pattern 1: Local Software Bridge

**Architecture**:

```
SDR Hardware ← USB → Local Software ← WebSocket → Browser App
```

**Pros**:

- Supports any SDR hardware
- Low latency
- Full hardware control
- Works offline

**Cons**:

- Requires local software installation
- Platform-specific builds needed

**Implementation**:

**Server (Node.js example)**:

```javascript
const WebSocket = require("ws");
const rtlsdr = require("rtl-sdr"); // Hardware driver

const wss = new WebSocket.Server({ port: 8080 });

const device = rtlsdr.open(0);
device.setCenterFreq(100e6);
device.setSampleRate(2.048e6);
device.setGain("auto");

wss.on("connection", (ws) => {
  console.log("Client connected");

  // Handle control commands
  ws.on("message", (message) => {
    const cmd = JSON.parse(message);

    switch (cmd.type) {
      case "setFrequency":
        device.setCenterFreq(cmd.value);
        break;
      case "setGain":
        device.setGain(cmd.value);
        break;
      case "setSampleRate":
        device.setSampleRate(cmd.value);
        break;
    }
  });

  // Stream samples
  device.on("data", (data) => {
    // Convert to I/Q format
    const iqData = convertToIQ(data);
    ws.send(iqData);
  });

  device.start();

  ws.on("close", () => {
    console.log("Client disconnected");
    device.stop();
  });
});

function convertToIQ(buffer) {
  // RTL-SDR returns 8-bit unsigned I/Q pairs
  const samples = new Float32Array(buffer.length);

  for (let i = 0; i < buffer.length; i++) {
    samples[i] = (buffer[i] - 127.5) / 127.5;
  }

  return samples.buffer;
}
```

**Client (Browser)**:

```javascript
class SDRClient {
  constructor(url = "ws://localhost:8080") {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onmessage = (event) => {
      const samples = new Float32Array(event.data);
      this.onSamples(samples);
    };
  }

  setFrequency(freq) {
    this.ws.send(
      JSON.stringify({
        type: "setFrequency",
        value: freq,
      }),
    );
  }

  setGain(gain) {
    this.ws.send(
      JSON.stringify({
        type: "setGain",
        value: gain,
      }),
    );
  }

  onSamples(samples) {
    // Override in implementation
    // samples is Float32Array of I/Q pairs
  }
}

// Usage
const sdr = new SDRClient();
sdr.onSamples = (samples) => {
  // Process samples
  const I = new Float32Array(samples.length / 2);
  const Q = new Float32Array(samples.length / 2);

  for (let i = 0; i < samples.length; i += 2) {
    I[i / 2] = samples[i];
    Q[i / 2] = samples[i + 1];
  }

  processIQ(I, Q);
};

sdr.setFrequency(145.5e6); // 145.5 MHz
```

---

### Pattern 2: WebRTC Streaming

**Architecture**:

```
SDR Hardware ← USB → Local Software ← WebRTC → Browser App
```

**Pros**:

- Standardized real-time streaming
- Adaptive quality
- NAT traversal built-in

**Cons**:

- More complex setup
- Overhead for local use

**Implementation**:

**Server creates WebRTC offer**:

```javascript
const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");

class WebRTCSDR {
  constructor(device) {
    this.device = device;
    this.pc = new RTCPeerConnection();

    // Create data channel for samples
    this.dataChannel = this.pc.createDataChannel("sdr");

    this.device.on("data", (data) => {
      if (this.dataChannel.readyState === "open") {
        this.dataChannel.send(data);
      }
    });
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async acceptAnswer(answer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}
```

**Client accepts offer**:

```javascript
class WebRTCSDRClient {
  constructor() {
    this.pc = new RTCPeerConnection();

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = "arraybuffer";

      this.dataChannel.onmessage = (event) => {
        const samples = new Float32Array(event.data);
        this.onSamples(samples);
      };
    };
  }

  async connect(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return answer;
  }

  onSamples(samples) {
    // Override
  }
}
```

---

### Pattern 3: Cloud/Remote SDR

**Architecture**:

```
Browser App ← HTTP/WebSocket → Remote Server ← USB → SDR Hardware
```

**Examples**: WebSDR, KiwiSDR

**Pros**:

- No local hardware needed
- Access from anywhere
- Multiple users

**Cons**:

- Requires internet
- Latency
- Limited control
- Shared resource

**Client Implementation**:

```javascript
class RemoteSDR {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
  }

  async connect() {
    // Get available receivers
    const response = await fetch(`${this.serverUrl}/api/receivers`);
    const receivers = await response.json();

    // Connect to first available
    const receiver = receivers.find((r) => r.available);
    if (!receiver) throw new Error("No receivers available");

    // Establish WebSocket
    this.ws = new WebSocket(`${this.serverUrl}/stream/${receiver.id}`);
    this.ws.binaryType = "arraybuffer";

    this.ws.onmessage = (event) => {
      const packet = this.parsePacket(event.data);

      if (packet.type === "samples") {
        this.onSamples(packet.data);
      } else if (packet.type === "metadata") {
        this.onMetadata(packet.data);
      }
    };
  }

  setFrequency(freq) {
    this.sendCommand("frequency", freq);
  }

  setMode(mode) {
    this.sendCommand("mode", mode);
  }

  sendCommand(cmd, value) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd, value }));
    }
  }

  parsePacket(data) {
    // Custom protocol
    const view = new DataView(data);
    const type = view.getUint8(0);

    if (type === 0x01) {
      // Sample data
      return {
        type: "samples",
        data: new Float32Array(data, 1),
      };
    } else if (type === 0x02) {
      // Metadata
      return {
        type: "metadata",
        data: JSON.parse(new TextDecoder().decode(new Uint8Array(data, 1))),
      };
    }
  }

  onSamples(samples) {
    // Override
  }

  onMetadata(metadata) {
    // Override
  }
}
```

---

### Pattern 4: WebUSB (Direct Browser Access)

**Architecture**:

```
Browser App ← WebUSB → SDR Hardware
```

**Pros**:

- No server needed
- Direct control
- Low latency

**Cons**:

- Very limited device support
- Complex USB protocol implementation
- Browser compatibility issues

**Requirements**:

- HTTPS (or localhost)
- Supported browser (Chrome/Edge)
- Compatible hardware (RTL-SDR with WebUSB firmware)

**Implementation**:

```javascript
class WebUSBSDR {
  constructor() {
    this.device = null;
    this.interfaceNumber = 0;
    this.endpointIn = 1;
    this.endpointOut = 2;
  }

  async requestDevice() {
    // Request USB device
    this.device = await navigator.usb.requestDevice({
      filters: [
        {
          vendorId: 0x0bda, // Realtek (RTL-SDR)
          productId: 0x2838,
        },
      ],
    });

    await this.device.open();
    await this.device.selectConfiguration(1);
    await this.device.claimInterface(this.interfaceNumber);
  }

  async setFrequency(freq) {
    // Send control transfer
    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: 0x05, // Set center frequency
        value: 0,
        index: 0,
      },
      this.packFrequency(freq),
    );
  }

  async setSampleRate(rate) {
    await this.device.controlTransferOut(
      {
        requestType: "vendor",
        recipient: "device",
        request: 0x06,
        value: 0,
        index: 0,
      },
      this.packSampleRate(rate),
    );
  }

  async startStreaming() {
    while (this.streaming) {
      // Bulk transfer to read samples
      const result = await this.device.transferIn(
        this.endpointIn,
        16384, // Buffer size
      );

      if (result.status === "ok") {
        const samples = new Uint8Array(result.data.buffer);
        this.onSamples(this.convertSamples(samples));
      }
    }
  }

  convertSamples(buffer) {
    // Convert 8-bit unsigned to I/Q float
    const samples = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      samples[i] = (buffer[i] - 127.5) / 127.5;
    }
    return samples;
  }

  packFrequency(freq) {
    // Pack frequency into 4-byte little-endian
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, freq, true);
    return buffer;
  }

  packSampleRate(rate) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, rate, true);
    return buffer;
  }

  onSamples(samples) {
    // Override
  }
}

// Usage
const sdr = new WebUSBSDR();

document.getElementById("connect-btn").onclick = async () => {
  await sdr.requestDevice();
  await sdr.setFrequency(100e6);
  await sdr.setSampleRate(2.048e6);
  sdr.streaming = true;
  sdr.startStreaming();
};
```

---

## Data Format Considerations

### Sample Format Conversion

Most SDR hardware outputs 8-bit or 16-bit integers. Convert to float for processing:

```javascript
// 8-bit unsigned (0-255) to float (-1.0 to 1.0)
function uint8ToFloat(buffer) {
  const samples = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    samples[i] = (buffer[i] - 127.5) / 127.5;
  }
  return samples;
}

// 16-bit signed (-32768 to 32767) to float
function int16ToFloat(buffer) {
  const samples = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    samples[i] = buffer[i] / 32768.0;
  }
  return samples;
}
```

### Bandwidth Optimization

**Decimation for network transmission**:

```javascript
function decimate(samples, factor) {
  const decimated = new Float32Array(samples.length / factor);
  for (let i = 0; i < decimated.length; i++) {
    decimated[i] = samples[i * factor];
  }
  return decimated;
}

// Reduce bandwidth by 4×
const decimated = decimate(samples, 4);
```

### Compression

**For network transmission**:

- 8-bit quantization (adequate for many applications)
- Delta encoding for slow-changing values
- Audio compression (Opus) for demodulated audio

## Hardware-Specific Notes

### RTL-SDR

- **Frequency range**: 24-1766 MHz (typical)
- **Sample rate**: Up to 3.2 MS/s
- **Resolution**: 8-bit
- **Requires**: Drivers, bias-T control

### HackRF

- **Frequency range**: 1 MHz - 6 GHz
- **Sample rate**: Up to 20 MS/s
- **Resolution**: 8-bit
- **Features**: Transmit capable

### Airspy

- **Frequency range**: 24 MHz - 1.8 GHz
- **Sample rate**: Up to 10 MS/s
- **Resolution**: 12-bit
- **Features**: Better dynamic range

### SDRplay

- **Frequency range**: 1 kHz - 2 GHz
- **Sample rate**: Up to 10 MS/s
- **Resolution**: 14-bit
- **Features**: Wide bandwidth, high dynamic range

## Security Considerations

### WebSocket Security

- Use WSS (WebSocket Secure) for remote access
- Implement authentication
- Rate limiting
- Input validation

### WebUSB Security

- User must explicitly grant permission
- HTTPS required (except localhost)
- Limit to trusted sites

## Testing Without Hardware

### Simulated SDR

```javascript
class SimulatedSDR {
  constructor(sampleRate = 2.048e6) {
    this.sampleRate = sampleRate;
    this.centerFreq = 100e6;
    this.running = false;
  }

  start() {
    this.running = true;
    this.generateSamples();
  }

  generateSamples() {
    if (!this.running) return;

    const bufferSize = 16384;
    const samples = new Float32Array(bufferSize);

    // Generate noise + test signals
    for (let i = 0; i < bufferSize; i += 2) {
      // Noise
      samples[i] = (Math.random() - 0.5) * 0.1; // I
      samples[i + 1] = (Math.random() - 0.5) * 0.1; // Q

      // Add CW signal at +10 kHz
      const t = (this.sampleCount + i / 2) / this.sampleRate;
      const freq = 10e3; // 10 kHz offset
      samples[i] += 0.5 * Math.cos(2 * Math.PI * freq * t);
      samples[i + 1] += 0.5 * Math.sin(2 * Math.PI * freq * t);
    }

    this.sampleCount += bufferSize / 2;
    this.onSamples(samples);

    setTimeout(() => this.generateSamples(), 10);
  }

  setFrequency(freq) {
    this.centerFreq = freq;
  }

  onSamples(samples) {
    // Override
  }
}
```

### File Playback

```javascript
class FileSDR {
  async loadFile(file) {
    const buffer = await file.arrayBuffer();
    this.samples = new Float32Array(buffer);
    this.position = 0;
  }

  start(bufferSize = 16384, interval = 100) {
    this.running = true;

    const sendChunk = () => {
      if (!this.running) return;

      const chunk = this.samples.slice(
        this.position,
        this.position + bufferSize,
      );

      this.position += bufferSize;
      if (this.position >= this.samples.length) {
        this.position = 0; // Loop
      }

      this.onSamples(chunk);
      setTimeout(sendChunk, interval);
    };

    sendChunk();
  }

  onSamples(samples) {
    // Override
  }
}

// Usage
const fileSdr = new FileSDR();
await fileSdr.loadFile(iqFile);
fileSdr.start();
```

## Resources

- **WebUSB API**: developer.mozilla.org/en-US/docs/Web/API/WebUSB_API
- **rtl-sdr.com**: Hardware info and drivers
- **GNU Radio**: gnuradio.org - Reference implementations
- **WebSDR**: websdr.org - Remote receiver network
