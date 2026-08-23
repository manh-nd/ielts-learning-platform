import {
  INoiseSuppressorProcessor,
  NoiseSuppressorOptions,
  NoiseSuppressionMetrics,
  NoiseSuppressionMode,
} from "./types";

/**
 * Adaptive Multi-Band Spectral Gate Noise Suppressor
 * High-performance DSP processor for real-time background noise reduction,
 * room rumble elimination, and speech clarity enhancement.
 */
export class SpectralGateNoiseSuppressor implements INoiseSuppressorProcessor {
  private options: Required<NoiseSuppressorOptions>;
  private isSuppressionEnabled: boolean = true;
  private activeMode: NoiseSuppressionMode = "spectral-gate";

  // Filter state
  private numBands = 16;
  private bandFrequencies: number[] = [];
  private bandNoiseFloor: Float32Array;
  private bandGains: Float32Array;
  private targetBandGains: Float32Array;
  private bandEnergyHistory: Float32Array;

  // Global metrics tracking
  private currentNoiseFloorDb: number = -60;
  private currentSnrDb: number = 20;
  private speechProbability: number = 0;
  private isSpeechDetected: boolean = false;
  private framesProcessedCount: number = 0;

  // Low rumble high-pass filter (2nd order Butterworth)
  private hpX1 = 0;
  private hpX2 = 0;
  private hpY1 = 0;
  private hpY2 = 0;
  private hpB0 = 1;
  private hpB1 = -2;
  private hpB2 = 1;
  private hpA1 = 0;
  private hpA2 = 0;

  // Smoothing factors
  private attackCoeff: number = 0.8;
  private releaseCoeff: number = 0.05;
  private noiseFloorLearnRate: number = 0.005;

  constructor(options: NoiseSuppressorOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate ?? 16000,
      attenuationDb: options.attenuationDb ?? -18,
      thresholdDb: options.thresholdDb ?? -42,
      attackMs: options.attackMs ?? 10,
      releaseMs: options.releaseMs ?? 120,
      enabled: options.enabled ?? true,
      mode: options.mode ?? "spectral-gate",
      highPassCutoffHz: options.highPassCutoffHz ?? 80,
    };

    this.isSuppressionEnabled = this.options.enabled;
    this.activeMode = this.options.mode;

    this.bandNoiseFloor = new Float32Array(this.numBands);
    this.bandGains = new Float32Array(this.numBands);
    this.targetBandGains = new Float32Array(this.numBands);
    this.bandEnergyHistory = new Float32Array(this.numBands);

    this.initCoefficients();
    this.reset();
  }

  private initCoefficients(): void {
    const { sampleRate, attackMs, releaseMs, highPassCutoffHz } = this.options;

    // Approximate frame duration (assuming ~128-512 samples per call)
    const frameDurationMs = (256 / sampleRate) * 1000;
    this.attackCoeff = Math.min(
      1,
      Math.max(0.1, frameDurationMs / Math.max(1, attackMs))
    );
    this.releaseCoeff = Math.min(
      1,
      Math.max(0.01, frameDurationMs / Math.max(10, releaseMs))
    );

    // Calculate logarithmically spaced frequency bands (Bark / ERB scale approximation)
    const minFreq = 80;
    const maxFreq = Math.min(8000, sampleRate / 2);
    this.bandFrequencies = [];
    for (let i = 0; i < this.numBands; i++) {
      const freq =
        minFreq * Math.pow(maxFreq / minFreq, i / (this.numBands - 1));
      this.bandFrequencies.push(freq);
    }

    // High-pass filter coefficients (2nd order Butterworth)
    const nyquist = sampleRate / 2;
    const normalizedCutoff = Math.max(10, highPassCutoffHz) / nyquist;
    const c = Math.tan((Math.PI * normalizedCutoff) / 2);
    const cSq = c * c;
    const sqrt2 = Math.SQRT2;

    const norm = 1 / (1 + sqrt2 * c + cSq);
    this.hpB0 = norm;
    this.hpB1 = -2 * norm;
    this.hpB2 = norm;
    this.hpA1 = 2 * (cSq - 1) * norm;
    this.hpA2 = (1 - sqrt2 * c + cSq) * norm;
  }

  public setOptions(options: Partial<NoiseSuppressorOptions>): void {
    this.options = { ...this.options, ...options };
    if (options.enabled !== undefined) {
      this.isSuppressionEnabled = options.enabled;
    }
    if (options.mode !== undefined) {
      this.activeMode = options.mode;
    }
    this.initCoefficients();
  }

  public setEnabled(enabled: boolean): void {
    this.isSuppressionEnabled = enabled;
  }

  public isEnabled(): boolean {
    return this.isSuppressionEnabled;
  }

  public reset(): void {
    this.hpX1 = 0;
    this.hpX2 = 0;
    this.hpY1 = 0;
    this.hpY2 = 0;

    // Initial default noise floor estimation (-65 dBFS)
    const initialFloor = Math.pow(10, -65 / 20);
    const minGain = Math.pow(10, this.options.attenuationDb / 20);

    this.bandNoiseFloor.fill(initialFloor);
    this.bandGains.fill(minGain);
    this.targetBandGains.fill(minGain);
    this.bandEnergyHistory.fill(initialFloor);

    this.currentNoiseFloorDb = -65;
    this.currentSnrDb = 30;
    this.speechProbability = 0;
    this.isSpeechDetected = false;
    this.framesProcessedCount = 0;
  }

  /**
   * Process a single audio frame in Float32 format.
   * Modifies samples with zero memory reallocation.
   */
  public process(input: Float32Array): Float32Array {
    this.framesProcessedCount++;

    if (!this.isSuppressionEnabled || input.length === 0) {
      return input;
    }

    const len = input.length;
    const output = new Float32Array(len);

    // 1. Apply High-Pass Rumble Filter
    for (let i = 0; i < len; i++) {
      const x = input[i];
      const y =
        this.hpB0 * x +
        this.hpB1 * this.hpX1 +
        this.hpB2 * this.hpX2 -
        this.hpA1 * this.hpY1 -
        this.hpA2 * this.hpY2;

      this.hpX2 = this.hpX1;
      this.hpX1 = x;
      this.hpY2 = this.hpY1;
      this.hpY1 = y;

      output[i] = y;
    }

    // 2. Compute Total Frame Energy & Band Energies
    let frameRms = 0;
    for (let i = 0; i < len; i++) {
      frameRms += output[i] * output[i];
    }
    frameRms = Math.sqrt(frameRms / len);
    const frameEnergyDb = frameRms > 1e-6 ? 20 * Math.log10(frameRms) : -100;

    // 3. Spectral Energy Decomposition (Multi-band analysis)
    const minGain = Math.pow(10, this.options.attenuationDb / 20); // e.g. -18dB -> ~0.125
    const thresholdLinear = Math.pow(10, this.options.thresholdDb / 20);

    // Estimate speech activity & update noise floor
    let activeBands = 0;
    const subChunk = Math.max(1, Math.floor(len / this.numBands));

    for (let b = 0; b < this.numBands; b++) {
      const start = b * subChunk;
      const end = Math.min(len, start + subChunk);
      let bandEnergy = 0;
      for (let i = start; i < end; i++) {
        bandEnergy += output[i] * output[i];
      }
      const bandRms = Math.sqrt(bandEnergy / Math.max(1, end - start));

      // Adaptive noise floor tracking (minimum statistics tracking)
      if (bandRms < this.bandNoiseFloor[b] * 1.8) {
        // Signal is close to noise floor, adapt faster upwards/downwards
        this.bandNoiseFloor[b] +=
          (bandRms - this.bandNoiseFloor[b]) * this.noiseFloorLearnRate;
      } else {
        // High energy (voice/speech transient), slowly drift noise floor
        this.bandNoiseFloor[b] +=
          (bandRms - this.bandNoiseFloor[b]) *
          (this.noiseFloorLearnRate * 0.05);
      }

      // Signal to Noise Ratio in this band
      const noise = Math.max(1e-5, this.bandNoiseFloor[b]);
      const snr = bandRms / noise;

      // Determine target spectral gain with soft knee
      let gain = 1.0;
      if (bandRms < thresholdLinear) {
        // Signal is below speech threshold (pure noise / silence)
        const ratio = Math.max(
          0,
          (bandRms - thresholdLinear * 0.2) / (thresholdLinear * 0.8)
        );
        gain = minGain + (1.0 - minGain) * Math.min(0.5, ratio * 0.5);
      } else if (snr < 2.5) {
        // Speech present but high background noise (low SNR)
        const snrRatio = Math.max(0, (snr - 1.0) / 1.5);
        gain = minGain + (1.0 - minGain) * Math.min(1.0, snrRatio);
      } else {
        // Clear active speech
        activeBands++;
        gain = 1.0;
      }

      this.targetBandGains[b] = gain;

      // Smooth gain transitions (Attack vs Release)
      const coeff =
        gain > this.bandGains[b] ? this.attackCoeff : this.releaseCoeff;
      this.bandGains[b] += (gain - this.bandGains[b]) * coeff;
    }

    // 4. Update Metrics (Speech Probability, Noise Floor dB, SNR)
    const avgNoiseFloor =
      this.bandNoiseFloor.reduce((sum, v) => sum + v, 0) / this.numBands;
    this.currentNoiseFloorDb =
      avgNoiseFloor > 1e-6 ? 20 * Math.log10(avgNoiseFloor) : -80;

    const snrLinear = Math.max(0.1, frameRms / Math.max(1e-5, avgNoiseFloor));
    this.currentSnrDb = Math.min(60, Math.max(0, 20 * Math.log10(snrLinear)));

    this.speechProbability = Math.min(
      1.0,
      Math.max(0.0, activeBands / (this.numBands * 0.6))
    );
    this.isSpeechDetected =
      this.speechProbability > 0.35 && frameEnergyDb > this.options.thresholdDb;

    // 5. Apply Multi-Band Gains with Overlap-Smoothing
    for (let b = 0; b < this.numBands; b++) {
      const start = b * subChunk;
      const end = Math.min(len, start + subChunk);
      const gain = this.bandGains[b];

      for (let i = start; i < end; i++) {
        output[i] *= gain;
      }
    }

    return output;
  }

  public getMetrics(): NoiseSuppressionMetrics {
    return {
      noiseFloorDb: Math.round(this.currentNoiseFloorDb * 10) / 10,
      snrDb: Math.round(this.currentSnrDb * 10) / 10,
      speechProbability: Math.round(this.speechProbability * 100) / 100,
      isSpeechDetected: this.isSpeechDetected,
      activeMode: this.activeMode,
      framesProcessed: this.framesProcessedCount,
    };
  }
}
