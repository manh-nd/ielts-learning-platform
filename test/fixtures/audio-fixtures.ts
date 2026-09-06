/**
 * Test Audio Fixtures
 * Generates deterministic, valid PCM WAV blobs for unit and browser integration testing.
 */

/**
 * Generates a deterministic 2-second WAV file with a recognizable stepped amplitude envelope:
 * - 0.0s – 0.5s: silence (amplitude = 0.0)
 * - 0.5s – 1.0s: low-amplitude tone (amplitude = 0.2)
 * - 1.0s – 1.5s: high-amplitude tone (amplitude = 0.9)
 * - 1.5s – 2.0s: silence (amplitude = 0.0)
 *
 * When decoded by Wavesurfer in real browser environments, this produces a distinct stepped
 * visual waveform envelope (flat -> low -> high -> flat), proving that the canvas visualization
 * is derived directly from decoded audio bytes rather than synthetic mathematical generators.
 */
export function createSteppedEnvelopeWavBlob(durationSeconds = 2): Blob {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSeconds;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * (bitsPerSample / 8);

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let amplitude = 0;
    if (t >= 0.5 && t < 1.0) {
      amplitude = 0.2; // low-amplitude tone
    } else if (t >= 1.0 && t < 1.5) {
      amplitude = 0.9; // high-amplitude tone
    }
    const sample = Math.sin(2 * Math.PI * 440 * t) * amplitude;
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
