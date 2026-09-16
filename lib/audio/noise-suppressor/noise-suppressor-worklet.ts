/**
 * Inline AudioWorkletProcessor string for real-time noise suppression.
 * Runs entirely on the dedicated audio rendering thread (not main thread),
 * eliminating the buffer underruns / crackling caused by ScriptProcessorNode.
 *
 * Communication with main thread:
 *   main → worklet: port.postMessage({ type: 'setEnabled', enabled: boolean })
 *   worklet → main: port.postMessage({ type: 'metrics', ... NoiseSuppressionMetrics })
 */
export const NOISE_SUPPRESSOR_WORKLET_CODE = `
/**
 * Self-contained Adaptive Multi-Band Spectral Gate
 * (Mirrored from SpectralGateNoiseSuppressor — no ES imports in worklet scope)
 */
class SpectralGate {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.numBands = 16;
    this.attenuationDb = -18;
    this.thresholdDb = -42;
    this.attackMs = 10;
    this.releaseMs = 120;
    this.highPassCutoffHz = 80;

    this.bandNoiseFloor = new Float32Array(this.numBands);
    this.bandGains = new Float32Array(this.numBands);
    this.targetBandGains = new Float32Array(this.numBands);
    this.noiseFloorLearnRate = 0.005;

    // HP filter state
    this.hpX1 = 0; this.hpX2 = 0;
    this.hpY1 = 0; this.hpY2 = 0;
    this.hpB0 = 1; this.hpB1 = -2; this.hpB2 = 1;
    this.hpA1 = 0; this.hpA2 = 0;

    // Metrics
    this.currentNoiseFloorDb = -65;
    this.currentSnrDb = 30;
    this.speechProbability = 0;
    this.isSpeechDetected = false;
    this.framesProcessed = 0;

    this._init();
  }

  _init() {
    const { sampleRate, attackMs, releaseMs, highPassCutoffHz } = this;
    // AudioWorklet delivers 128-sample frames
    const frameDurationMs = (128 / sampleRate) * 1000;
    this.attackCoeff = Math.min(1, Math.max(0.1, frameDurationMs / Math.max(1, attackMs)));
    this.releaseCoeff = Math.min(1, Math.max(0.01, frameDurationMs / Math.max(10, releaseMs)));

    const nyquist = sampleRate / 2;
    const norm_cutoff = Math.max(10, highPassCutoffHz) / nyquist;
    const c = Math.tan((Math.PI * norm_cutoff) / 2);
    const cSq = c * c;
    const sqrt2 = Math.SQRT2;
    const norm = 1 / (1 + sqrt2 * c + cSq);
    this.hpB0 = norm;
    this.hpB1 = -2 * norm;
    this.hpB2 = norm;
    this.hpA1 = 2 * (cSq - 1) * norm;
    this.hpA2 = (1 - sqrt2 * c + cSq) * norm;

    const initialFloor = Math.pow(10, -65 / 20);
    const minGain = Math.pow(10, this.attenuationDb / 20);
    this.bandNoiseFloor.fill(initialFloor);
    this.bandGains.fill(minGain);
    this.targetBandGains.fill(minGain);
  }

  process(input, output) {
    this.framesProcessed++;
    const len = input.length;
    const minGain = Math.pow(10, this.attenuationDb / 20);
    const thresholdLinear = Math.pow(10, this.thresholdDb / 20);

    // 1. High-pass filter
    for (let i = 0; i < len; i++) {
      const x = input[i];
      const y =
        this.hpB0 * x +
        this.hpB1 * this.hpX1 +
        this.hpB2 * this.hpX2 -
        this.hpA1 * this.hpY1 -
        this.hpA2 * this.hpY2;
      this.hpX2 = this.hpX1; this.hpX1 = x;
      this.hpY2 = this.hpY1; this.hpY1 = y;
      output[i] = y;
    }

    // 2. Frame energy
    let frameRms = 0;
    for (let i = 0; i < len; i++) frameRms += output[i] * output[i];
    frameRms = Math.sqrt(frameRms / len);
    const frameEnergyDb = frameRms > 1e-6 ? 20 * Math.log10(frameRms) : -100;

    // 3. Multi-band spectral gate
    const subChunk = Math.max(1, Math.floor(len / this.numBands));
    let activeBands = 0;

    for (let b = 0; b < this.numBands; b++) {
      const start = b * subChunk;
      const end = Math.min(len, start + subChunk);
      let bandEnergy = 0;
      for (let i = start; i < end; i++) bandEnergy += output[i] * output[i];
      const bandRms = Math.sqrt(bandEnergy / Math.max(1, end - start));

      if (bandRms < this.bandNoiseFloor[b] * 1.8) {
        this.bandNoiseFloor[b] += (bandRms - this.bandNoiseFloor[b]) * this.noiseFloorLearnRate;
      } else {
        this.bandNoiseFloor[b] += (bandRms - this.bandNoiseFloor[b]) * (this.noiseFloorLearnRate * 0.05);
      }

      const noise = Math.max(1e-5, this.bandNoiseFloor[b]);
      const snr = bandRms / noise;

      let gain = 1.0;
      if (bandRms < thresholdLinear) {
        const ratio = Math.max(0, (bandRms - thresholdLinear * 0.2) / (thresholdLinear * 0.8));
        gain = minGain + (1.0 - minGain) * Math.min(0.5, ratio * 0.5);
      } else if (snr < 2.5) {
        const snrRatio = Math.max(0, (snr - 1.0) / 1.5);
        gain = minGain + (1.0 - minGain) * Math.min(1.0, snrRatio);
      } else {
        activeBands++;
        gain = 1.0;
      }

      this.targetBandGains[b] = gain;
      const coeff = gain > this.bandGains[b] ? this.attackCoeff : this.releaseCoeff;
      this.bandGains[b] += (gain - this.bandGains[b]) * coeff;
    }

    // 4. Apply per-sample interpolated gain (eliminates block-boundary discontinuity)
    for (let b = 0; b < this.numBands; b++) {
      const start = b * subChunk;
      const end = Math.min(len, start + subChunk);
      const gainStart = b > 0 ? this.bandGains[b - 1] : this.bandGains[b];
      const gainEnd = this.bandGains[b];
      const range = end - start;
      for (let i = start; i < end; i++) {
        const t = range > 1 ? (i - start) / (range - 1) : 1;
        output[i] *= gainStart + (gainEnd - gainStart) * t;
      }
    }

    // 5. Update metrics
    const avgFloor = this.bandNoiseFloor.reduce((s, v) => s + v, 0) / this.numBands;
    this.currentNoiseFloorDb = avgFloor > 1e-6 ? 20 * Math.log10(avgFloor) : -80;
    const snrLinear = Math.max(0.1, frameRms / Math.max(1e-5, avgFloor));
    this.currentSnrDb = Math.min(60, Math.max(0, 20 * Math.log10(snrLinear)));
    this.speechProbability = Math.min(1.0, Math.max(0.0, activeBands / (this.numBands * 0.6)));
    this.isSpeechDetected = this.speechProbability > 0.35 && frameEnergyDb > this.thresholdDb;
  }

  getMetrics() {
    return {
      noiseFloorDb: Math.round(this.currentNoiseFloorDb * 10) / 10,
      snrDb: Math.round(this.currentSnrDb * 10) / 10,
      speechProbability: Math.round(this.speechProbability * 100) / 100,
      isSpeechDetected: this.isSpeechDetected,
      activeMode: 'spectral-gate',
      framesProcessed: this.framesProcessed,
    };
  }
}

class NoiseSuppressorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._enabled = true;
    this._gate = new SpectralGate(sampleRate);
    this._metricsInterval = 0;

    this.port.onmessage = (evt) => {
      const { type, enabled } = evt.data ?? {};
      if (type === 'setEnabled') {
        this._enabled = !!enabled;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    if (!this._enabled) {
      output.set(input);
    } else {
      // Work on a copy so we do not mutate the read-only input buffer
      const buf = new Float32Array(input);
      this._gate.process(buf, buf);
      output.set(buf);
    }

    // Send metrics every ~100 frames (~0.3s at 48kHz/128spp) to avoid overwhelming main thread
    this._metricsInterval++;
    if (this._metricsInterval >= 100) {
      this._metricsInterval = 0;
      this.port.postMessage({ type: 'metrics', metrics: this._gate.getMetrics() });
    }

    return true;
  }
}

registerProcessor('noise-suppressor-processor', NoiseSuppressorProcessor);
`;

/**
 * Loads the inline NoiseSuppressorProcessor into an AudioContext via Blob URL.
 * Follows the same pattern as loadMicrophoneWorklet in microphone-worklet.ts.
 */
export async function loadNoiseSuppressorWorklet(
  audioContext: AudioContext
): Promise<void> {
  if (typeof Blob === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([NOISE_SUPPRESSOR_WORKLET_CODE], {
    type: "application/javascript",
  });
  const blobUrl = URL.createObjectURL(blob);
  try {
    await audioContext.audioWorklet.addModule(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
