/**
 * Types & Interfaces for WASM & DSP Noise Suppression Module
 */

export type NoiseSuppressionMode =
  "wasm" | "spectral-gate" | "adaptive" | "passthrough";

export interface NoiseSuppressorOptions {
  /**
   * Sample rate in Hz (typically 16000, 44100, or 48000)
   * @default 16000
   */
  sampleRate?: number;
  /**
   * Noise attenuation level in decibels (dB), e.g. -12dB to -30dB
   * Higher negative value means stronger suppression.
   * @default -18
   */
  attenuationDb?: number;
  /**
   * Sensitivity threshold in dB for speech vs noise detection.
   * @default -42
   */
  thresholdDb?: number;
  /**
   * Attack time in milliseconds (how fast gain opens when speech starts)
   * @default 10
   */
  attackMs?: number;
  /**
   * Release time in milliseconds (how smoothly gain closes when speech ends)
   * @default 120
   */
  releaseMs?: number;
  /**
   * Whether noise suppression is initially enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Preferred suppression mode
   * @default "adaptive"
   */
  mode?: NoiseSuppressionMode;
  /**
   * Frequency cutoffs (Hz) for low-end rumble (e.g. mic handling, wind)
   * @default 80
   */
  highPassCutoffHz?: number;
}

export interface NoiseSuppressionMetrics {
  /**
   * Estimated background noise floor level in dBFS [-100, 0]
   */
  noiseFloorDb: number;
  /**
   * Estimated Signal-to-Noise Ratio (SNR) in dB [0, 60]
   */
  snrDb: number;
  /**
   * Estimated speech presence probability [0.0, 1.0]
   */
  speechProbability: number;
  /**
   * Boolean flag indicating whether active voice is currently detected
   */
  isSpeechDetected: boolean;
  /**
   * Current active processing mode
   */
  activeMode: NoiseSuppressionMode;
  /**
   * Total frames processed
   */
  framesProcessed: number;
}

export interface INoiseSuppressorProcessor {
  /**
   * Process an incoming Float32Array audio frame (e.g. 128, 256, 512, 1024 samples)
   * Returns a new or modified Float32Array containing noise-reduced audio.
   */
  process(input: Float32Array): Float32Array;
  /**
   * Update processor options on the fly
   */
  setOptions(options: Partial<NoiseSuppressorOptions>): void;
  /**
   * Query real-time metrics (noise floor, SNR, speech probability)
   */
  getMetrics(): NoiseSuppressionMetrics;
  /**
   * Enable or disable noise suppression (bypass mode)
   */
  setEnabled(enabled: boolean): void;
  /**
   * Check whether noise suppression is currently active
   */
  isEnabled(): boolean;
  /**
   * Reset internal filter state and noise floor memory
   */
  reset(): void;
}

export interface NoiseSuppressorAudioNode {
  /**
   * Web Audio input node to connect audio source into
   */
  inputNode: AudioNode;
  /**
   * Web Audio output node to connect downstream nodes (analyser, destination, recorder)
   */
  outputNode: AudioNode;
  /**
   * Underlying DSP / WASM processor instance
   */
  processor: INoiseSuppressorProcessor;
  /**
   * Enable or disable noise suppression
   */
  setEnabled: (enabled: boolean) => void;
  /**
   * Get current metrics
   */
  getMetrics: () => NoiseSuppressionMetrics;
  /**
   * Clean up and disconnect nodes
   */
  disconnect: () => void;
}
