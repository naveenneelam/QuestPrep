// public/audio-worklet-processor.js

/**
 * Converts a Float32Array of audio samples to an Int16Array buffer.
 * @param {Float32Array} buffer - The input buffer with Float32 samples.
 * @returns {ArrayBuffer} - The ArrayBuffer containing Int16 samples.
 */
function float32ToInt16(buffer) {
  const l = buffer.length;
  const buf = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp the sample to the range [-1, 1]
    let s = Math.max(-1, Math.min(1, buffer[i]));
    // Convert to 16-bit integer
    // Positive values are mapped to [0, 32767]
    // Negative values are mapped to [-32768, -1]
    buf[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return buf.buffer;
}

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.bufferSize = options?.processorOptions?.bufferSize || 4096; // Default buffer size
    this.sampleRate = options?.processorOptions?.sampleRate || 16000; // Expected sample rate
    this._internalBuffer = new Int16Array(0); // To accumulate data if needed, though we send per process call

    this.port.onmessage = (event) => {
      if (event.data.command === 'close') {
        // Handle cleanup if necessary, though the worklet's lifecycle is tied to the node
        this.port.postMessage({ status: 'processor_closed' });
      }
    };
    console.log(`AudioWorkletProcessor initialized with sampleRate: ${this.sampleRate}, bufferSize: ${this.bufferSize}, currentTime: ${currentTime}`);
  }

  process(inputs, outputs, parameters) {
    // We expect a single input, and that input to have a single channel (mono)
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true; // Keep processor alive
    }

    const inputChannelData = input[0]; // Float32Array for the first channel

    if (inputChannelData) {
      // Convert the Float32Array audio data to Int16 ArrayBuffer
      const int16Buffer = float32ToInt16(inputChannelData);

      // Post the ArrayBuffer back to the main thread
      // The `transfer` array makes this a zero-copy transfer if supported by the browser
      this.port.postMessage({ audioData: int16Buffer }, [int16Buffer]);
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);