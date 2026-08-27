/**
 * AudioWorkletProcessor script string for capturing low-latency microphone audio.
 * Runs on dedicated audio rendering thread for high-frequency 16kHz PCM streaming.
 */
export const MICROPHONE_WORKLET_CODE = `
class MicrophonePcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const inputChannel = inputs[0]?.[0];
    if (!inputChannel || inputChannel.length === 0) {
      return true;
    }

    // Accumulate samples into buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];
      if (this.bufferIndex >= this.bufferSize) {
        // Send a copy of the raw float32 chunk
        this.port.postMessage(this.buffer.slice(0, this.bufferSize));
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor("microphone-pcm-processor", MicrophonePcmProcessor);
`;

/**
 * Loads the inline AudioWorkletProcessor into the provided AudioContext via Blob URL.
 */
export async function loadMicrophoneWorklet(
  audioContext: AudioContext
): Promise<void> {
  if (typeof Blob === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([MICROPHONE_WORKLET_CODE], {
    type: "application/javascript",
  });
  const blobUrl = URL.createObjectURL(blob);
  try {
    await audioContext.audioWorklet.addModule(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Resamples Float32 audio samples to 16kHz 16-bit PCM Int16Array.
 */
export function resampleFloat32To16kPcm(
  inputBuffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number = 16000
): Int16Array {
  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(inputBuffer.length / ratio);
  const result = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const index = Math.min(Math.round(i * ratio), inputBuffer.length - 1);
    let sample = inputBuffer[index];

    // Clamp float32 to [-1.0, 1.0]
    if (sample < -1) sample = -1;
    if (sample > 1) sample = 1;

    // Convert to 16-bit Int (Little-Endian)
    result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return result;
}
