/**
 * Audio PCM Utilities for Gemini Live API & Web Audio API
 * Handles conversion between Float32Array (Web Audio), Int16Array (Raw PCM), and Base64.
 */

/**
 * Converts Float32Array [-1.0, 1.0] audio samples to Int16Array [-32768, 32767] PCM
 */
export function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Converts Int16Array PCM to Base64 string for WebSocket payload
 */
export function int16ToBase64(input: Int16Array): string {
  const uint8 = new Uint8Array(
    input.buffer,
    input.byteOffset,
    input.byteLength
  );
  let binary = "";
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 string from Gemini Live (16-bit PCM, little-endian) to Float32Array [-1.0, 1.0]
 */
export function base64ToFloat32(base64: string): Float32Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const int16Array = new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 2
  );
  const float32Array = new Float32Array(int16Array.length);

  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }

  return float32Array;
}

/**
 * Downsamples audio buffer from browser native rate (e.g. 44.1kHz or 48kHz) to target rate (16kHz)
 */
export function downsampleAudioBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 16000
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Computes RMS (Root Mean Square) volume level from Float32 audio samples
 * Returns normalized level [0.0, 1.0]
 */
export function calculateRMSVolume(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  // Scale and clamp
  return Math.min(1, Math.max(0, rms * 5));
}
