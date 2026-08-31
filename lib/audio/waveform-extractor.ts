/**
 * Waveform Extractor Utility
 * Decodes audio data (Blob, ArrayBuffer, or URL) via Web Audio API
 * and extracts normalized amplitude values for accurate waveform rendering.
 */

/**
 * Generates natural fallback amplitudes if audio decoding fails or in SSR/headless environments.
 */
export function generateFallbackAmplitudes(count: number = 48): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const envelope = Math.sin(progress * Math.PI);
    const wave1 = Math.sin(i * 0.45) * 0.3;
    const wave2 = Math.cos(i * 0.85) * 0.25;
    const wave3 = Math.sin(i * 1.3) * 0.15;
    const base = 0.25;
    const val = (base + wave1 + wave2 + wave3) * (0.4 + 0.6 * envelope);
    result.push(Math.max(0.12, Math.min(0.95, Number(val.toFixed(3)))));
  }
  return result;
}

/**
 * Computes normalized amplitude bars from an AudioBuffer channel data.
 */
export function computeAmplitudesFromChannelData(
  channelData: Float32Array,
  barCount: number = 48
): number[] {
  if (!channelData || channelData.length === 0) {
    return generateFallbackAmplitudes(barCount);
  }

  const blockSize = Math.floor(channelData.length / barCount);
  if (blockSize <= 0) {
    return generateFallbackAmplitudes(barCount);
  }

  const rawAmplitudes: number[] = [];
  let maxVal = 0;

  for (let i = 0; i < barCount; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);

    // Calculate RMS (Root Mean Square) for realistic energy perception
    let sumSquares = 0;
    let peak = 0;
    for (let j = start; j < end; j++) {
      const absSample = Math.abs(channelData[j]);
      if (absSample > peak) peak = absSample;
      sumSquares += absSample * absSample;
    }

    const count = end - start || 1;
    const rms = Math.sqrt(sumSquares / count);
    // Combine 70% RMS and 30% peak for punchy voice peaks
    const energy = 0.7 * rms + 0.3 * peak;

    rawAmplitudes.push(energy);
    if (energy > maxVal) {
      maxVal = energy;
    }
  }

  // Normalize amplitudes between 0.12 and 0.95
  const scale = maxVal > 0.001 ? 1 / maxVal : 1;

  return rawAmplitudes.map((amp) => {
    const normalized = amp * scale;
    // Map to [0.12, 0.95] for aesthetic minimum bar height
    const mapped = 0.12 + normalized * 0.83;
    return Math.max(0.12, Math.min(0.95, Number(mapped.toFixed(3))));
  });
}

/**
 * Extracts amplitude bars from an audio source (Blob, ArrayBuffer, or URL).
 */
export async function extractWaveformAmplitudes(
  source: Blob | ArrayBuffer | string,
  barCount: number = 48
): Promise<number[]> {
  // Guard for non-browser or test environments lacking Web Audio API
  if (
    typeof window === "undefined" ||
    (!window.AudioContext &&
      // @ts-expect-error webkit prefix fallback
      !window.webkitAudioContext)
  ) {
    return generateFallbackAmplitudes(barCount);
  }

  let arrayBuffer: ArrayBuffer;

  try {
    if (typeof source === "string") {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch audio from ${source}: ${response.status}`
        );
      }
      arrayBuffer = await response.arrayBuffer();
    } else if (source instanceof Blob) {
      arrayBuffer = await source.arrayBuffer();
    } else if (source instanceof ArrayBuffer) {
      arrayBuffer = source;
    } else {
      return generateFallbackAmplitudes(barCount);
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return generateFallbackAmplitudes(barCount);
    }

    const AudioCtxClass =
      window.AudioContext ||
      // @ts-expect-error webkit prefix fallback
      window.webkitAudioContext;

    const audioCtx = new AudioCtxClass();

    try {
      if (typeof audioCtx.decodeAudioData !== "function") {
        return generateFallbackAmplitudes(barCount);
      }
      // decodeAudioData consumes/detaches buffer in some browsers, so slice a copy
      const bufferCopy = arrayBuffer.slice(0);
      const audioBuffer = await audioCtx.decodeAudioData(bufferCopy);
      const channelData = audioBuffer.getChannelData(0);
      return computeAmplitudesFromChannelData(channelData, barCount);
    } finally {
      if (audioCtx.state !== "closed" && typeof audioCtx.close === "function") {
        await audioCtx.close().catch(() => {});
      }
    }
  } catch (err) {
    console.warn(
      "[waveform-extractor] Failed to decode audio data, using fallback:",
      err
    );
    return generateFallbackAmplitudes(barCount);
  }
}
